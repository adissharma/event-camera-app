-- Package enforcement.
--
-- The properties that matter: a feature a package does not include cannot be had
-- by calling the API directly, whichever way in is used. And nothing here takes
-- away what an event already has: a limit it already holds, media it already has,
-- an upload it already started, or a feature a verified purchase gave it.

begin;

create extension if not exists pgtap with schema extensions;

select plan(65);

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- The packages are restated here rather than read from seed.sql, which still
-- carries the old guest ladder. These values match 20260901120000.
-- ---------------------------------------------------------------------------

insert into public.entitlement_definitions (key, name, value_kind, default_value)
values
  ('unlimited_photos', 'Unlimited photos', 'boolean', 'false'),
  ('photo_limit_options', 'Photo limit options', 'integer_array', '[5, 10, 15]'),
  ('media_types', 'Contribution formats', 'string_array', '["photo"]'),
  ('audio_guestbook', 'Audio Guestbook', 'boolean', 'false')
on conflict (key) do nothing;

update public.plans set is_active = false;

insert into public.plans (key, name, tier_rank, price_minor_units, currency, is_active)
values
  ('guests_5', 'Free', 1, 0, 'GBP', true),
  ('guests_25', 'Small Event', 2, 1499, 'GBP', true),
  ('guests_100', 'Stills Lite', 3, 2999, 'GBP', true),
  ('guests_unlimited', 'Stills+', 4, 4999, 'GBP', true)
on conflict (key) do update
  set tier_rank = excluded.tier_rank,
      price_minor_units = excluded.price_minor_units,
      is_active = true;

delete from public.plan_entitlements
where plan_id in (select id from public.plans where is_active);

insert into public.plan_entitlements (plan_id, entitlement_key, value)
select p.id, g.entitlement_key, g.value::jsonb
from public.plans p
join (
  values
    ('guests_5',         'unlimited_photos',    'false'),
    ('guests_5',         'photo_limit_options', '[5, 10, 15, 20]'),
    ('guests_5',         'media_types',         '["photo"]'),
    ('guests_5',         'audio_guestbook',     'false'),
    ('guests_5',         'challenges',          'false'),
    ('guests_25',        'unlimited_photos',    'false'),
    ('guests_25',        'photo_limit_options', '[5, 10, 15, 20]'),
    ('guests_25',        'media_types',         '["photo"]'),
    ('guests_25',        'audio_guestbook',     'false'),
    ('guests_25',        'challenges',          'false'),
    ('guests_100',       'unlimited_photos',    'false'),
    ('guests_100',       'photo_limit_options', '[5, 10, 15, 20, 25]'),
    ('guests_100',       'media_types',         '["photo"]'),
    ('guests_100',       'audio_guestbook',     'false'),
    ('guests_100',       'challenges',          'false'),
    ('guests_unlimited', 'unlimited_photos',    'true'),
    ('guests_unlimited', 'photo_limit_options', '[5, 10, 15, 20, 25]'),
    ('guests_unlimited', 'media_types',         '["photo", "video"]'),
    ('guests_unlimited', 'audio_guestbook',     'true'),
    ('guests_unlimited', 'challenges',          'true')
) as g(plan_key, entitlement_key, value) on g.plan_key = p.key;

insert into public.add_ons (key, name, price_minor_units, currency, is_active)
values ('media_bundle', 'Media Bundle', 1500, 'GBP', true)
on conflict (key) do update set is_active = true;

insert into public.add_on_entitlements (add_on_id, entitlement_key, value)
select a.id, g.entitlement_key, g.value::jsonb
from public.add_ons a
cross join (
  values ('audio_guestbook', 'true'), ('media_types', '["photo", "video"]')
) as g(entitlement_key, value)
where a.key = 'media_bundle'
on conflict (add_on_id, entitlement_key) do update set value = excluded.value;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('ffff0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'package-host@test.local', '', now(), now(), now());

create function pg_temp.new_event(p_shot_limit integer default 20)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select celebration_id into v_id from public.create_celebration_with_default_session(
    'Package Fixture', 'Main event', 'wedding', 'universal', 'Europe/London', now() + interval '2 days',
    p_shot_limit_per_guest => p_shot_limit,
    -- Always photo and video, as the app sends for every draft.
    p_allowed_media_types => array['photo', 'video']::public.media_type[]
  );
  return v_id;
end;
$$;

create function pg_temp.session_of(p_celebration_id uuid)
returns uuid
language sql
stable
as $$
  select id from public.event_sessions where celebration_id = p_celebration_id;
$$;

create function pg_temp.limit_of(p_celebration_id uuid)
returns integer
language sql
stable
as $$
  select shot_limit_per_guest from public.event_sessions where celebration_id = p_celebration_id;
$$;

create function pg_temp.code_of(p_celebration_id uuid)
returns text
language sql
stable
as $$
  select event_code from public.celebrations where id = p_celebration_id;
$$;

-- Publishes on a paid plan and verifies it, as the store webhook would.
create function pg_temp.publish_paid(p_celebration_id uuid, p_plan_key text)
returns void
language plpgsql
as $$
declare
  v_txn text := 'txn-' || p_celebration_id::text;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  perform public.publish_celebration(
    p_celebration_id, p_plan_key, array[]::text[], 'apple_app_store', null, v_txn
  );
  reset role;
  perform private.activate_verified_purchase('apple_app_store', v_txn);
  set local role authenticated;
  perform set_config('request.jwt.claims', v_claims, true);
end;
$$;

-- A guest needs a row and a token. Written directly: joining is not under test.
create function pg_temp.add_guest(p_celebration_id uuid, p_token text)
returns void
language plpgsql
as $$
begin
  reset role;
  insert into public.guest_sessions (event_session_id, anonymous_token_hash)
  values (pg_temp.session_of(p_celebration_id), private.digest_token(p_token));
  set local role authenticated;
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"ffff0000-0000-0000-0000-000000000001","role":"authenticated"}';

create temporary table events (name text primary key, id uuid);
insert into events values
  ('free', pg_temp.new_event()),
  ('plus', pg_temp.new_event()),
  ('lost_plus', pg_temp.new_event());

select public.publish_celebration((select id from events where name = 'free'), 'guests_5');
select pg_temp.publish_paid((select id from events where name = 'plus'), 'guests_unlimited');
select pg_temp.publish_paid((select id from events where name = 'lost_plus'), 'guests_unlimited');

select pg_temp.add_guest((select id from events where name = 'free'), 'free-guest');
select pg_temp.add_guest((select id from events where name = 'plus'), 'plus-guest');
select pg_temp.add_guest((select id from events where name = 'lost_plus'), 'lost-guest');

-- ---------------------------------------------------------------------------
-- Video
-- ---------------------------------------------------------------------------

select is(
  (select allowed_media_types::text[] from public.event_sessions where id = pg_temp.session_of((select id from events where name = 'free'))),
  array['photo'],
  'allowed_media_types reflects the package once there is one, whatever the draft sent'
);

select ok(
  (select 'video' = any (allowed_media_types) from public.event_sessions where id = pg_temp.session_of((select id from events where name = 'plus'))),
  'a package with video has it in allowed_media_types'
);

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'video', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  '42501', null,
  'a guest cannot add video to an event without it'
);

select throws_ok(
  format($$select public.create_host_media_upload_intent(%L, gen_random_uuid(), 'video', 'camera', 'video/mp4')$$,
    (select id from events where name = 'free')),
  '42501', null,
  'a host cannot add video to an event without it'
);

select throws_ok(
  format($$select public.create_media_upload_intent(%L, gen_random_uuid(), 'video', 'camera', 'video/mp4', 1000, 'free-guest')$$,
    pg_temp.session_of((select id from events where name = 'free'))),
  '42501', null,
  'the older upload function cannot add video either'
);

-- The column alone must not decide it: a manager can write that column directly.
update public.event_sessions
  set allowed_media_types = array['photo', 'video']::public.media_type[]
  where id = pg_temp.session_of((select id from events where name = 'free'));

select is(
  (select 'video' = any (allowed_media_types) from public.event_sessions where id = pg_temp.session_of((select id from events where name = 'free'))),
  true,
  'precondition: a manager has written video into the column'
);

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'video', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  '42501', 'this event does not allow this media type',
  'writing the column does not buy video: the grant decides'
);

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'photo', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  '42501', null,
  'a video cannot be smuggled in labelled as a photo'
);

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'video', 'camera', 'video/mp4', 1000, now(), '{"submission_kind":"guestbook"}')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  '42501', null,
  'a guestbook tag does not get a video past the check'
);

select lives_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'photo', 'camera', 'image/jpeg')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  'photos are still fine on the free package'
);

select lives_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'plus-guest', gen_random_uuid(), 'video', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'plus'))),
  'a guest can add video on a package that includes it'
);

select lives_ok(
  format($$select public.create_host_media_upload_intent(%L, gen_random_uuid(), 'video', 'camera', 'video/mp4')$$,
    (select id from events where name = 'plus')),
  'a host can add video on a package that includes it'
);

-- An upgrade has to reach the column the upload functions still check.
insert into events values ('upgraded', pg_temp.new_event());
select public.publish_celebration((select id from events where name = 'upgraded'), 'guests_5');
select pg_temp.add_guest((select id from events where name = 'upgraded'), 'upgraded-guest');

reset role;
select public.upgrade_celebration_plan((select id from events where name = 'upgraded'), 'guests_unlimited', null, 'txn-upgrade', 'apple_app_store')
  from (select set_config('request.jwt.claims', '{"sub":"ffff0000-0000-0000-0000-000000000001","role":"authenticated"}', true)) as claims;
select public.activate_verified_purchase('apple_app_store', 'txn-upgrade');
set local role authenticated;

select ok(
  (select 'video' = any (allowed_media_types) from public.event_sessions where id = pg_temp.session_of((select id from events where name = 'upgraded'))),
  'an upgrade brings video into allowed_media_types'
);

select lives_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'upgraded-guest', gen_random_uuid(), 'video', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'upgraded'))),
  'an upgraded event accepts video straight away'
);

-- ---------------------------------------------------------------------------
-- Photo allowance
-- ---------------------------------------------------------------------------

insert into events values
  ('draft_unlimited', pg_temp.new_event(null)),
  ('draft_36', pg_temp.new_event(36)),
  ('plus_unlimited', pg_temp.new_event(null)),
  ('plus_36', pg_temp.new_event(36));

select is(pg_temp.limit_of((select id from events where name = 'draft_unlimited')), null::integer,
  'a draft may ask for unlimited: it has no package to check against yet');
select is(pg_temp.limit_of((select id from events where name = 'draft_36')), 36,
  'a draft may ask for more than the cheapest package');

select public.publish_celebration((select id from events where name = 'draft_unlimited'), 'guests_5');
select pg_temp.publish_paid((select id from events where name = 'draft_36'), 'guests_25');
select pg_temp.publish_paid((select id from events where name = 'plus_unlimited'), 'guests_unlimited');
select pg_temp.publish_paid((select id from events where name = 'plus_36'), 'guests_unlimited');

select is(pg_temp.limit_of((select id from events where name = 'draft_unlimited')), 20,
  'publishing on Free brings unlimited down to what Free allows');
select is(pg_temp.limit_of((select id from events where name = 'draft_36')), 20,
  'verifying Small Event brings 36 down to what it allows');
select is(pg_temp.limit_of((select id from events where name = 'plus_unlimited')), null::integer,
  'Stills+ keeps the unlimited the draft asked for');
select is(pg_temp.limit_of((select id from events where name = 'plus_36')), 36,
  'Stills+ keeps a number the draft asked for');

select throws_ok(
  format($$update public.event_sessions set shot_limit_per_guest = null where celebration_id = %L$$,
    (select id from events where name = 'free')),
  '42501', null,
  'a host cannot set unlimited on the free package by writing to the table'
);

select throws_ok(
  format($$update public.event_sessions set shot_limit_per_guest = 36 where celebration_id = %L$$,
    (select id from events where name = 'free')),
  '42501', null,
  'a host cannot raise the limit past the package'
);

select lives_ok(
  format($$update public.event_sessions set shot_limit_per_guest = 16 where celebration_id = %L$$,
    (select id from events where name = 'free')),
  'a value the app offers but the options list does not name is fine under the ceiling'
);

select lives_ok(
  format($$update public.event_sessions set shot_limit_per_guest = 20 where celebration_id = %L$$,
    (select id from events where name = 'free')),
  'a host can raise the limit up to the ceiling'
);

select lives_ok(
  format($$update public.event_sessions set shot_limit_per_guest = null where celebration_id = %L$$,
    (select id from events where name = 'plus')),
  'Stills+ can set unlimited'
);

select throws_ok(
  format($$insert into public.event_sessions (celebration_id, name, sequence_number, shot_limit_per_guest) values (%L, 'Second', 2, null)$$,
    (select id from events where name = 'free')),
  '42501', null,
  'a new session on a published event is checked too'
);

-- An existing event holding more than its package: built by giving an event 36 on
-- Stills+ and then rewriting its grants to Small Event's, which is what such an
-- event looks like after 20260901120000.
insert into events values ('over_limit', pg_temp.new_event(36));
select pg_temp.publish_paid((select id from events where name = 'over_limit'), 'guests_unlimited');

reset role;
update public.celebration_entitlements ce
  set value = pe.value, granted_by_plan_id = pe.plan_id
  from public.plan_entitlements pe
  join public.plans p on p.id = pe.plan_id and p.key = 'guests_25'
  where ce.celebration_id = (select id from events where name = 'over_limit')
    and ce.entitlement_key = pe.entitlement_key;
set local role authenticated;

select lives_ok(
  format($$update public.event_sessions set name = 'Renamed', shot_limit_per_guest = 36 where celebration_id = %L$$,
    (select id from events where name = 'over_limit')),
  'saving an event that holds more than its package does not fail'
);

select is(pg_temp.limit_of((select id from events where name = 'over_limit')), 36,
  'an existing limit above the package is kept');

reset role;
select public.upgrade_celebration_plan((select id from events where name = 'over_limit'), 'guests_100', null, 'txn-over', 'apple_app_store')
  from (select set_config('request.jwt.claims', '{"sub":"ffff0000-0000-0000-0000-000000000001","role":"authenticated"}', true)) as claims;
select public.activate_verified_purchase('apple_app_store', 'txn-over');
set local role authenticated;

select is(pg_temp.limit_of((select id from events where name = 'over_limit')), 36,
  'upgrading to a package whose ceiling is still lower does not take the limit away');

select lives_ok(
  format($$update public.event_sessions set shot_limit_per_guest = 30 where celebration_id = %L$$,
    (select id from events where name = 'over_limit')),
  'an over-limit event may still lower its limit'
);

select throws_ok(
  format($$update public.event_sessions set shot_limit_per_guest = 36 where celebration_id = %L$$,
    (select id from events where name = 'over_limit')),
  '42501', null,
  'but cannot raise it again past the package'
);

-- ---------------------------------------------------------------------------
-- No package at all
-- ---------------------------------------------------------------------------

-- A purchase that never verifies leaves a published event with no grants.
insert into events values ('unverified', pg_temp.new_event(null));
select public.publish_celebration(
  (select id from events where name = 'unverified'), 'guests_unlimited', array[]::text[],
  'apple_app_store', null, 'txn-never-verified'
);
select pg_temp.add_guest((select id from events where name = 'unverified'), 'unverified-guest');

select is(
  (select count(*)::int from public.celebration_entitlements where celebration_id = (select id from events where name = 'unverified')),
  0,
  'precondition: an unverified purchase granted nothing'
);

select is(pg_temp.limit_of((select id from events where name = 'unverified')), null::integer,
  'its limit is left alone, in case the purchase is real and still on its way');

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'unverified-guest', gen_random_uuid(), 'video', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'unverified'))),
  '42501', null,
  'no package means no video'
);

reset role;
insert into public.media_items (event_session_id, guest_session_id, client_media_id, media_type, source, status)
select
  pg_temp.session_of((select id from events where name = 'unverified')),
  (select id from public.guest_sessions where event_session_id = pg_temp.session_of((select id from events where name = 'unverified'))),
  gen_random_uuid(), 'photo', 'camera', 'queued'
from generate_series(1, 20);
set local role authenticated;

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'unverified-guest', gen_random_uuid(), 'photo', 'camera', 'image/jpeg')$$,
    pg_temp.code_of((select id from events where name = 'unverified'))),
  '42501', 'shot limit reached',
  'its guests stop at the lowest package''s allowance, so not paying is not unlimited'
);

reset role;
update public.celebrations
  set published_at = (
    select (value #>> '{}')::timestamptz - interval '1 day'
    from private.app_settings where key = 'package_enforcement_started_at'
  )
  where id = (select id from events where name = 'unverified');
set local role authenticated;

select lives_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'unverified-guest', gen_random_uuid(), 'photo', 'camera', 'image/jpeg')$$,
    pg_temp.code_of((select id from events where name = 'unverified'))),
  'an event published before enforcement began is not capped'
);

-- ---------------------------------------------------------------------------
-- Guestbook
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select public.upsert_event_guestbook(%L, 'Say hello')$$, (select id from events where name = 'free')),
  '42501', null,
  'guestbook settings cannot be saved without the feature'
);

select throws_ok(
  format($$insert into public.event_guestbooks (celebration_id) values (%L)$$, (select id from events where name = 'free')),
  '42501', null,
  'nor by writing to the table'
);

select lives_ok(
  format($$select public.upsert_event_guestbook(%L, 'Say hello')$$, (select id from events where name = 'plus')),
  'guestbook settings save on a package that includes it'
);

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'audio', 'recording', 'audio/mp4', 1000, now(), '{"submission_kind":"guestbook"}')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  '42501', null,
  'a guest cannot leave a guestbook message without the feature'
);

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'photo', 'camera', 'image/jpeg', 1000, now(), '{"submission_kind":"guestbook"}')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  '42501', null,
  'nor use the tag to dodge the shot limit with a photo'
);

select lives_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'plus-guest', gen_random_uuid(), 'audio', 'recording', 'audio/mp4', 1000, now(), '{"submission_kind":"guestbook"}')$$,
    pg_temp.code_of((select id from events where name = 'plus'))),
  'a guest can leave a guestbook message on a package that includes it'
);

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------

select is(
  public.seed_event_challenges_if_empty((select id from events where name = 'free'), '[{"label":"Dance","icon":"x"}]') -> 'challenges',
  '[]'::jsonb,
  'seeding without the feature adds nothing, and does not raise: the app reads a refusal as "not the host"'
);

select throws_ok(
  format($$insert into public.event_challenges (celebration_id, label, icon) values (%L, 'Dance', 'x')$$,
    (select id from events where name = 'free')),
  '42501', null,
  'a challenge cannot be added by writing to the table'
);

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'free-guest', gen_random_uuid(), 'photo', 'camera', 'image/jpeg', 1000, now(), '{"submission_kind":"challenge"}')$$,
    pg_temp.code_of((select id from events where name = 'free'))),
  '42501', null,
  'a guest cannot submit to a challenge without the feature'
);

select is(
  jsonb_array_length(public.seed_event_challenges_if_empty((select id from events where name = 'plus'), '[{"label":"Dance","icon":"x"}]') -> 'challenges'),
  1,
  'seeding works on a package that includes it'
);

select lives_ok(
  format($$insert into public.event_challenges (celebration_id, label, icon) values (%L, 'Toast', 'y')$$,
    (select id from events where name = 'plus')),
  'a host can add a challenge on a package that includes it'
);

select lives_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'plus-guest', gen_random_uuid(), 'photo', 'camera', 'image/jpeg', 1000, now(), '{"submission_kind":"challenge"}')$$,
    pg_temp.code_of((select id from events where name = 'plus'))),
  'a guest can submit to a challenge on a package that includes it'
);

select is(
  jsonb_array_length(public.get_guest_challenges(pg_temp.code_of((select id from events where name = 'plus')), 'plus-guest') -> 'challenges'),
  2,
  'guests read the list on a package that includes it'
);

-- ---------------------------------------------------------------------------
-- What an event already has stays
--
-- `lost_plus` gathers media, messages and challenges on Stills+, then has its
-- grants rewritten to Free's: an event whose existing content predates its package.
-- ---------------------------------------------------------------------------

create temporary table lost_media as
select
  public.create_guest_media_upload_intent(
    pg_temp.code_of((select id from events where name = 'lost_plus')), 'lost-guest',
    'aaaa0000-0000-4000-8000-000000000001', 'video', 'camera', 'video/mp4'
  ) as video,
  public.create_guest_media_upload_intent(
    pg_temp.code_of((select id from events where name = 'lost_plus')), 'lost-guest',
    'aaaa0000-0000-4000-8000-000000000002', 'audio', 'recording', 'audio/mp4', 1000, now(), '{"submission_kind":"guestbook"}'
  ) as message,
  public.create_guest_media_upload_intent(
    pg_temp.code_of((select id from events where name = 'lost_plus')), 'lost-guest',
    'aaaa0000-0000-4000-8000-000000000003', 'photo', 'camera', 'image/jpeg'
  ) as photo;

insert into public.event_challenges (celebration_id, label, icon)
values
  ((select id from events where name = 'lost_plus'), 'Keep', 'x'),
  ((select id from events where name = 'lost_plus'), 'Remove', 'y');

reset role;
update public.media_items set status = 'ready', original_storage_path = id::text
where event_session_id = pg_temp.session_of((select id from events where name = 'lost_plus'));

update public.celebration_entitlements ce
  set value = pe.value, granted_by_plan_id = pe.plan_id
  from public.plan_entitlements pe
  join public.plans p on p.id = pe.plan_id and p.key = 'guests_5'
  where ce.celebration_id = (select id from events where name = 'lost_plus')
    and ce.entitlement_key = pe.entitlement_key;
set local role authenticated;

select is(
  (select count(*)::int from public.media_items
   where event_session_id = pg_temp.session_of((select id from events where name = 'lost_plus'))
     and status = 'ready' and deleted_at is null),
  3,
  'media already uploaded stays when a package no longer includes it'
);

select is(
  jsonb_array_length(public.get_host_guestbook((select id from events where name = 'lost_plus')) -> 'messages'),
  1,
  'a host can still read guestbook messages already left'
);

select is(
  jsonb_array_length(public.get_guest_guestbook(pg_temp.code_of((select id from events where name = 'lost_plus')), 'lost-guest') -> 'messages'),
  1,
  'a guest can still read the message they left'
);

-- The migration leaves a session's column alone while a video is on its way, because
-- the upload functions read it first. Put it back to what that session would hold.
reset role;
update public.event_sessions
  set allowed_media_types = array['photo', 'video']::public.media_type[]
  where id = pg_temp.session_of((select id from events where name = 'lost_plus'));
set local role authenticated;

select lives_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'lost-guest', 'aaaa0000-0000-4000-8000-000000000001', 'video', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'lost_plus'))),
  'an upload already accepted can still be retried'
);

-- With a live intent the function just hands that back. Without one, it rewrites
-- the row's media type, which is the write that has to be stopped.
reset role;
update public.upload_intents set cancelled_at = now()
where media_item_id = (select id from public.media_items where client_media_id = 'aaaa0000-0000-4000-8000-000000000003');
set local role authenticated;

select throws_ok(
  format($$select public.create_guest_media_upload_intent(%L, 'lost-guest', 'aaaa0000-0000-4000-8000-000000000003', 'video', 'camera', 'video/mp4')$$,
    pg_temp.code_of((select id from events where name = 'lost_plus'))),
  '42501', null,
  'but a retry cannot turn an accepted photo into a video'
);

select lives_ok(
  format($$update public.media_items set is_pinned = true where client_media_id = 'aaaa0000-0000-4000-8000-000000000001'$$),
  'a host can still manage media already uploaded'
);

select is(
  (select count(*)::int from public.event_challenges
   where celebration_id = (select id from events where name = 'lost_plus') and deleted_at is null),
  2,
  'a host can still see challenges already written'
);

select throws_ok(
  format($$update public.event_challenges set label = 'Edited' where label = 'Keep' and celebration_id = %L$$,
    (select id from events where name = 'lost_plus')),
  '42501', null,
  'but cannot edit them on a package without the feature'
);

select lives_ok(
  format($$update public.event_challenges set deleted_at = now() where label = 'Remove' and celebration_id = %L$$,
    (select id from events where name = 'lost_plus')),
  'and can always clear one away'
);

select is(
  (select deleted_at is not null from public.event_challenges
   where label = 'Remove' and celebration_id = (select id from events where name = 'lost_plus')),
  true,
  'the soft delete took effect'
);

select throws_ok(
  format($$update public.event_challenges set deleted_at = null where label = 'Remove' and celebration_id = %L$$,
    (select id from events where name = 'lost_plus')),
  '42501', null,
  'but cannot restore one, which would be adding it back'
);

select is(
  public.get_guest_challenges(pg_temp.code_of((select id from events where name = 'lost_plus')), 'lost-guest') -> 'challenges',
  '[]'::jsonb,
  'guests are not shown prompts they could not answer'
);

-- ---------------------------------------------------------------------------
-- Add-ons
-- ---------------------------------------------------------------------------

-- A Media Bundle has to survive buying a bigger plan, because a plan's grants
-- overwrite by key and every plan carries these two.
insert into events values ('bundle', pg_temp.new_event());
select pg_temp.publish_paid((select id from events where name = 'bundle'), 'guests_25');

reset role;
insert into public.purchases (
  celebration_id, platform, platform_product_id, platform_transaction_id, add_on_id, status, verified_at
)
select (select id from events where name = 'bundle'), 'apple_app_store', 'bundle', 'txn-bundle', a.id, 'pending', null
from public.add_ons a where a.key = 'media_bundle';
select public.activate_verified_purchase('apple_app_store', 'txn-bundle');

select ok(
  (select 'video' = any (allowed_media_types) from public.event_sessions where id = pg_temp.session_of((select id from events where name = 'bundle'))),
  'an add-on that grants video reaches allowed_media_types'
);

select public.upgrade_celebration_plan((select id from events where name = 'bundle'), 'guests_100', null, 'txn-bundle-upgrade', 'apple_app_store')
  from (select set_config('request.jwt.claims', '{"sub":"ffff0000-0000-0000-0000-000000000001","role":"authenticated"}', true)) as claims;
select public.activate_verified_purchase('apple_app_store', 'txn-bundle-upgrade');
set local role authenticated;

select ok(
  (select 'video' = any (allowed_media_types) from public.event_sessions where id = pg_temp.session_of((select id from events where name = 'bundle'))),
  'upgrading the plan does not take back an add-on''s video'
);

select is(
  (select value from public.celebration_entitlements
   where celebration_id = (select id from events where name = 'bundle') and entitlement_key = 'audio_guestbook'),
  'true'::jsonb,
  'nor its guestbook'
);

select is(
  public.celebration_plan_key((select id from events where name = 'bundle')),
  'guests_100',
  'the event still reports the plan it upgraded to'
);

select * from finish();

rollback;
