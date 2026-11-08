-- Hold guests to their package's camera-roll allowance.
--
-- WHY
-- ---
-- Every package promises a number of photos a guest can add from their camera
-- roll (`camera_roll_upload_limit`: 5, 10, 25, or 100 on Stills+), and each session
-- stores one, but no upload ever checked it. In practice camera-roll uploads were
-- unlimited on every package, up to the guest's overall photo allowance.
--
-- WHAT
-- ----
-- A trigger on `media_items`, like the guest limit's on `guest_sessions`, so every
-- way of adding media is covered rather than whichever function is current. Only a
-- guest's NEW camera-roll item is refused: photos taken in the app, host uploads and
-- anything already added are untouched, and a retried upload that already has its
-- row never reaches this. Failed uploads do not use up the allowance.

begin;

-- Every session was created with the default of 5, whatever its package, so the
-- check below would hold a Stills+ event to 5 too. Each session first takes its
-- package's allowance. Sessions with no grant keep what they have.
update public.event_sessions s
   set camera_roll_upload_limit = (ce.value #>> '{}')::integer
  from public.celebration_entitlements ce
 where ce.celebration_id = s.celebration_id
   and ce.entitlement_key = 'camera_roll_upload_limit'
   and jsonb_typeof(ce.value) = 'number'
   and (ce.expires_at is null or ce.expires_at > now())
   and s.camera_roll_upload_limit is distinct from (ce.value #>> '{}')::integer;

create function private.enforce_camera_roll_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if new.source <> 'library' or new.guest_session_id is null then
    return new;
  end if;

  select camera_roll_upload_limit into v_limit
  from public.event_sessions
  where id = new.event_session_id;

  if v_limit is null then
    return new;
  end if;

  select count(*)::integer into v_used
  from public.media_items
  where guest_session_id = new.guest_session_id
    and source = 'library'
    and deleted_at is null
    and status <> 'permanent_failed';

  if v_used >= v_limit then
    -- The app recognises this exact message to explain the limit to the guest.
    raise exception 'camera_roll_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger media_items_enforce_camera_roll_limit
  before insert on public.media_items
  for each row execute function private.enforce_camera_roll_limit();

commit;
