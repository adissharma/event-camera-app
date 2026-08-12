-- Temporary development rollout: enable video on every event session.
--
-- This keeps the UI flag and the server-side authorization model aligned while
-- we are testing video universally, before re-introducing package-specific
-- gating. Existing sessions gain `video`, and new rows default to photo+video.

update public.event_sessions
set allowed_media_types = (
  select array_agg(media_type order by media_type::text)
  from (
    select distinct media_type
    from unnest(
      coalesce(allowed_media_types, array['photo']::public.media_type[]) || array['video']::public.media_type[]
    ) as media_type
  ) as distinct_media_types
)
where not ('video' = any (coalesce(allowed_media_types, array['photo']::public.media_type[])));

alter table public.event_sessions
  alter column allowed_media_types
  set default array['photo', 'video']::public.media_type[];
