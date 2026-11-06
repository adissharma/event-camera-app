-- Give the host a reveal time of their own.
--
-- WHY
-- ---
-- Creation asks the host "When should photos be revealed to you?" and then when
-- guests should follow, but a session could only store one reveal: the guests'.
-- The host's answer was used to work out the guests' time and then thrown away,
-- and hosts saw every photo the moment it arrived. A host who chose to wait for
-- the surprise never got one.
--
-- WHAT
-- ----
-- `host_reveal_mode` and `host_reveal_at` hold the host's own answer, shaped like
-- `reveal_mode` and `reveal_at`. Both null means the session predates this, and
-- the host sees photos as they always have.
--
-- This is the host's own suspense, not access control: they can change it in
-- settings at any time, and media RLS is untouched. The app applies it.

begin;

alter table public.event_sessions
  add column host_reveal_mode public.reveal_mode,
  add column host_reveal_at timestamptz,
  -- A time exactly when the mode is scheduled. Written so that neither side can be
  -- null: a check that comes out null passes, so a time with no mode would slip by.
  add constraint event_sessions_host_reveal_at_matches_mode check (
    (host_reveal_mode is not distinct from 'scheduled') = (host_reveal_at is not null)
  );

comment on column public.event_sessions.host_reveal_mode is
  'When the host sees the photos, shaped like `reveal_mode` (which is the guests''). '
  'Null for sessions from before hosts had a time of their own: they see photos as they arrive.';

commit;
