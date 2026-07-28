-- Row Level Security isolation tests.
--
-- Run with:  supabase test db
--
-- These assert the properties that actually matter for this product: one host
-- cannot see another host's celebration, a guest cannot be manufactured by a
-- client, and an anonymous request cannot enumerate anything private.
--
-- Everything runs inside a transaction that is rolled back, so the tests are
-- safe against a seeded local database.

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- Two unrelated hosts and one collaborator.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'host-a@example.com', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'host-b@example.com', '', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cohost@example.com', '', now(), now(), now());

-- The on_auth_user_created trigger has now given each user a profile and a
-- personal workspace. Assert that, because everything else depends on it.
select is(
  (select count(*)::int from public.workspaces w
   join public.workspace_members wm on wm.workspace_id = w.id
   where wm.user_id = '11111111-1111-1111-1111-111111111111' and w.kind = 'personal'),
  1,
  'a new user receives exactly one personal workspace'
);

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'a new user receives a profile row'
);

select is(
  (select role::text from public.workspace_members
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'owner',
  'the new user owns their personal workspace'
);

-- ---------------------------------------------------------------------------
-- Atomic creation
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$select public.create_celebration_with_default_session(
      'Host A Celebration', 'Reception', 'wedding', 'universal',
      'Europe/London', now() + interval '7 days'
    )$$,
  'a host can create a celebration atomically'
);

-- Capture the ids for later assertions.
create temporary table t_ids as
select
  (select id from public.celebrations where title = 'Host A Celebration') as celebration_id,
  (select es.id from public.event_sessions es
   join public.celebrations c on c.id = es.celebration_id
   where c.title = 'Host A Celebration') as event_session_id;

select isnt(
  (select celebration_id from t_ids), null,
  'the celebration row exists'
);

select isnt(
  (select event_session_id from t_ids), null,
  'the default event session was created in the same operation'
);

select is(
  (select count(*)::int from public.access_links
   where event_session_id = (select event_session_id from t_ids)),
  1,
  'exactly one guest access link was created'
);

select is(
  (select count(*)::int from public.celebration_collaborators
   where celebration_id = (select celebration_id from t_ids) and role = 'owner'),
  1,
  'the owner collaborator row was created'
);

select is(
  (select sequence_number from public.event_sessions
   where id = (select event_session_id from t_ids)),
  1,
  'the default session is sequence 1'
);

-- A scheduled reveal with no explicit time defaults to 12 hours after close.
select is(
  (select reveal_at from public.event_sessions where id = (select event_session_id from t_ids)),
  (select ends_at + interval '12 hours' from public.event_sessions
   where id = (select event_session_id from t_ids)),
  'a scheduled reveal defaults to 12 hours after the event closes'
);

-- The access token must not be recoverable from the database.
select ok(
  (select octet_length(token_hash) = 32 from public.access_links
   where event_session_id = (select event_session_id from t_ids)),
  'the access link stores a 32-byte digest, not a plaintext token'
);

-- ---------------------------------------------------------------------------
-- Cross-user isolation — the central property
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.celebrations
   where id = (select celebration_id from t_ids)),
  0,
  'host B cannot see host A''s celebration'
);

select is(
  (select count(*)::int from public.event_sessions
   where id = (select event_session_id from t_ids)),
  0,
  'host B cannot see host A''s event session'
);

select is(
  (select count(*)::int from public.access_links
   where event_session_id = (select event_session_id from t_ids)),
  0,
  'host B cannot see host A''s access links'
);

select is(
  (select count(*)::int from public.workspaces
   where created_by = '11111111-1111-1111-1111-111111111111'),
  0,
  'host B cannot see host A''s workspace'
);

-- An update aimed at another host's row must affect nothing.
update public.celebrations set title = 'Hijacked'
where id = (select celebration_id from t_ids);

select is(
  (select count(*)::int from public.celebrations where title = 'Hijacked'),
  0,
  'host B cannot rename host A''s celebration'
);

-- Nor may host B create a celebration inside host A's workspace.
select throws_ok(
  format(
    $$insert into public.celebrations (workspace_id, created_by, title, public_slug)
      values (%L, '22222222-2222-2222-2222-222222222222', 'Intruder', %L)$$,
    (select w.id from public.workspaces w
     join public.workspace_members wm on wm.workspace_id = w.id
     where wm.user_id = '11111111-1111-1111-1111-111111111111' limit 1),
    encode(extensions.gen_random_bytes(16), 'hex')
  ),
  '42501',
  null,
  'host B cannot create a celebration inside host A''s workspace'
);

-- ---------------------------------------------------------------------------
-- Collaborator access
-- ---------------------------------------------------------------------------

set local role postgres;
insert into public.celebration_collaborators (celebration_id, user_id, role, invited_at, accepted_at)
values (
  (select celebration_id from t_ids),
  '33333333-3333-3333-3333-333333333333',
  'cohost', now(), now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  (select count(*)::int from public.celebrations
   where id = (select celebration_id from t_ids)),
  1,
  'an accepted co-host can see the celebration'
);

select is(
  (select count(*)::int from public.event_sessions
   where id = (select event_session_id from t_ids)),
  1,
  'an accepted co-host can see the event session'
);

-- A revoked collaborator loses access immediately.
set local role postgres;
update public.celebration_collaborators set revoked_at = now()
where celebration_id = (select celebration_id from t_ids)
  and user_id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  (select count(*)::int from public.celebrations
   where id = (select celebration_id from t_ids)),
  0,
  'a revoked co-host immediately loses access'
);

-- ---------------------------------------------------------------------------
-- Anonymous access
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

-- These assert `throws_ok`, not "returns zero rows", and the distinction is the
-- point. Anonymous access is denied at the PRIVILEGE layer (42501) before RLS is
-- ever consulted, so the query is refused outright rather than filtered to
-- nothing. That is the stronger of the two guarantees: a policy added by mistake
-- later still cannot expose these tables to anon.
--
-- An earlier version of this suite asserted a zero count, and passed on the
-- hosted project purely because the implicit default grants there let the query
-- run and RLS filter it. The privilege denial is what we actually want.

select throws_ok(
  'select count(*) from public.celebrations',
  '42501',
  null,
  'anonymous requests are refused celebrations at the privilege layer'
);

select throws_ok(
  'select count(*) from public.guest_sessions',
  '42501',
  null,
  'anonymous requests are refused guest sessions at the privilege layer'
);

select throws_ok(
  'select count(*) from public.access_links',
  '42501',
  null,
  'anonymous requests are refused access links at the privilege layer'
);

-- The catalogue is deliberately public — it contains no user data and the guest
-- web experience needs it before any identity exists.
select ok(
  (select count(*) from public.themes) >= 0,
  'anonymous requests may read the theme catalogue'
);

select * from finish();

rollback;
