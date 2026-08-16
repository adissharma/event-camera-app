-- Event recap videos. Rendering is intentionally outside Postgres; this table
-- is the durable state machine shared by the scheduler, worker and clients.

create table public.event_recaps (
  id uuid primary key default gen_random_uuid(),
  event_session_id uuid not null references public.event_sessions (id) on delete cascade,
  celebration_id uuid not null references public.celebrations (id) on delete cascade,
  status text not null default 'not_available',
  storage_path text,
  playback_url text,
  duration_ms integer,
  media_count integer not null default 0,
  selected_media_ids uuid[] not null default '{}',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_recaps_status check (status in ('not_available', 'queued', 'processing', 'ready', 'failed')),
  constraint event_recaps_attempts check (attempt_count >= 0 and max_attempts >= 1),
  unique (event_session_id)
);

comment on table public.event_recaps is
  'One idempotent, server-rendered vertical recap per ended event session.';

create index event_recaps_due_idx on public.event_recaps (status, available_at)
  where status in ('queued', 'processing');

create trigger event_recaps_set_updated_at
  before update on public.event_recaps
  for each row execute function private.set_updated_at();

insert into storage.buckets (id, name, public)
values ('event-recaps', 'event-recaps', true)
on conflict (id) do nothing;

alter table public.event_recaps enable row level security;

create policy "event recaps: accessible hosts read"
  on public.event_recaps for select to authenticated
  using (private.can_view_event_session(event_session_id));

create or replace function public.enqueue_due_event_recaps(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.event_recaps (event_session_id, celebration_id, status, available_at)
  select es.id, es.celebration_id, 'queued', p_now
  from public.event_sessions es
  where es.deleted_at is null
    and es.ends_at is not null
    and es.ends_at <= p_now
    and es.status <> 'archived'
  on conflict (event_session_id) do update
    set status = case
      when public.event_recaps.status = 'failed'
        and public.event_recaps.attempt_count < public.event_recaps.max_attempts
        then 'queued'
      else public.event_recaps.status
    end,
    available_at = case
      when public.event_recaps.status = 'failed'
        and public.event_recaps.attempt_count < public.event_recaps.max_attempts
        then p_now
      else public.event_recaps.available_at
    end;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_due_event_recaps(timestamptz) from public;
grant execute on function public.enqueue_due_event_recaps(timestamptz) to service_role;

create or replace function public.claim_event_recap_job(
  p_worker_id text,
  p_lease_seconds integer default 900
)
returns setof public.event_recaps
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidate as (
    select er.id
    from public.event_recaps er
    where (
      er.status = 'queued' and coalesce(er.available_at, now()) <= now()
    ) or (
      er.status = 'processing' and er.lease_expires_at < now()
    )
    order by er.created_at
    for update skip locked
    limit 1
  )
  update public.event_recaps er
  set status = 'processing',
      attempt_count = er.attempt_count + 1,
      locked_by = p_worker_id,
      lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 60)),
      started_at = coalesce(er.started_at, now()),
      last_error_code = null,
      last_error_message = null
  from candidate
  where er.id = candidate.id
  returning er.*;
end;
$$;

revoke all on function public.claim_event_recap_job(text, integer) from public;
grant execute on function public.claim_event_recap_job(text, integer) to service_role;

create or replace function public.complete_event_recap_job(
  p_recap_id uuid,
  p_worker_id text,
  p_storage_path text,
  p_playback_url text,
  p_duration_ms integer,
  p_media_count integer,
  p_selected_media_ids uuid[],
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_recaps
  set status = 'ready', storage_path = p_storage_path, playback_url = p_playback_url,
      duration_ms = p_duration_ms, media_count = p_media_count,
      selected_media_ids = coalesce(p_selected_media_ids, '{}'), metadata = coalesce(p_metadata, '{}'),
      locked_by = null, lease_expires_at = null, completed_at = now()
  where id = p_recap_id and status = 'processing' and locked_by = p_worker_id;
  return found;
end;
$$;

revoke all on function public.complete_event_recap_job(uuid, text, text, text, integer, integer, uuid[], jsonb) from public;
grant execute on function public.complete_event_recap_job(uuid, text, text, text, integer, integer, uuid[], jsonb) to service_role;

create or replace function public.fail_event_recap_job(
  p_recap_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_recaps
  set status = case when attempt_count >= max_attempts then 'failed' else 'queued' end,
      available_at = case when attempt_count >= max_attempts then null else now() + interval '5 minutes' end,
      locked_by = null, lease_expires_at = null, failed_at = case when attempt_count >= max_attempts then now() else failed_at end,
      last_error_code = left(p_error_code, 120), last_error_message = left(p_error_message, 1000)
  where id = p_recap_id and status = 'processing' and locked_by = p_worker_id;
  return found;
end;
$$;

revoke all on function public.fail_event_recap_job(uuid, text, text, text) from public;
grant execute on function public.fail_event_recap_job(uuid, text, text, text) to service_role;

-- Token-gated recap projection for guests. Keeping this separate preserves the
-- existing gallery RPC's reveal and media-visibility rules.
create or replace function public.get_guest_recap(
  p_event_code text,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_guest public.guest_sessions%rowtype;
  v_clean_code text;
  v_recap public.event_recaps%rowtype;
begin
  v_clean_code := trim(lower(p_event_code));
  select * into v_celebration from public.celebrations
  where lower(event_code) = v_clean_code and deleted_at is null and status <> 'draft';
  if not found then raise exception 'event not found or unavailable' using errcode = '42501'; end if;
  select * into v_session from public.event_sessions
  where celebration_id = v_celebration.id and deleted_at is null
  order by sequence_number asc limit 1;
  if not found then raise exception 'event session not found' using errcode = '42501'; end if;
  select * into v_guest from public.guest_sessions
  where anonymous_token_hash = private.digest_token(p_guest_token) and event_session_id = v_session.id;
  if not found then raise exception 'invalid guest session for this event' using errcode = '42501'; end if;
  select * into v_recap from public.event_recaps where event_session_id = v_session.id;
  return jsonb_build_object(
    'status', case when v_session.ends_at is null or v_session.ends_at > now()
      then 'not_available' when v_recap.id is null then 'queued' else v_recap.status end,
    'playback_url', case when v_session.ends_at is not null and v_session.ends_at <= now()
      then v_recap.playback_url else null end,
    'duration_ms', v_recap.duration_ms, 'media_count', v_recap.media_count
  );
end;
$$;

revoke all on function public.get_guest_recap(text, text) from public;
grant execute on function public.get_guest_recap(text, text) to anon, authenticated;
