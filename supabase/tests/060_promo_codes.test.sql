-- Promo codes.
--
-- The properties that matter: a valid code publishes the event on the package
-- picked with nothing charged; a retry spends nothing more; revoked, expired
-- and exhausted codes grant nothing; a code cannot upgrade a live event or
-- someone else's; and guessing is throttled.

begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('eeee0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'promo-host@test.local', '', now(), now(), now()),
  ('eeee0000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'promo-other@test.local', '', now(), now(), now()),
  ('eeee0000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'promo-guesser@test.local', '', now(), now(), now()),
  ('eeee0000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'promo-discount@test.local', '', now(), now(), now()),
  ('eeee0000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'promo-late@test.local', '', now(), now(), now());

insert into private.promo_codes (code, max_redemptions, revoked_at, expires_at)
values
  ('Friends', 1, null, null),
  ('REVOKED', null, now(), null),
  ('EXPIRED', null, null, now() - interval '1 minute');

insert into private.promo_codes (code, percent_off, plan_key, apple_product_id)
values ('STILLS75', 75, 'guests_unlimited', 'test.stills_plus_promo_75');

create temporary table drafts (name text primary key, id uuid);
grant all on drafts to authenticated;

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

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.check_promo_code('FRIENDS') $$, '42501', null,
  'a signed-out caller cannot check a code');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok($$ select * from private.promo_codes $$, '42501', null,
  'a host cannot read the codes');

select is(public.check_promo_code('FRIENDS')->>'status', 'valid', 'a live code checks as valid');
select is(public.check_promo_code('  friends ')->>'status', 'valid', 'case and spaces do not matter');
select is(public.check_promo_code('NOPE')->>'status', 'invalid', 'an unknown code is invalid');
select is(public.check_promo_code('REVOKED')->>'status', 'invalid', 'a revoked code is invalid');
select is(public.check_promo_code('EXPIRED')->>'status', 'invalid', 'an expired code is invalid');

select pg_temp.make_draft('first');
select pg_temp.make_draft('second');
select pg_temp.make_draft('live');

select ok(
  public.publish_celebration_with_promo((select id from drafts where name = 'first'), 'guests_unlimited', 'NOPE') is null,
  'a wrong code publishes nothing'
);
select is(
  (select status::text from public.celebrations where id = (select id from drafts where name = 'first')),
  'draft', 'the event stays a draft after a wrong code'
);

select public.publish_celebration_with_promo((select id from drafts where name = 'first'), 'guests_unlimited', 'friends');

select is(
  public.celebration_plan_key((select id from drafts where name = 'first')),
  'guests_unlimited', 'a valid code grants the package picked'
);
select is(
  (select status::text from public.celebrations where id = (select id from drafts where name = 'first')),
  'published', 'a valid code publishes the event'
);

select ok(
  (public.publish_celebration_with_promo((select id from drafts where name = 'first'), 'guests_unlimited', 'friends')).was_already_published,
  'a retry reports the event already published'
);

select is(public.check_promo_code('FRIENDS')->>'status', 'already_used', 'an account cannot use a code twice');
select ok(
  public.publish_celebration_with_promo((select id from drafts where name = 'second'), 'guests_unlimited', 'FRIENDS') is null,
  'a used code does not publish a second event'
);

select public.publish_celebration((select id from drafts where name = 'live'));
select throws_ok(
  $$ select public.publish_celebration_with_promo((select id from drafts where name = 'live'), 'guests_unlimited', 'FRIENDS') $$,
  '23505', null, 'a code cannot upgrade an event already live'
);

set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(public.check_promo_code('FRIENDS')->>'status', 'used_up', 'the overall limit holds across accounts');
select throws_ok(
  $$ select public.publish_celebration_with_promo((select id from drafts where name = 'second'), 'guests_unlimited', 'FRIENDS') $$,
  '42501', null, 'a code cannot be used on someone else''s event'
);

set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000003","role":"authenticated"}';

select public.check_promo_code('GUESS-' || n) from generate_series(1, 10) n;
select is(public.check_promo_code('FRIENDS')->>'status', 'rate_limited', 'guessing is throttled');

-- A discount: Stills+ only, pays for its own product, granted on verification.
set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000004","role":"authenticated"}';

select pg_temp.make_draft('discount');
select pg_temp.make_draft('wrong-plan');
select pg_temp.make_draft('no-receipt');

select is(public.check_promo_code('STILLS75')->>'percent_off', '75', 'a check reports the discount');
select is(public.check_promo_code('STILLS75')->>'plan_key', 'guests_unlimited', 'a check reports the package');
select is(public.check_promo_code('STILLS75')->>'apple_product_id', 'test.stills_plus_promo_75', 'a check reports the product to charge');

select ok(
  public.publish_celebration_with_promo(
    (select id from drafts where name = 'wrong-plan'), 'guests_100', 'STILLS75',
    'apple_app_store', 'test.stills_plus_promo_75', 'txn-wrong-plan') is null,
  'a Stills+ code does nothing on another package'
);
select is(
  (select status::text from public.celebrations where id = (select id from drafts where name = 'wrong-plan')),
  'draft', 'the event stays a draft on the wrong package'
);

select throws_ok(
  $$ select public.publish_celebration_with_promo((select id from drafts where name = 'no-receipt'), 'guests_unlimited', 'STILLS75') $$,
  '22023', null, 'a discount cannot be redeemed without paying'
);
select throws_ok(
  $$ select public.publish_celebration_with_promo((select id from drafts where name = 'no-receipt'), 'guests_unlimited', 'STILLS75', 'apple_app_store', 'some.other.product', 'txn-other') $$,
  '22023', null, 'a discount cannot be redeemed with another product''s receipt'
);

select public.publish_celebration_with_promo(
  (select id from drafts where name = 'discount'), 'guests_unlimited', 'STILLS75',
  'apple_app_store', 'test.stills_plus_promo_75', 'txn-discount');

select is(
  (select status::text from public.celebrations where id = (select id from drafts where name = 'discount')),
  'published', 'a discounted purchase publishes the event'
);
select isnt(
  public.celebration_plan_key((select id from drafts where name = 'discount')),
  'guests_unlimited', 'the package waits for the receipt to be verified'
);
select is(
  (select price_minor_units from public.purchases where platform_transaction_id = 'txn-discount'),
  round((select price_minor_units from public.plans where key = 'guests_unlimited') * 0.25)::integer,
  'the purchase records the discounted price'
);

reset role;
select private.activate_verified_purchase('apple_app_store', 'txn-discount');
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  public.celebration_plan_key((select id from drafts where name = 'discount')),
  'guests_unlimited', 'a verified receipt grants the package'
);
select is(public.check_promo_code('STILLS75')->>'status', 'already_used', 'a discount is once per account');

reset role;
update private.promo_codes set revoked_at = now() where code = 'STILLS75';
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeee0000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(public.check_promo_code('STILLS75')->>'status', 'invalid', 'revoking stops a discount at once');

reset role;
select is(
  (select count(*)::int from private.promo_code_redemptions
    where user_id in ('eeee0000-0000-0000-0000-000000000001', 'eeee0000-0000-0000-0000-000000000004')),
  2, 'one redemption per code was recorded'
);

select * from finish();
rollback;
