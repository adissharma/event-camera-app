-- Enforce how many guests an event can hold, and let its host set a lower number.
--
-- WHY
-- ---
-- Every package promises a guest allowance, stored as the `participant_limit`
-- entitlement, but nothing ever read it. A Free event "for 5 guests" admitted
-- anyone with the code, so the main thing the paid tiers sell was not being sold.
--
-- Hosts also had no way to keep an event small. An unlimited package has no number
-- to bump into, and a host may still only want 60 people in.
--
-- WHAT
-- ----
-- `event_sessions.guest_limit` is the host's own number, null when they have not
-- set one. A session holds the lower of that and its package's allowance.
--
-- The check is a trigger rather than a line in each join function because guests
-- arrive through more than one, and those have been rewritten several times. On the
-- table, a new way in cannot forget it.
--
-- Only NEW guests are refused. Someone already in keeps resuming on their existing
-- row, so lowering a limit, or this migration landing on an event that is already
-- over, never locks out a guest who has joined.

begin;

alter table public.event_sessions
  add column guest_limit integer,
  add constraint event_sessions_guest_limit_positive check (
    guest_limit is null or guest_limit > 0
  );

comment on column public.event_sessions.guest_limit is
  'The most guests the host wants at this session, or null for no limit of their own. '
  'The package''s `participant_limit` still applies: the lower of the two wins.';

-- The most guests a session can hold, or null when nothing limits it.
--
-- `least` ignores nulls, which is exactly the rule wanted here. A null
-- `participant_limit` is the established encoding for an unlimited package, and an
-- event with no grant at all has an unknown package, which is not refused: that
-- would lock guests out of an event because of a gap in our own records.
create function private.event_session_guest_capacity(p_event_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select least(
    s.guest_limit,
    (
      select (ce.value #>> '{}')::integer
      from public.celebration_entitlements ce
      where ce.celebration_id = s.celebration_id
        and ce.entitlement_key = 'participant_limit'
        and (ce.expires_at is null or ce.expires_at > now())
    )
  )
  from public.event_sessions s
  where s.id = p_event_session_id;
$$;

create function private.enforce_guest_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_joined integer;
begin
  -- Takes turns per session, so two guests arriving together for the last place
  -- cannot both count the room before either has taken it. `no key update` still
  -- lets everything that only references the session carry on.
  perform 1 from public.event_sessions where id = new.event_session_id for no key update;

  v_capacity := private.event_session_guest_capacity(new.event_session_id);
  if v_capacity is null then
    return new;
  end if;

  select count(*)::integer into v_joined
  from public.guest_sessions
  where event_session_id = new.event_session_id;

  if v_joined >= v_capacity then
    -- The app recognises this exact message to tell the guest the event is full.
    raise exception 'event_guest_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger guest_sessions_enforce_capacity
  before insert on public.guest_sessions
  for each row execute function private.enforce_guest_capacity();

commit;
