-- Managing promo codes. Run one of these in the Supabase SQL editor.
-- Codes are not case-sensitive. A code gives 100% off whichever package the
-- host picks, unless it is given a percent_off and a plan_key.

-- Add a code: limited to 50 uses in total, once per account.
insert into private.promo_codes (code, note, max_redemptions)
values ('FRIENDS', 'Friends and family', 50);

-- Add a discount for one package. The Apple product must exist and be listed
-- in PROMO_STORE_PRODUCTS in the app, because Apple charges its fixed price.
insert into private.promo_codes (code, note, percent_off, plan_key, apple_product_id)
values ('STILLS75', '75% off Stills+', 75, 'guests_unlimited',
        'com.potoevents.eventcamera.package.stories_plus_promo_75');

-- Add a code with no overall limit that stops working on a set date.
insert into private.promo_codes (code, note, expires_at)
values ('LAUNCH', 'Launch week', '2026-12-31 23:59:59+00');

-- Let one account use a code as many times as it likes (handy for testing).
update private.promo_codes set max_per_account = null where upper(code) = 'FRIENDS';

-- Revoke a code. Events already made with it keep their package.
update private.promo_codes set revoked_at = now() where upper(code) = 'FRIENDS';

-- See every code and how much it has been used.
select c.code, c.note, c.percent_off, c.plan_key, c.max_redemptions, c.max_per_account, c.expires_at, c.revoked_at,
       count(r.id) as times_used
from private.promo_codes c
left join private.promo_code_redemptions r on r.promo_code_id = c.id
group by c.id
order by c.created_at desc;
