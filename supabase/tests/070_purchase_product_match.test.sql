-- A receipt only grants the plan its product actually sells.
--
-- The properties that matter: a real transaction for a cheap product cannot
-- be recorded against an expensive plan and verified; a missing product grants
-- nothing; and the normal, upgrade and discounted-promo paths still work.

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('eeee0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'buyer@test.local', '', now(), now(), now());

-- Read from the table so the test follows whatever ids this database holds.
-- Security definer where they read tables, since `service_role` has no table
-- grants of its own locally.
create function pg_temp.product(p_plan_key text) returns text language sql security definer as $$
  select apple_product_id from public.plans where key = p_plan_key;
$$;

create function pg_temp.upgrade(p_name text) returns text language sql as $$
  select 'com.potoevents.eventcamera.upgrade.' || p_name;
$$;

create temporary table drafts (name text primary key, id uuid);
grant all on drafts to authenticated;

create function pg_temp.draft(p_name text) returns uuid language sql security definer as $$
  select id from drafts where name = p_name;
$$;

create function pg_temp.make_draft(p_name text) returns void language plpgsql as $$
begin
  insert into drafts
  select p_name, celebration_id
  from public.create_celebration_with_default_session(
    p_title => p_name, p_session_name => 'Main event',
    p_celebration_type => 'wedding', p_inspiration_pack => 'universal',
    p_timezone => 'Europe/London', p_ends_at => now() + interval '2 days',
    p_allowed_media_types => array['photo']::public.media_type[]
  );
end;
$$;

-- Records a store purchase of a plan at publish, as the app does.
create function pg_temp.publish_paid(p_name text, p_plan text, p_product text, p_txn text)
returns void language plpgsql as $$
begin
  perform public.publish_celebration(
    pg_temp.draft(p_name), p_plan, array[]::text[], 'apple_app_store', p_product, p_txn);
end;
$$;

-- What the endpoint and the webhook call: only the store's answer goes in.
create function pg_temp.verify(p_txn text, p_product text)
returns uuid language sql as $$
  select public.activate_verified_purchase(
    'apple_app_store', p_txn, null, null, p_product);
$$;

create function pg_temp.plan_of(p_name text) returns text language sql as $$
  select public.celebration_plan_key(pg_temp.draft(p_name));
$$;

create function pg_temp.recorded_product(p_txn text) returns text language sql security definer as $$
  select platform_product_id from public.purchases where platform_transaction_id = p_txn;
$$;

create function pg_temp.status_of(p_txn text) returns text language sql security definer as $$
  select status::text from public.purchases where platform_transaction_id = p_txn;
$$;

insert into private.promo_codes (code, percent_off, plan_key, apple_product_id)
values ('STILLS75', 75, 'guests_unlimited', 'test.stills_plus_promo_75');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.make_draft(n)
from unnest(array['crafted', 'missing', 'normal', 'lied', 'upgrade', 'free',
                  'skips-tier', 'wrong-target', 'promo', 'plain-discount']) n;

-- ---------------------------------------------------------------------------
-- The door itself
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.activate_verified_purchase('apple_app_store', 'x', null, null, 'y') $$,
  '42501', null, 'a host cannot call the verification door'
);

reset role;
select is(
  to_regprocedure('public.activate_verified_purchase(public.purchase_platform,text,integer,character)'),
  null, 'the unchecked public signature is gone'
);
select is(
  to_regprocedure('private.activate_verified_purchase(public.purchase_platform,text,integer,character)'),
  null, 'the unchecked private signature is gone'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- The attack: pay for the cheapest package, claim the top one
-- ---------------------------------------------------------------------------

select pg_temp.publish_paid('crafted', 'guests_unlimited', pg_temp.product('guests_25'), 'txn-crafted');
select pg_temp.publish_paid('missing', 'guests_100', pg_temp.product('guests_100'), 'txn-missing');

set local role service_role;

select throws_ok(
  $$ select pg_temp.verify('txn-crafted', pg_temp.product('guests_25')) $$,
  '22023', 'product does not grant this purchase',
  'a cheap receipt does not verify against an expensive plan'
);
select is(pg_temp.status_of('txn-crafted'), 'pending', 'the crafted purchase stays unverified');
select isnt(pg_temp.plan_of('crafted'), 'guests_unlimited', 'the crafted purchase grants nothing');

select throws_ok(
  $$ select pg_temp.verify('txn-missing', null) $$,
  '22023', 'product does not grant this purchase',
  'a verification that names no product grants nothing'
);
select isnt(pg_temp.plan_of('missing'), 'guests_100', 'a missing product grants nothing');

-- ---------------------------------------------------------------------------
-- The normal purchase
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.publish_paid('normal', 'guests_25', pg_temp.product('guests_25'), 'txn-normal');
select pg_temp.publish_paid('lied', 'guests_25', 'client.says.anything', 'txn-lied');

set local role service_role;

select lives_ok(
  $$ select pg_temp.verify('txn-normal', pg_temp.product('guests_25')) $$,
  'a plan''s own product verifies'
);
select is(pg_temp.plan_of('normal'), 'guests_25', 'the plan''s own product grants the plan');

select lives_ok(
  $$ select pg_temp.verify('txn-normal', pg_temp.product('guests_25')) $$,
  'verifying twice is harmless'
);

select lives_ok(
  $$ select pg_temp.verify('txn-lied', pg_temp.product('guests_25')) $$,
  'what the client claimed plays no part'
);
select is(
  pg_temp.recorded_product('txn-lied'),
  pg_temp.product('guests_25'),
  'the ledger records the product the store reported'
);

-- ---------------------------------------------------------------------------
-- Upgrades: priced as a gap, so only worth it from the tier below
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.publish_paid('upgrade', 'guests_25', pg_temp.product('guests_25'), 'txn-upgrade-base');
set local role service_role;
select pg_temp.verify('txn-upgrade-base', pg_temp.product('guests_25'));
set local role authenticated;

select public.upgrade_celebration_plan(
  pg_temp.draft('upgrade'), 'guests_unlimited',
  pg_temp.upgrade('small_event_to_stories_plus'), 'txn-upgrade', 'apple_app_store');

set local role service_role;
select lives_ok(
  $$ select pg_temp.verify('txn-upgrade', pg_temp.upgrade('small_event_to_stories_plus')) $$,
  'an upgrade product verifies from the tier it is priced from'
);
select is(pg_temp.plan_of('upgrade'), 'guests_unlimited', 'the upgrade grants the destination tier');

set local role authenticated;

-- No package at all, then the cheapest upgrade to the top tier.
select public.publish_celebration(pg_temp.draft('free'));
select public.upgrade_celebration_plan(
  pg_temp.draft('free'), 'guests_unlimited',
  pg_temp.upgrade('stories_to_stories_plus'), 'txn-from-free', 'apple_app_store');

-- Holds the lowest paid tier, presents the upgrade priced from the middle one.
select pg_temp.publish_paid('skips-tier', 'guests_25', pg_temp.product('guests_25'), 'txn-skips-base');
select public.upgrade_celebration_plan(
  pg_temp.draft('skips-tier'), 'guests_unlimited',
  pg_temp.upgrade('stories_to_stories_plus'), 'txn-skips', 'apple_app_store');

-- A real upgrade path, claimed against the wrong destination.
select pg_temp.publish_paid('wrong-target', 'guests_25', pg_temp.product('guests_25'), 'txn-target-base');
select public.upgrade_celebration_plan(
  pg_temp.draft('wrong-target'), 'guests_unlimited',
  pg_temp.upgrade('small_event_to_stories'), 'txn-target', 'apple_app_store');

set local role service_role;
select pg_temp.verify('txn-skips-base', pg_temp.product('guests_25'));
select pg_temp.verify('txn-target-base', pg_temp.product('guests_25'));

select throws_ok(
  $$ select pg_temp.verify('txn-from-free', pg_temp.upgrade('stories_to_stories_plus')) $$,
  '22023', 'product does not grant this purchase',
  'an upgrade product cannot buy the tier from nothing'
);
select throws_ok(
  $$ select pg_temp.verify('txn-skips', pg_temp.upgrade('stories_to_stories_plus')) $$,
  '22023', 'product does not grant this purchase',
  'an upgrade priced from a tier the event does not hold is refused'
);
select is(pg_temp.plan_of('skips-tier'), 'guests_25', 'the refused upgrade leaves the tier alone');
select throws_ok(
  $$ select pg_temp.verify('txn-target', pg_temp.upgrade('small_event_to_stories')) $$,
  '22023', 'product does not grant this purchase',
  'an upgrade product grants only its own destination'
);

-- ---------------------------------------------------------------------------
-- The discounted promo product
-- ---------------------------------------------------------------------------

set local role authenticated;

-- The discounted product without its code: a plain publish claiming Stills+.
select pg_temp.publish_paid('plain-discount', 'guests_unlimited', 'test.stills_plus_promo_75', 'txn-plain-discount');

select public.publish_celebration_with_promo(
  pg_temp.draft('promo'), 'guests_unlimited', 'STILLS75',
  'apple_app_store', 'test.stills_plus_promo_75', 'txn-promo');

set local role service_role;

select throws_ok(
  $$ select pg_temp.verify('txn-plain-discount', 'test.stills_plus_promo_75') $$,
  '22023', 'product does not grant this purchase',
  'a discounted product is worthless without a redeemed code'
);
select throws_ok(
  $$ select pg_temp.verify('txn-promo', pg_temp.product('guests_25')) $$,
  '22023', 'product does not grant this purchase',
  'a redeemed code does not make another product acceptable'
);
select isnt(pg_temp.plan_of('promo'), 'guests_unlimited', 'the wrong receipt grants nothing on a redeemed code');
select lives_ok(
  $$ select pg_temp.verify('txn-promo', 'test.stills_plus_promo_75') $$,
  'the code''s discounted product verifies'
);
select is(pg_temp.plan_of('promo'), 'guests_unlimited', 'the discounted product grants the package');

reset role;

select * from finish();
rollback;
