-- Hosts can switch Challenges off for an event, like the Guestbook and videos.
--
-- Off means the event page shows no challenges at all: guests see no prompts,
-- and the host no longer sees the suggestions to add some. Challenges already
-- added are kept, so switching it back on brings them straight back.
--
-- Defaults to on, so every existing event carries on exactly as it was.
--
-- `get_event_feature_switches` gains a column, which changes its return type,
-- so it is dropped and recreated. Older builds read the two columns they know
-- by name and are unaffected by the third.

begin;

alter table public.celebrations
  add column challenges_enabled boolean not null default true;

drop function public.get_event_feature_switches(uuid);

create function public.get_event_feature_switches(p_celebration_id uuid)
returns table (guestbook_enabled boolean, videos_enabled boolean, challenges_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.guestbook_enabled, c.videos_enabled, c.challenges_enabled
  from public.celebrations c
  where c.id = p_celebration_id;
$$;

revoke all on function public.get_event_feature_switches(uuid) from public;
grant execute on function public.get_event_feature_switches(uuid) to authenticated, anon;

commit;
