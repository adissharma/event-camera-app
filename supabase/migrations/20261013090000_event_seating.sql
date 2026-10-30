-- Host-managed seating chart and an invite-safe lookup for guests.
create table if not exists public.event_seating (
  celebration_id uuid primary key references public.celebrations(id) on delete cascade,
  guests jsonb not null default '[]'::jsonb,
  floorplan_path text,
  updated_at timestamptz not null default now(),
  constraint event_seating_guests_array check (jsonb_typeof(guests) = 'array')
);

alter table public.event_seating enable row level security;
create policy "event_seating: managers read" on public.event_seating
  for select to authenticated using (private.can_manage_celebration(celebration_id));
create policy "event_seating: managers insert" on public.event_seating
  for insert to authenticated with check (private.can_manage_celebration(celebration_id));
create policy "event_seating: managers update" on public.event_seating
  for update to authenticated using (private.can_manage_celebration(celebration_id))
  with check (private.can_manage_celebration(celebration_id));
grant select, insert, update on public.event_seating to authenticated;
revoke all on public.event_seating from anon;

create or replace function public.get_guest_seating(p_event_code text, p_guest_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_plan jsonb;
begin
  -- Same gate as the other guest RPCs: a live, published event and a guest
  -- token issued for its first session.
  select * into v_celebration from public.celebrations
  where lower(event_code) = lower(trim(p_event_code))
    and deleted_at is null and status <> 'draft';
  if not found then raise exception 'event not found or unavailable' using errcode = '42501'; end if;

  select * into v_session from public.event_sessions
  where celebration_id = v_celebration.id and deleted_at is null
  order by sequence_number asc limit 1;
  if not found then raise exception 'event session not found' using errcode = '42501'; end if;

  perform 1 from public.guest_sessions gs
  where gs.event_session_id = v_session.id
    and gs.anonymous_token_hash = private.digest_token(p_guest_token);
  if not found then raise exception 'invalid guest session' using errcode = '42501'; end if;

  select jsonb_build_object('guests', s.guests, 'floorplan_path', s.floorplan_path)
    into v_plan from public.event_seating s where s.celebration_id = v_session.celebration_id;
  return coalesce(v_plan, jsonb_build_object('guests', '[]'::jsonb, 'floorplan_path', null));
end; $$;
revoke all on function public.get_guest_seating(text, text) from public;
grant execute on function public.get_guest_seating(text, text) to anon, authenticated;
