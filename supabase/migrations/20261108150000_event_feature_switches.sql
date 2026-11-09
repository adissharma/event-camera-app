-- Hosts can switch the Guestbook and videos off for an event.
--
-- A package says what an event *may* have. These say what the host actually
-- wants at it: a Stills+ host planning a photos-only evening should not have to
-- explain to guests why there is a video tab nobody is meant to use.
--
-- Both default to on, so every existing event carries on exactly as it was.
--
-- WHERE IT IS ENFORCED
-- --------------------
-- The app hides the controls, reading the switches through
-- `get_event_feature_switches`, because guests cannot read `celebrations`.
-- A guest on an old build, or one who was already filming when the host
-- switched it off, is refused by the trigger below, like the other media rules.

begin;

alter table public.celebrations
  add column guestbook_enabled boolean not null default true,
  add column videos_enabled boolean not null default true;

create function public.get_event_feature_switches(p_celebration_id uuid)
returns table (guestbook_enabled boolean, videos_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.guestbook_enabled, c.videos_enabled
  from public.celebrations c
  where c.id = p_celebration_id;
$$;

revoke all on function public.get_event_feature_switches(uuid) from public;
grant execute on function public.get_event_feature_switches(uuid) to authenticated, anon;

create function private.enforce_event_feature_switches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_guestbook boolean := coalesce(new.metadata ->> 'submission_kind', '') = 'guestbook';
  v_guestbook_enabled boolean;
  v_videos_enabled boolean;
begin
  -- Only guests are limited; a host adds what they like to their own event.
  if new.guest_session_id is null then
    return new;
  end if;
  if not v_is_guestbook and new.media_type <> 'video' then
    return new;
  end if;

  select c.guestbook_enabled, c.videos_enabled
    into v_guestbook_enabled, v_videos_enabled
  from public.event_sessions s
  join public.celebrations c on c.id = s.celebration_id
  where s.id = new.event_session_id;

  if v_is_guestbook then
    if v_guestbook_enabled is false then
      -- The app recognises this exact message.
      raise exception 'guestbook_messages_unavailable' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if v_videos_enabled is false then
    -- The app recognises this exact message.
    raise exception 'videos_turned_off' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger media_items_enforce_event_feature_switches
  before insert on public.media_items
  for each row execute function private.enforce_event_feature_switches();

commit;
