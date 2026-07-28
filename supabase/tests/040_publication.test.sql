-- Publication.
--
-- The property that matters: publishing twice must produce one published event,
-- one access link and one set of entitlements. A host on a bad connection who
-- taps "Create my event" twice, or whose request times out after the server
-- committed, is the normal case — not an edge case.

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('eeee0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'publisher@test.local', '', now(), now(), now()),
  ('eeee0000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000001","role":"authenticated"}';

create temporary table created as
select * from public.create_celebration_with_default_session(
  'Publication Fixture', 'Reception', 'wedding', 'universal',
  'Europe/London', now() + interval '2 days'
);

-- ---------------------------------------------------------------------------
-- Preconditions
-- ---------------------------------------------------------------------------

select is(
  (select status::text from public.celebrations where id = (select celebration_id from created)),
  'draft',
  'a newly created celebration starts as a draft'
);

select is(
  (select count(*)::int from public.celebration_entitlements
   where celebration_id = (select celebration_id from created)),
  0,
  'no entitlements are active before publication'
);

-- ---------------------------------------------------------------------------
-- Publish
-- ---------------------------------------------------------------------------

create temporary table published_first as
select * from public.publish_celebration((select celebration_id from created), 'signature');

select is(
  (select was_already_published from published_first), false,
  'the first publish reports a fresh publication'
);

select is(
  (select status::text from public.celebrations where id = (select celebration_id from created)),
  'published',
  'the celebration is published'
);

select is(
  (select status::text from public.event_sessions where id = (select event_session_id from created)),
  'published',
  'the event session is published'
);

select isnt(
  (select published_at from public.celebrations where id = (select celebration_id from created)),
  null,
  'published_at is recorded'
);

-- Entitlements come from the plan, not from the client.
select ok(
  (select count(*) from public.celebration_entitlements
   where celebration_id = (select celebration_id from created)) > 0,
  'the plan''s entitlements are activated'
);

select is(
  (select value from public.celebration_entitlements
   where celebration_id = (select celebration_id from created)
     and entitlement_key = 'unlimited_photos'),
  'true'::jsonb,
  'Signature grants unlimited photos'
);

select isnt(
  (select granted_by_plan_id from public.celebration_entitlements
   where celebration_id = (select celebration_id from created)
     and entitlement_key = 'unlimited_photos'),
  null,
  'provenance is recorded, so a refund can be traced to what it paid for'
);

-- ---------------------------------------------------------------------------
-- IDEMPOTENCY — the whole point
-- ---------------------------------------------------------------------------

create temporary table published_again as
select * from public.publish_celebration((select celebration_id from created), 'signature');

select is(
  (select was_already_published from published_again), true,
  'publishing again reports it was already published rather than erroring'
);

select is(
  (select celebration_id from published_again),
  (select celebration_id from created),
  'publishing again returns the same celebration'
);

select is(
  (select public_slug from published_again),
  (select public_slug from created),
  'the guest link does not change on a second publish — printed QR codes stay valid'
);

select is(
  (select count(*)::int from public.access_links
   where event_session_id = (select event_session_id from created)),
  1,
  'a second publish does not mint a second access link'
);

select is(
  (select count(*)::int from public.purchases
   where celebration_id = (select celebration_id from created)),
  1,
  'a second publish does not create a second purchase — the customer is not double-charged'
);

-- ---------------------------------------------------------------------------
-- Authorisation
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  format($$select public.publish_celebration(%L, 'signature')$$,
    (select celebration_id from created)),
  '42501', null,
  'a stranger cannot publish someone else''s event'
);

-- ---------------------------------------------------------------------------
-- Refusing to publish something unusable
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000001","role":"authenticated"}';

create temporary table no_close as
select * from public.create_celebration_with_default_session(
  'No Closing Time', 'Main event', 'party', 'universal', 'Europe/London', null
);

select throws_ok(
  format($$select public.publish_celebration(%L, 'essential')$$,
    (select celebration_id from no_close)),
  '22023', null,
  'an event with no closing time cannot be published'
);

select * from finish();

rollback;
