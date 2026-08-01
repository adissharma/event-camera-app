-- Guest preview RPC: Allows anonymous requests to retrieve details of an event
-- by its public slug without exposing other columns or violating RLS.

create type public.guest_event_preview as (
  celebration_id uuid,
  title text,
  ends_at timestamptz,
  shot_limit_per_guest integer,
  cover_storage_path text
);

create or replace function public.get_event_preview_by_code(
  p_event_code text
)
returns public.guest_event_preview
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_preview public.guest_event_preview;
  v_clean_code text;
begin
  v_clean_code := trim(lower(p_event_code));
  
  if v_clean_code is null or v_clean_code = '' then
    raise exception 'invalid event code' using errcode = '42501';
  end if;

  select * into v_celebration
  from public.celebrations
  where public_slug = v_clean_code
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'invalid event code' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  v_preview.celebration_id := v_celebration.id;
  v_preview.title := v_celebration.title;
  v_preview.ends_at := coalesce(v_session.ends_at, v_celebration.ends_at);
  v_preview.shot_limit_per_guest := v_session.shot_limit_per_guest;
  v_preview.cover_storage_path := v_celebration.cover_storage_path;

  return v_preview;
end;
$$;

comment on function public.get_event_preview_by_code is
  'Fetches preview details for an event cover screen using its public slug. Security definer bypasses RLS for anonymous preview access.';

revoke all on function public.get_event_preview_by_code from public;
grant execute on function public.get_event_preview_by_code to anon, authenticated;
