-- Free gets a taste of the premium features.
--
-- WHAT CHANGES
-- ------------
-- Free (`guests_5`) now includes:
--   * 10 photos per guest (was 20),
--   * 1 video per guest (was none),
--   * Challenges,
--   * the Guestbook page: guests can open its cover full screen, but only
--     Stills+ lets them record a message on it.
-- Small Event and Stills Lite are unchanged.
--
-- WHERE IT IS ENFORCED
-- --------------------
-- The plan's grants below are what the app reads. Two rules also need the
-- server, because a guest's upload is the one thing the app cannot be trusted
-- to hold back:
--   * how many videos a guest can post, and
--   * whether guests can post Guestbook messages at all.
-- Both are a trigger on `media_items`, like the camera-roll and guest limits,
-- so every way of adding media is covered. They key off the event's plan
-- (`celebration_plan_key`), and an event with no recorded plan is left as it
-- was rather than locked out.

begin;

-- ---------------------------------------------------------------------------
-- Free's grants
-- ---------------------------------------------------------------------------

update public.plans
   set description = 'Up to 5 guests, 10 photos and 1 video each, Challenges and a Guestbook page.',
       updated_at  = now()
 where key = 'guests_5';

update public.plan_entitlements pe
   set value = g.value
  from public.plans p,
       (values
         ('photo_limit_options', '[5, 10]'::jsonb),
         ('media_types',         '["photo", "video"]'::jsonb),
         ('challenges',          'true'::jsonb)
       ) as g(entitlement_key, value)
 where p.key = 'guests_5'
   and pe.plan_id = p.id
   and pe.entitlement_key = g.entitlement_key;

-- Events already published on Free take the same grants, so what they show
-- matches what new Free events get. `audio_guestbook` stays false: guests
-- still cannot record into the Guestbook on Free.
update public.celebration_entitlements ce
   set value = g.value
  from public.plans p,
       (values
         ('photo_limit_options', '[5, 10]'::jsonb),
         ('media_types',         '["photo", "video"]'::jsonb),
         ('challenges',          'true'::jsonb)
       ) as g(entitlement_key, value)
 where p.key = 'guests_5'
   and ce.granted_by_plan_id = p.id
   and ce.entitlement_key = g.entitlement_key;

-- ---------------------------------------------------------------------------
-- Videos per guest, and Guestbook messages
-- ---------------------------------------------------------------------------

create function private.enforce_plan_media_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_guestbook boolean := coalesce(new.metadata ->> 'submission_kind', '') = 'guestbook';
  v_celebration_id uuid;
  v_plan text;
  v_video_limit integer;
  v_videos_used integer;
begin
  -- Only guests are limited; a host adds what they like to their own event.
  if new.guest_session_id is null then
    return new;
  end if;
  if not v_is_guestbook and new.media_type <> 'video' then
    return new;
  end if;

  select celebration_id into v_celebration_id
  from public.event_sessions
  where id = new.event_session_id;

  v_plan := public.celebration_plan_key(v_celebration_id);
  if v_plan is null then
    return new;
  end if;

  if v_is_guestbook then
    if v_plan <> 'guests_unlimited' then
      -- The app recognises this exact message.
      raise exception 'guestbook_messages_unavailable' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Null means no limit.
  v_video_limit := case v_plan
    when 'guests_5' then 1
    when 'guests_25' then 0
    when 'guests_100' then 0
    else null
  end;
  if v_video_limit is null then
    return new;
  end if;

  select count(*)::integer into v_videos_used
  from public.media_items
  where guest_session_id = new.guest_session_id
    and media_type = 'video'
    and deleted_at is null
    and status <> 'permanent_failed'
    and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

  if v_videos_used >= v_video_limit then
    -- The app recognises this exact message.
    raise exception 'video_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger media_items_enforce_plan_media_rules
  before insert on public.media_items
  for each row execute function private.enforce_plan_media_rules();

commit;
