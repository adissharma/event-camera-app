-- Promo codes that discount a package rather than making it free.
--
-- WHY
-- ---
-- Apple charges the fixed price of a product and cannot be told to take 25% of
-- it, so a partial discount is a separate, cheaper product. A code names that
-- product and the one package it applies to.
--
-- HOW A DISCOUNTED PURCHASE DIFFERS FROM A FREE ONE
-- -------------------------------------------------
-- A free code stands in for the receipt, so it grants the package on the spot.
-- A discounted code does not: money changes hands, so the purchase is recorded
-- as pending and granted by the usual receipt verification, which confirms
-- with RevenueCat that this transaction bought the discounted product.

begin;

alter table private.promo_codes
  add column percent_off integer not null default 100
    check (percent_off between 1 and 100),
  -- The only package this code applies to. Null means any paid package.
  add column plan_key text references public.plans (key),
  -- The store product charged instead of the package's own.
  add column apple_product_id text,
  add constraint promo_codes_discount_needs_product check (
    percent_off = 100 or (plan_key is not null and apple_product_id is not null)
  );

-- ---------------------------------------------------------------------------
-- Check: what would this code do? Uses nothing up.
-- ---------------------------------------------------------------------------

drop function public.check_promo_code(text);

create function public.check_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_status text;
  v_promo_code_id uuid;
  v_code private.promo_codes%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select e.status, e.promo_code_id into v_status, v_promo_code_id
  from private.evaluate_promo_code(p_code, v_user_id) e;

  if v_status <> 'valid' then
    return jsonb_build_object('status', v_status);
  end if;

  select * into v_code from private.promo_codes where id = v_promo_code_id;

  return jsonb_build_object(
    'status', v_status,
    'percent_off', v_code.percent_off,
    'plan_key', v_code.plan_key,
    'apple_product_id', v_code.apple_product_id
  );
end;
$$;

comment on function public.check_promo_code is
  'Whether the signed-in host can use a code (status: valid, invalid, '
  'already_used, used_up or rate_limited) and, if so, its terms. Does not '
  'redeem it.';

revoke all on function public.check_promo_code(text) from public, anon;
grant execute on function public.check_promo_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Redeem and publish, in one transaction.
-- ---------------------------------------------------------------------------

drop function public.publish_celebration_with_promo(uuid, text, text);

create function public.publish_celebration_with_promo(
  p_celebration_id uuid,
  p_plan_key text,
  p_code text,
  p_platform public.purchase_platform default 'apple_app_store',
  p_platform_product_id text default null,
  p_platform_transaction_id text default null
)
returns public.published_celebration
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan public.plans%rowtype;
  v_celebration public.celebrations%rowtype;
  v_status text;
  v_promo_code_id uuid;
  v_code private.promo_codes%rowtype;
  v_free_plan_key text;
  v_is_free boolean;
  v_platform public.purchase_platform;
  v_product_id text;
  v_transaction_id text;
  v_purchase_id uuid;
  v_result public.published_celebration;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to publish this event' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where key = p_plan_key and is_active;
  if not found then
    raise exception 'unknown plan' using errcode = '22023';
  end if;

  if coalesce(v_plan.price_minor_units, 0) <= 0 then
    raise exception 'free plans do not need a promo code' using errcode = '22023';
  end if;

  select * into v_celebration
  from public.celebrations
  where id = p_celebration_id and deleted_at is null
  for update;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  -- A retry after a dropped connection: the code was already spent on this
  -- event, so report the published event and spend nothing more.
  if exists (
    select 1 from private.promo_code_redemptions r
    where r.celebration_id = p_celebration_id
  ) then
    return public.publish_celebration(p_celebration_id, null, array[]::text[], 'web');
  end if;

  -- Only a draft: a code must not upgrade an event already live.
  if v_celebration.status <> 'draft' then
    raise exception 'event already published' using errcode = '23505';
  end if;

  select e.status, e.promo_code_id into v_status, v_promo_code_id
  from private.evaluate_promo_code(p_code, v_user_id) e;

  if v_status <> 'valid' then
    return null;
  end if;

  select * into v_code from private.promo_codes where id = v_promo_code_id;

  if v_code.plan_key is not null and v_code.plan_key <> p_plan_key then
    return null;
  end if;

  v_is_free := v_code.percent_off = 100;

  if v_is_free then
    v_platform := 'web';
    v_product_id := v_plan.key;
    v_transaction_id := 'promo-' || p_celebration_id::text;
  else
    -- The transaction must have bought the product this code charges, or a
    -- receipt for something else could be presented as the discount.
    if p_platform_transaction_id is null
       or p_platform_product_id is distinct from v_code.apple_product_id then
      raise exception 'this code needs its discounted purchase' using errcode = '22023';
    end if;
    v_platform := p_platform;
    v_product_id := p_platform_product_id;
    v_transaction_id := p_platform_transaction_id;
  end if;

  select key into v_free_plan_key
  from public.plans
  where is_active and coalesce(price_minor_units, 0) = 0
  order by tier_rank
  limit 1;

  -- Runs every publishing check, and raises if the event is not ready.
  v_result := public.publish_celebration(
    p_celebration_id, v_free_plan_key, array[]::text[], 'web');

  insert into public.purchases (
    celebration_id, purchased_by, platform, platform_product_id,
    platform_transaction_id, plan_id, status,
    price_minor_units, currency, failure_code
  )
  values (
    p_celebration_id, v_user_id, v_platform, v_product_id,
    v_transaction_id, v_plan.id, 'pending',
    round(v_plan.price_minor_units * (100 - v_code.percent_off) / 100.0)::integer,
    v_plan.currency, 'awaiting_receipt_verification'
  )
  returning id into v_purchase_id;

  -- A discounted purchase waits for receipt verification, like any other.
  if v_is_free then
    perform private.activate_verified_purchase('web', v_transaction_id, 0, v_plan.currency);
  end if;

  insert into private.promo_code_redemptions (
    promo_code_id, celebration_id, user_id, purchase_id
  )
  values (v_promo_code_id, p_celebration_id, v_user_id, v_purchase_id);

  return v_result;
end;
$$;

comment on function public.publish_celebration_with_promo is
  'Publishes a draft using a promo code. A free code grants the package; a '
  'discounted one records the store purchase for verification. Returns null '
  'if the code cannot be used on this package.';

revoke all on function public.publish_celebration_with_promo(uuid, text, text, public.purchase_platform, text, text) from public, anon;
grant execute on function public.publish_celebration_with_promo(uuid, text, text, public.purchase_platform, text, text) to authenticated;

commit;
