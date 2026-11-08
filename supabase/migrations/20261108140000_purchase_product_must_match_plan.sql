-- A store receipt only grants the plan its product actually sells.
--
-- WHY
-- ---
-- `publish_celebration` and `upgrade_celebration_plan` record whatever plan and
-- product id the client sends. Verification then only asked whether the store
-- confirmed the transaction, and the endpoint compared the store's product
-- with the client's own recorded value. A crafted client could buy the
-- cheapest product, record it against Stills+, and have it verified.
--
-- WHAT DECIDES NOW
-- ----------------
-- The product the store reports, passed in by the service role, must be one of:
--
--   * the plan's own store product;
--   * an upgrade product leading to that plan, on an event that already holds
--     the tier the upgrade is priced from;
--   * the discounted product of the promo code redeemed for this purchase.
--
-- Anything else raises, which rolls back and grants nothing. The check lives
-- in the one function every paid grant goes through, so the endpoint and the
-- webhook cannot disagree. A missing product is refused too: an old caller
-- that does not pass one fails closed.
--
-- `web` purchases are exempt. They never reach this with a client-chosen
-- product: Stripe Checkout and free promo codes write their own rows from the
-- server, with no store product to compare.
--
-- DEPLOYING
-- ---------
-- Apply this and ship `api/verify-purchase.ts` and `api/revenuecat-webhook.ts`
-- together. In the gap, verification fails and the client and RevenueCat
-- retry; nothing is granted wrongly and nothing is lost.

begin;

-- ---------------------------------------------------------------------------
-- Which upgrade product moves an event from which tier to which.
--
-- Mirrors `UPGRADE_PATHS` in src/features/payments/upgrade-catalogue.ts, and a
-- test there fails if the two drift apart.
--
-- Plan keys are plain text rather than foreign keys because `public.plans` is
-- filled by seed.sql after migrations on a fresh database.
-- ---------------------------------------------------------------------------

create table private.plan_upgrade_products (
  product_id text primary key,
  from_plan_key text not null,
  to_plan_key text not null,
  created_at timestamptz not null default now()
);

alter table private.plan_upgrade_products enable row level security;
revoke all on private.plan_upgrade_products from public, anon, authenticated;

comment on table private.plan_upgrade_products is
  'Store products that charge the difference between two tiers. Held on the '
  'server so a receipt can be checked against the plan it claims.';

insert into private.plan_upgrade_products (product_id, from_plan_key, to_plan_key)
values
  ('com.potoevents.eventcamera.upgrade.small_event_to_stories', 'guests_25', 'guests_100'),
  ('com.potoevents.eventcamera.upgrade.small_event_to_stories_plus', 'guests_25', 'guests_unlimited'),
  ('com.potoevents.eventcamera.upgrade.stories_to_stories_plus', 'guests_100', 'guests_unlimited');

-- ---------------------------------------------------------------------------
-- The decision
-- ---------------------------------------------------------------------------

create function private.product_grants_purchase(
  p_purchase public.purchases,
  p_product_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_own_product text;
  v_current_rank integer;
begin
  if p_product_id is null then
    return false;
  end if;

  if p_purchase.add_on_id is not null then
    return exists (
      select 1 from public.add_ons a
      where a.id = p_purchase.add_on_id
        and p_product_id = case p_purchase.platform
          when 'apple_app_store' then a.apple_product_id
          when 'google_play' then a.google_product_id
        end
    );
  end if;

  select * into v_plan from public.plans where id = p_purchase.plan_id;
  if not found then
    return false;
  end if;

  v_own_product := case p_purchase.platform
    when 'apple_app_store' then v_plan.apple_product_id
    when 'google_play' then v_plan.google_product_id
  end;

  if p_product_id = v_own_product then
    return true;
  end if;

  -- An upgrade is priced as the gap between two tiers, so it is only worth
  -- the higher tier to an event that already holds the lower one. Without
  -- this, the cheapest upgrade product would buy Stills+ from the free tier.
  select p.tier_rank into v_current_rank
  from public.plans p
  where p.key = public.celebration_plan_key(p_purchase.celebration_id);

  if exists (
    select 1
    from private.plan_upgrade_products u
    join public.plans from_plan on from_plan.key = u.from_plan_key
    where u.product_id = p_product_id
      and u.to_plan_key = v_plan.key
      and from_plan.tier_rank <= v_current_rank
  ) then
    return true;
  end if;

  -- Only the redemption tied to this purchase counts, so a discounted receipt
  -- is worthless on a purchase recorded without its code.
  return exists (
    select 1
    from private.promo_code_redemptions r
    join private.promo_codes c on c.id = r.promo_code_id
    where r.purchase_id = p_purchase.id
      and c.apple_product_id = p_product_id
      and c.plan_key = v_plan.key
  );
end;
$$;

comment on function private.product_grants_purchase is
  'Whether a store product really buys what this purchase row claims: the '
  'plan''s own product, an upgrade from a tier the event holds, or the '
  'discounted product of the promo code redeemed for this purchase.';

revoke all on function private.product_grants_purchase(public.purchases, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The door
--
-- Old signatures dropped first: `create or replace` with an extra parameter
-- would add an overload and leave the unchecked version callable.
-- ---------------------------------------------------------------------------

drop function public.activate_verified_purchase(public.purchase_platform, text, integer, char);
drop function private.activate_verified_purchase(public.purchase_platform, text, integer, char);

create function private.activate_verified_purchase(
  p_platform public.purchase_platform,
  p_platform_transaction_id text,
  p_price_minor_units integer default null,
  p_currency char(3) default null,
  p_verified_product_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
begin
  select * into v_purchase
  from public.purchases
  where platform = p_platform
    and platform_transaction_id = p_platform_transaction_id
  for update;

  if not found then
    -- The purchase row is written by publish/upgrade before the client ever
    -- reaches verification, so its absence means the transaction does not
    -- belong to this app. Refuse rather than inventing a grant.
    raise exception 'no purchase recorded for this transaction' using errcode = '22023';
  end if;

  -- Idempotent: RevenueCat may deliver the same transaction more than once,
  -- and the client's own verification call races the webhook by design.
  if v_purchase.status = 'verified' then
    return v_purchase.id;
  end if;

  if v_purchase.status in ('refunded', 'revoked') then
    raise exception 'purchase was reversed' using errcode = '22023';
  end if;

  if p_platform <> 'web'
     and not private.product_grants_purchase(v_purchase, p_verified_product_id) then
    -- Matched by name in the endpoint and the webhook.
    raise exception 'product does not grant this purchase' using errcode = '22023';
  end if;

  update public.purchases
     set status = 'verified',
         verified_at = now(),
         failure_code = null,
         -- The store's answer replaces the client's claim.
         platform_product_id = coalesce(p_verified_product_id, platform_product_id),
         price_minor_units = coalesce(p_price_minor_units, price_minor_units),
         currency = coalesce(p_currency, currency),
         updated_at = now()
   where id = v_purchase.id;

  if v_purchase.plan_id is not null then
    perform private.activate_plan_entitlements(
      v_purchase.celebration_id, v_purchase.plan_id, v_purchase.id);
  end if;

  if v_purchase.add_on_id is not null then
    insert into public.celebration_entitlements (
      celebration_id, entitlement_key, value,
      granted_by_add_on_id, granted_by_purchase_id
    )
    select v_purchase.celebration_id, ae.entitlement_key, ae.value,
           v_purchase.add_on_id, v_purchase.id
    from public.add_on_entitlements ae
    where ae.add_on_id = v_purchase.add_on_id
    on conflict (celebration_id, entitlement_key) do update
      set value = excluded.value,
          granted_by_add_on_id = excluded.granted_by_add_on_id,
          granted_by_purchase_id = excluded.granted_by_purchase_id,
          granted_at = now();
  end if;

  return v_purchase.id;
end;
$$;

comment on function private.activate_verified_purchase is
  'Marks a recorded purchase verified and grants what it bought, provided the '
  'product the store reported really buys it. Service role only — this is the '
  'single door through which a paid entitlement enters.';

create function public.activate_verified_purchase(
  p_platform public.purchase_platform,
  p_platform_transaction_id text,
  p_price_minor_units integer default null,
  p_currency char(3) default null,
  p_verified_product_id text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.activate_verified_purchase(
    p_platform, p_platform_transaction_id, p_price_minor_units, p_currency,
    p_verified_product_id);
$$;

comment on function public.activate_verified_purchase is
  'Service-role only. The single door through which a paid entitlement is '
  'granted, opened after the store has confirmed the transaction. '
  'p_verified_product_id is the product the store reports, never the client.';

revoke all on function private.activate_verified_purchase(public.purchase_platform, text, integer, char, text) from public, anon, authenticated;
revoke all on function public.activate_verified_purchase(public.purchase_platform, text, integer, char, text) from public, anon, authenticated;
grant execute on function private.activate_verified_purchase(public.purchase_platform, text, integer, char, text) to service_role;
grant execute on function public.activate_verified_purchase(public.purchase_platform, text, integer, char, text) to service_role;

commit;
