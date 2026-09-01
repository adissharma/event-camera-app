-- Entitlements require a verified store receipt.
--
-- WHY
-- ---
-- `publish_celebration` and `upgrade_celebration_plan` recorded a purchase as
-- 'pending' and then activated the plan's entitlements immediately, with no
-- receipt from any store. Both carried a comment saying so and saying it had
-- to change before launch. This is that change.
--
-- The hole was not theoretical: these are `security definer` functions that
-- any authenticated user can call. Calling `upgrade_celebration_plan` with
-- `p_plan_key => 'guests_unlimited'` granted the top tier for nothing.
--
-- WHAT DECIDES NOW
-- ----------------
-- The purchase's platform, not the caller:
--
--   apple_app_store  Activation requires a `purchases` row at status
--                    'verified'. Only the service role can set that, and it
--                    does so after checking the transaction against
--                    RevenueCat (which performs the Apple-side receipt
--                    verification). No client can reach it.
--
--   web              There is no web checkout, so a paid plan cannot be
--                    honestly bought here and is refused. The exception is
--                    the development switch below, which exists so the
--                    pre-launch build has a working test path.
--
-- A free plan activates on any platform: there is no receipt to verify
-- because there was no money.

begin;

-- ---------------------------------------------------------------------------
-- Settings
--
-- One switch, in the database rather than in client code, because the server
-- cannot trust a client that says "I am in development".
-- ---------------------------------------------------------------------------

create table if not exists private.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

comment on table private.app_settings is
  'Server-side switches. Private schema: readable only by security definer '
  'functions and the service role, never by a client.';

insert into private.app_settings (key, value, description)
values (
  'allow_development_purchases',
  'true'::jsonb,
  'When true, a paid plan bought through the development payment provider '
  '(platform = web) activates without a store receipt, so the pre-launch '
  'build has a working end-to-end test path. MUST BE SET FALSE BEFORE '
  'LAUNCH — while it is true, any authenticated user can grant themselves '
  'any tier by calling publish_celebration or upgrade_celebration_plan '
  'directly. Apple purchases are unaffected: those always require '
  'verification, switch or no switch.'
)
on conflict (key) do nothing;

create or replace function private.setting_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Absent setting reads as disabled: a missing switch must never be the
  -- thing that opens a door.
  select coalesce((select value = 'true'::jsonb from private.app_settings where key = p_key), false);
$$;

-- ---------------------------------------------------------------------------
-- Verification, service role only
-- ---------------------------------------------------------------------------

create or replace function private.activate_verified_purchase(
  p_platform public.purchase_platform,
  p_platform_transaction_id text,
  p_price_minor_units integer default null,
  p_currency char(3) default null
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

  update public.purchases
     set status = 'verified',
         verified_at = now(),
         failure_code = null,
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
  'Marks a recorded purchase verified and grants what it bought. Service role '
  'only — this is the single door through which a paid entitlement enters.';

create or replace function private.reverse_purchase(
  p_platform public.purchase_platform,
  p_platform_transaction_id text,
  p_status public.purchase_status
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
begin
  if p_status not in ('refunded', 'revoked', 'failed') then
    raise exception 'reverse_purchase expects a reversal status' using errcode = '22023';
  end if;

  select * into v_purchase
  from public.purchases
  where platform = p_platform
    and platform_transaction_id = p_platform_transaction_id
  for update;

  if not found then
    return null;
  end if;

  update public.purchases
     set status = p_status,
         revoked_at = now(),
         updated_at = now()
   where id = v_purchase.id;

  -- Withdraw exactly what this purchase granted, and nothing else. An event
  -- that was later upgraded has had its rows re-granted by the newer
  -- purchase, so those do not match here and correctly survive the refund of
  -- the older one.
  delete from public.celebration_entitlements
   where celebration_id = v_purchase.celebration_id
     and granted_by_purchase_id = v_purchase.id;

  return v_purchase.id;
end;
$$;

comment on function private.reverse_purchase is
  'Refund or revocation: marks the purchase reversed and withdraws the '
  'entitlements it granted. Service role only.';

revoke all on function private.activate_verified_purchase(public.purchase_platform, text, integer, char) from public, anon, authenticated;
revoke all on function private.reverse_purchase(public.purchase_platform, text, public.purchase_status) from public, anon, authenticated;
grant execute on function private.activate_verified_purchase(public.purchase_platform, text, integer, char) to service_role;
grant execute on function private.reverse_purchase(public.purchase_platform, text, public.purchase_status) to service_role;

commit;
