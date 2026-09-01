-- `publish_celebration` and `upgrade_celebration_plan` stop granting paid
-- tiers on their own. See 20260901160000 for the reasoning and the platform
-- rules; this migration applies them to the two entry points.
--
-- Both functions gain three optional parameters carrying what the store
-- actually returned. Optional so the free-tier call site is unchanged, but a
-- paid Apple purchase without them is refused.

begin;

-- ---------------------------------------------------------------------------
-- Drop the previous signatures FIRST.
--
-- `create or replace function` matches on the argument list, so adding
-- parameters below would create an OVERLOAD and leave the old, unguarded
-- three-argument `publish_celebration` and four-argument
-- `upgrade_celebration_plan` in place and callable — the exact functions this
-- migration exists to close. A three-argument call would also become
-- ambiguous between the old function and the new one's defaults.
-- ---------------------------------------------------------------------------

drop function if exists public.publish_celebration(uuid, text, text[]);
drop function if exists public.upgrade_celebration_plan(uuid, text, text, text);

-- ---------------------------------------------------------------------------
-- Shared decision
-- ---------------------------------------------------------------------------

create or replace function private.may_activate_without_receipt(
  p_platform public.purchase_platform,
  p_price_minor_units integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- Nothing was charged, so there is no receipt to want.
    coalesce(p_price_minor_units, 0) = 0
    -- Or: the development provider, and only while explicitly permitted.
    -- Apple never qualifies, whatever the switch says.
    or (p_platform = 'web' and private.setting_enabled('allow_development_purchases'));
$$;

comment on function private.may_activate_without_receipt is
  'Whether a purchase may grant entitlements with no verified receipt. True '
  'for free plans always, and for the development provider while the '
  'allow_development_purchases switch is on. Never true for a real store.';

-- ---------------------------------------------------------------------------
-- Publish
-- ---------------------------------------------------------------------------

create or replace function public.publish_celebration(
  p_celebration_id uuid,
  p_plan_key text default null,
  p_add_on_keys text[] default array[]::text[],
  p_platform public.purchase_platform default 'web',
  p_platform_product_id text default null,
  p_platform_transaction_id text default null
)
returns public.published_celebration
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_plan public.plans%rowtype;
  v_purchase_id uuid;
  v_add_on_key text;
  v_add_on public.add_ons%rowtype;
  v_add_on_purchase_id uuid;
  v_transaction_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to publish this event' using errcode = '42501';
  end if;

  select * into v_celebration
  from public.celebrations
  where id = p_celebration_id and deleted_at is null
  for update;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = p_celebration_id and deleted_at is null
  order by sequence_number
  limit 1;

  if not found then
    raise exception 'event has no session to publish' using errcode = '22023';
  end if;

  if v_celebration.status = 'published' then
    return (
      v_celebration.id, v_session.id, v_celebration.public_slug,
      v_celebration.published_at, true, v_celebration.event_code
    )::public.published_celebration;
  end if;

  if v_celebration.status = 'archived' then
    raise exception 'event is archived' using errcode = '42501';
  end if;

  if v_session.ends_at is null then
    raise exception 'event needs a closing time' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.access_links
    where event_session_id = v_session.id and kind = 'guest' and is_active
  ) then
    raise exception 'event has no guest access link' using errcode = '22023';
  end if;

  if p_plan_key is not null then
    select * into v_plan from public.plans where key = p_plan_key and is_active;
    if not found then
      raise exception 'unknown plan' using errcode = '22023';
    end if;

    -- A missing transaction id is deliberately NOT an error. A deferred
    -- purchase (Ask to Buy, awaiting a parent's approval) has no receipt yet
    -- and may not have one for days. Recording it costs nothing and grants
    -- nothing — activation is gated on verification below, so a row with no
    -- transaction id is simply a row that can never be verified. Refusing it
    -- would instead fail the whole publish for a host whose purchase is
    -- merely waiting.

    -- No checkout exists on the web, so a paid tier cannot honestly be
    -- bought there. Refused rather than published for free.
    if coalesce(v_plan.price_minor_units, 0) > 0
       and p_platform = 'web'
       and not private.setting_enabled('allow_development_purchases') then
      raise exception 'paid packages can only be purchased in the app'
        using errcode = '22023';
    end if;

    v_transaction_id := coalesce(
      p_platform_transaction_id,
      'dev-' || p_celebration_id::text || '-' || v_plan.key
    );

    insert into public.purchases (
      celebration_id, purchased_by, platform, platform_product_id,
      platform_transaction_id, plan_id, status,
      price_minor_units, currency, failure_code
    )
    values (
      p_celebration_id, (select auth.uid()), p_platform,
      coalesce(p_platform_product_id, v_plan.apple_product_id, v_plan.web_product_id, v_plan.key),
      v_transaction_id,
      v_plan.id, 'pending',
      v_plan.price_minor_units, v_plan.currency,
      'awaiting_receipt_verification'
    )
    on conflict (platform, platform_transaction_id) do update
      set updated_at = now()
    returning id into v_purchase_id;

    -- THE CHANGE. Entitlements are granted here only when there is nothing
    -- to verify. Everything else waits for the service role to call
    -- `private.activate_verified_purchase` once the store has confirmed the
    -- transaction — so a caller who invents a plan key gets a published
    -- event on the free tier, not the tier they asked for.
    if private.may_activate_without_receipt(p_platform, v_plan.price_minor_units) then
      update public.purchases
         set status = 'verified', verified_at = now(),
             failure_code = case
               when coalesce(v_plan.price_minor_units, 0) = 0 then null
               else 'unverified_development_purchase'
             end
       where id = v_purchase_id;

      perform private.activate_plan_entitlements(p_celebration_id, v_plan.id, v_purchase_id);
    end if;
  end if;

  if p_add_on_keys is not null and array_length(p_add_on_keys, 1) > 0 then
    foreach v_add_on_key in array p_add_on_keys
    loop
      select * into v_add_on from public.add_ons where key = v_add_on_key and is_active;
      if found then
        insert into public.purchases (
          celebration_id, purchased_by, platform, platform_product_id,
          platform_transaction_id, add_on_id, status,
          price_minor_units, currency, failure_code
        )
        values (
          p_celebration_id, (select auth.uid()), p_platform,
          coalesce(v_add_on.web_product_id, v_add_on.key),
          'dev-' || p_celebration_id::text || '-' || v_add_on.key,
          v_add_on.id, 'pending',
          v_add_on.price_minor_units, v_add_on.currency,
          'awaiting_receipt_verification'
        )
        on conflict (platform, platform_transaction_id) do update
          set updated_at = now()
        returning id into v_add_on_purchase_id;

        -- Same rule as plans: an add-on that cost money waits for its receipt.
        if private.may_activate_without_receipt(p_platform, v_add_on.price_minor_units) then
          update public.purchases
             set status = 'verified', verified_at = now()
           where id = v_add_on_purchase_id;

          insert into public.celebration_entitlements (
            celebration_id, entitlement_key, value,
            granted_by_add_on_id, granted_by_purchase_id
          )
          select p_celebration_id, ae.entitlement_key, ae.value, v_add_on.id, v_add_on_purchase_id
          from public.add_on_entitlements ae
          where ae.add_on_id = v_add_on.id
          on conflict (celebration_id, entitlement_key) do update
            set value = excluded.value,
                granted_by_add_on_id = excluded.granted_by_add_on_id,
                granted_by_purchase_id = excluded.granted_by_purchase_id,
                granted_at = now();
        end if;
      end if;
    end loop;
  end if;

  if v_celebration.event_code is null then
    update public.celebrations
    set event_code = private.generate_event_code()
    where id = p_celebration_id
    returning * into v_celebration;
  end if;

  update public.celebrations
    set status = 'published', published_at = now()
    where id = p_celebration_id
    returning * into v_celebration;

  update public.event_sessions
    set status = 'published'
    where id = v_session.id;

  return (
    v_celebration.id, v_session.id, v_celebration.public_slug,
    v_celebration.published_at, false, v_celebration.event_code
  )::public.published_celebration;
end;
$$;

-- ---------------------------------------------------------------------------
-- Upgrade
-- ---------------------------------------------------------------------------

create or replace function public.upgrade_celebration_plan(
  p_celebration_id uuid,
  p_plan_key text,
  p_platform_product_id text default null,
  p_platform_transaction_id text default null,
  p_platform public.purchase_platform default 'web'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_current public.plans%rowtype;
  v_current_key text;
  v_purchase_id uuid;
  v_transaction_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to upgrade this event' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where key = p_plan_key and is_active;
  if not found then
    raise exception 'unknown plan' using errcode = '22023';
  end if;

  v_current_key := public.celebration_plan_key(p_celebration_id);
  if v_current_key is not null then
    select * into v_current from public.plans where key = v_current_key;
    if found and v_current.tier_rank >= v_plan.tier_rank then
      return v_current.key;
    end if;
  end if;

  if coalesce(v_plan.price_minor_units, 0) > 0
     and p_platform = 'web'
     and not private.setting_enabled('allow_development_purchases') then
    raise exception 'upgrades can only be purchased in the app'
      using errcode = '22023';
  end if;

  v_transaction_id := coalesce(
    p_platform_transaction_id,
    'dev-upgrade-' || p_celebration_id::text || '-' || v_plan.key
  );

  insert into public.purchases (
    celebration_id, purchased_by, platform, platform_product_id,
    platform_transaction_id, plan_id, status,
    price_minor_units, currency, failure_code
  )
  values (
    p_celebration_id, (select auth.uid()), p_platform,
    coalesce(p_platform_product_id, v_plan.apple_product_id, v_plan.web_product_id, v_plan.key),
    v_transaction_id,
    v_plan.id, 'pending',
    v_plan.price_minor_units, v_plan.currency,
    'awaiting_receipt_verification'
  )
  on conflict (platform, platform_transaction_id) do update
    set updated_at = now()
  returning id into v_purchase_id;

  if private.may_activate_without_receipt(p_platform, v_plan.price_minor_units) then
    update public.purchases
       set status = 'verified', verified_at = now(),
           failure_code = 'unverified_development_purchase'
     where id = v_purchase_id;

    perform private.activate_plan_entitlements(p_celebration_id, v_plan.id, v_purchase_id);
    return v_plan.key;
  end if;

  -- Recorded, not granted. The caller polls `celebration_plan_key`, which
  -- keeps reporting the OLD tier until verification lands — the honest
  -- answer, since nothing has been confirmed yet.
  return coalesce(v_current_key, '');
end;
$$;

grant execute on function public.publish_celebration(uuid, text, text[], public.purchase_platform, text, text) to authenticated;
grant execute on function public.upgrade_celebration_plan(uuid, text, text, text, public.purchase_platform) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Service-role entry points
--
-- PostgREST only exposes `public`, so the verification endpoint cannot reach
-- `private.activate_verified_purchase` directly. These thin wrappers give it
-- a door, and the grants decide who may use it: execute is revoked from
-- `anon` and `authenticated` and given to `service_role` alone, so the only
-- caller is a process holding the service key — never a browser or a phone.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.activate_verified_purchase(
  p_platform public.purchase_platform,
  p_platform_transaction_id text,
  p_price_minor_units integer default null,
  p_currency char(3) default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.activate_verified_purchase(
    p_platform, p_platform_transaction_id, p_price_minor_units, p_currency);
$$;

create or replace function public.reverse_purchase(
  p_platform public.purchase_platform,
  p_platform_transaction_id text,
  p_status public.purchase_status
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.reverse_purchase(p_platform, p_platform_transaction_id, p_status);
$$;

revoke all on function public.activate_verified_purchase(public.purchase_platform, text, integer, char) from public, anon, authenticated;
revoke all on function public.reverse_purchase(public.purchase_platform, text, public.purchase_status) from public, anon, authenticated;
grant execute on function public.activate_verified_purchase(public.purchase_platform, text, integer, char) to service_role;
grant execute on function public.reverse_purchase(public.purchase_platform, text, public.purchase_status) to service_role;

comment on function public.activate_verified_purchase is
  'Service-role only. The single door through which a paid entitlement is '
  'granted, opened after the store has confirmed the transaction.';

commit;
