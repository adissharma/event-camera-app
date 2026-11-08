-- Web checkout.
--
-- The properties that matter: a paid Stripe session publishes the event with
-- the package it paid for; running it again (webhook retries, the return page
-- racing the webhook) changes nothing; underpaying or paying for someone
-- else's event grants nothing; and no browser can reach the function at all.

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('ffff0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'web-host@test.local', '', now(), now(), now()),
  ('ffff0000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'web-stranger@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"ffff0000-0000-0000-0000-000000000001","role":"authenticated"}';

create temporary table created as
select * from public.create_celebration_with_default_session(
  p_title => 'Web Checkout Fixture', p_session_name => 'Main event',
  p_celebration_type => 'wedding', p_inspiration_pack => 'universal',
  p_timezone => 'Europe/London', p_ends_at => now() + interval '2 days',
  p_allowed_media_types => array['photo']::public.media_type[]
);
grant select on created to service_role;

-- A browser cannot call it, whatever it claims.
select throws_ok(
  $$ select * from public.complete_web_checkout(
       (select celebration_id from created), 'ffff0000-0000-0000-0000-000000000001',
       'guests_unlimited', 'cs_test_forged', 4999, 'GBP') $$,
  '42501',
  null,
  'an authenticated user cannot complete a checkout themselves'
);

-- Nor can it publish a paid tier from the web on its own.
select throws_ok(
  $$ select * from public.publish_celebration((select celebration_id from created), 'guests_unlimited') $$,
  '22023',
  'paid packages can only be purchased in the app',
  'publish_celebration still refuses a paid web tier from the browser'
);

reset role;
set local request.jwt.claims = '{"role":"service_role"}';
set local role service_role;

select is(
  (select plan_key from public.web_checkout_quote(
     (select celebration_id from created), 'ffff0000-0000-0000-0000-000000000001', 'guests_unlimited')),
  'guests_unlimited',
  'the quote prices a draft for its own host'
);

select throws_ok(
  $$ select * from public.web_checkout_quote(
       (select celebration_id from created), 'ffff0000-0000-0000-0000-000000000002', 'guests_unlimited') $$,
  '42501',
  null,
  'the quote refuses a host who cannot manage the event'
);

-- Underpaying fails closed.
select throws_ok(
  $$ select * from public.complete_web_checkout(
       (select celebration_id from created), 'ffff0000-0000-0000-0000-000000000001',
       'guests_unlimited', 'cs_test_underpaid', 1499, 'GBP') $$,
  '22023',
  'amount paid does not cover this package',
  'a session that paid less than the package grants nothing'
);

-- A session made out to a different host cannot publish this host's event.
select throws_ok(
  $$ select * from public.complete_web_checkout(
       (select celebration_id from created), 'ffff0000-0000-0000-0000-000000000002',
       'guests_unlimited', 'cs_test_stranger', 4999, 'GBP') $$,
  '42501',
  null,
  'a checkout for someone who cannot manage the event is refused'
);

reset role;
select is(
  (select status::text from public.celebrations where id = (select celebration_id from created)),
  'draft',
  'the refused attempts left the event a draft'
);
set local role service_role;

-- The real thing.
create temporary table completed as
select * from public.complete_web_checkout(
  (select celebration_id from created), 'ffff0000-0000-0000-0000-000000000001',
  'guests_unlimited', 'cs_test_paid', 4999, 'gbp');

select is(
  current_setting('request.jwt.claims', true),
  '{"role":"service_role"}',
  'the host claims do not leak past the call'
);

reset role;

select is(
  (select status::text from public.celebrations where id = (select celebration_id from created)),
  'published',
  'a paid session publishes the event'
);

select isnt((select event_code from completed), null, 'the event code comes back for the confirmation page');

select is(
  public.celebration_plan_key((select celebration_id from created)),
  'guests_unlimited',
  'the event carries the package that was paid for'
);

select is(
  (select status::text from public.purchases where platform = 'web' and platform_transaction_id = 'cs_test_paid'),
  'verified',
  'the Stripe purchase is recorded as verified'
);

select is(
  (select purchased_by from public.purchases where platform_transaction_id = 'cs_test_paid'),
  'ffff0000-0000-0000-0000-000000000001'::uuid,
  'the purchase belongs to the host'
);

-- Webhook retry and return page racing it.
set local role service_role;
select lives_ok(
  $$ select * from public.complete_web_checkout(
       (select celebration_id from created), 'ffff0000-0000-0000-0000-000000000001',
       'guests_unlimited', 'cs_test_paid', 4999, 'GBP') $$,
  'completing the same session again is harmless'
);
reset role;

select is(
  (select count(*)::int from public.purchases where celebration_id = (select celebration_id from created) and platform_transaction_id like 'cs_%'),
  1,
  'one purchase however many times the session is completed'
);

-- A refund withdraws what the session granted.
select public.reverse_purchase('web', 'cs_test_paid', 'refunded');

select isnt(
  public.celebration_plan_key((select celebration_id from created)),
  'guests_unlimited',
  'a refund withdraws the package'
);

select * from finish();
rollback;
