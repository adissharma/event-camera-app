-- Persist challenges server-side.
--
-- Challenges — their titles, icons and the host's "Guest instructions" — lived
-- only in per-device AsyncStorage under `__mock_challenges_<celebrationId>`.
-- Nothing ever left the host's phone, so a guest on any other device fell back
-- to the hardcoded default set with stock briefs, and a host's instructions
-- could never reach the people they were written for. This is the table those
-- challenges should always have had.
--
-- Shaped to match how the client already models a challenge, so the screens
-- keep the same field names: label, icon, instructions, and the optional cover
-- thumbnail the challenge ring renders.

create table public.event_challenges (
  id uuid primary key default gen_random_uuid(),
  celebration_id uuid not null references public.celebrations (id) on delete cascade,
  label text not null,
  icon text not null,
  instructions text,
  -- The ring's cover thumbnail. Nullable: an unshot challenge renders its icon.
  photo_uri text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.event_challenges is
  'Host-authored photo challenges for a celebration. Read by hosts through RLS and by guests through get_guest_challenges.';

create index event_challenges_celebration_idx
  on public.event_challenges (celebration_id, sort_order)
  where deleted_at is null;

create trigger event_challenges_set_updated_at
  before update on public.event_challenges
  for each row execute function private.set_updated_at();

alter table public.event_challenges enable row level security;

-- Hosts and collaborators read and manage. Guests are deliberately not given a
-- policy here: they have no authenticated identity to match on, and their read
-- goes through the security-definer RPC below, which validates a guest token
-- and scopes to exactly one event.
create policy "event_challenges: viewers read"
  on public.event_challenges for select to authenticated
  using (deleted_at is null and private.can_view_celebration(celebration_id));

create policy "event_challenges: managers write"
  on public.event_challenges for all to authenticated
  using (private.can_manage_celebration(celebration_id))
  with check (private.can_manage_celebration(celebration_id));

revoke all on public.event_challenges from public, anon;
grant select, insert, update, delete on public.event_challenges to authenticated;

-- ---------------------------------------------------------------------------
-- Guest read
-- ---------------------------------------------------------------------------

create function public.get_guest_challenges(
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
  v_challenges jsonb;
begin
  v_clean_code := trim(lower(p_event_code));

  select * into v_celebration
  from public.celebrations
  where lower(event_code) = v_clean_code
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'event not found or unavailable' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  select * into v_guest
  from public.guest_sessions
  where anonymous_token_hash = private.digest_token(p_guest_token)
    and event_session_id = v_session.id;

  if not found then
    raise exception 'invalid guest session for this event' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ec.id,
      'label', ec.label,
      'icon', ec.icon,
      'instructions', ec.instructions,
      'photo_uri', ec.photo_uri,
      'sort_order', ec.sort_order
    )
    order by ec.sort_order asc, ec.created_at asc
  ), '[]'::jsonb) into v_challenges
  from public.event_challenges ec
  where ec.celebration_id = v_celebration.id
    and ec.deleted_at is null;

  return jsonb_build_object('challenges', v_challenges);
end;
$$;

comment on function public.get_guest_challenges(text, text) is
  'Returns the host-authored challenge list for an event a guest has joined, validated by guest token.';

revoke all on function public.get_guest_challenges from public;
grant execute on function public.get_guest_challenges to anon, authenticated;

-- ---------------------------------------------------------------------------
-- First-run seeding
-- ---------------------------------------------------------------------------
--
-- The default challenge set lives in the client (it is presentation copy, and
-- keeping a second copy in SQL is exactly the duplication that let the briefs
-- drift apart). The client therefore supplies the rows, and this function
-- decides whether they are needed — atomically, so two hosts opening the same
-- event at once cannot both seed it.

create function public.seed_event_challenges_if_empty(
  p_celebration_id uuid,
  p_challenges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing integer;
  v_challenges jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to manage this event' using errcode = '42501';
  end if;

  -- Serialises concurrent seeding attempts for this celebration. Without it two
  -- devices can both observe an empty list and both insert the defaults.
  perform pg_advisory_xact_lock(hashtextextended(p_celebration_id::text, 0));

  select count(*)::integer into v_existing
  from public.event_challenges
  where celebration_id = p_celebration_id
    and deleted_at is null;

  if v_existing = 0 then
    insert into public.event_challenges (celebration_id, label, icon, instructions, photo_uri, sort_order)
    select
      p_celebration_id,
      item ->> 'label',
      item ->> 'icon',
      nullif(item ->> 'instructions', ''),
      nullif(item ->> 'photo_uri', ''),
      coalesce((item ->> 'sort_order')::integer, ordinality::integer - 1)
    from jsonb_array_elements(p_challenges) with ordinality as t(item, ordinality)
    where coalesce(item ->> 'label', '') <> ''
      and coalesce(item ->> 'icon', '') <> '';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ec.id,
      'label', ec.label,
      'icon', ec.icon,
      'instructions', ec.instructions,
      'photo_uri', ec.photo_uri,
      'sort_order', ec.sort_order
    )
    order by ec.sort_order asc, ec.created_at asc
  ), '[]'::jsonb) into v_challenges
  from public.event_challenges ec
  where ec.celebration_id = p_celebration_id
    and ec.deleted_at is null;

  return jsonb_build_object('challenges', v_challenges, 'seeded', v_existing = 0);
end;
$$;

comment on function public.seed_event_challenges_if_empty(uuid, jsonb) is
  'Inserts the supplied challenge rows only when the celebration has none, and returns the resulting list. Idempotent and safe against concurrent callers.';

revoke all on function public.seed_event_challenges_if_empty from public, anon;
grant execute on function public.seed_event_challenges_if_empty to authenticated;
