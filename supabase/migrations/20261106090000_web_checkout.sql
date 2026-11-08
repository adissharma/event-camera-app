-- Web checkout through Stripe.
--
-- WHY
-- ---
-- Hosts can now create an event on the web and pay for its package there,
-- without installing the app first. The money is taken by Stripe Checkout;
-- this migration is the database's half: one service-role door that turns a
-- paid Checkout Session into a published event carrying the package it paid
-- for.
--
-- HOW IT FITS THE EXISTING RULES
-- ------------------------------
-- Nothing here loosens `publish_celebration`. A browser still cannot buy a
-- paid tier by calling it, and `allow_development_purchases` stays shut.
-- Instead:
--
--   1. The host's browser creates the draft exactly as the app does
--      (`create_celebration_with_default_session`), as the host.
--   2. Our server creates a Stripe Checkout Session for that draft, with the
--      celebration, the host and the plan written into its metadata. Only the
--      server can write that metadata, so Stripe hands it back intact.
--   3. When Stripe reports the session paid (the webhook, or the return page
--      asking the server to check), the server retrieves the session from
--      Stripe and calls `complete_web_checkout` below.
--
-- `complete_web_checkout` acts AS the host — it sets the request's JWT claims
-- to the host's id for this transaction — so every check `publish_celebration`
-- makes (that the event exists, belongs to them, has a closing time and a
-- guest link) runs unchanged. It publishes on the free tier, records the
-- Stripe purchase, and grants the package through
-- `private.activate_verified_purchase`: the same single door App Store
-- purchases go through, so refunds, provenance and idempotency all behave the
-- same way for both.
--
-- Because the event belongs to the host's account, the package is there when
-- they sign in to the app with that account. There is nothing to sync.

begin;

-- ---------------------------------------------------------------------------
-- Quote: what a Checkout Session for this draft should charge.
--
-- Asked before Stripe is involved, so a host is never charged for an event
-- they could not then publish. A function rather than table reads from the
-- server, so the endpoint needs no table grants of its own.
-- ---------------------------------------------------------------------------

create or replace function private.web_checkout_quote(
  p_celebration_id uuid,
  p_user_id uuid,
  p_plan_key text
)
returns table (
  title text,
  plan_key text,
  plan_name text,
  price_minor_units integer,
  currency char(3)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_celebration public.celebrations%rowtype;
  v_plan public.plans%rowtype;
  v_may_manage boolean;
begin
  select * into v_celebration
  from public.celebrations
  where id = p_celebration_id and deleted_at is null;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
  v_may_manage := private.can_manage_celebration(p_celebration_id);
  perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);

  if not v_may_manage then
    raise exception 'not permitted to publish this event' using errcode = '42501';
  end if;

  if v_celebration.status <> 'draft' then
    raise exception 'event already published' using errcode = '23505';
  end if;

  select * into v_plan from public.plans where key = p_plan_key and is_active;
  if not found then
    raise exception 'unknown plan' using errcode = '22023';
  end if;

  if coalesce(v_plan.price_minor_units, 0) <= 0 then
    raise exception 'free plans do not go through checkout' using errcode = '22023';
  end if;

  return query select
    v_celebration.title, v_plan.key, v_plan.name,
    v_plan.price_minor_units, v_plan.currency;
end;
$$;

create or replace function public.web_checkout_quote(
  p_celebration_id uuid,
  p_user_id uuid,
  p_plan_key text
)
returns table (
  title text,
  plan_key text,
  plan_name text,
  price_minor_units integer,
  currency char(3)
)
language sql
security definer
set search_path = ''
as $$
  select * from private.web_checkout_quote(p_celebration_id, p_user_id, p_plan_key);
$$;

revoke all on function private.web_checkout_quote(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.web_checkout_quote(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.web_checkout_quote(uuid, uuid, text) to service_role;
grant execute on function public.web_checkout_quote(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Completion
-- ---------------------------------------------------------------------------

create or replace function private.complete_web_checkout(
  p_celebration_id uuid,
  p_user_id uuid,
  p_plan_key text,
  p_checkout_session_id text,
  p_amount_minor_units integer,
  p_currency char(3)
)
returns table (celebration_id uuid, event_code text, plan_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_free_plan_key text;
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_celebration public.celebrations%rowtype;
  v_purchase public.purchases%rowtype;
begin
  if p_checkout_session_id is null or p_checkout_session_id !~ '^cs_' then
    raise exception 'not a checkout session id' using errcode = '22023';
  end if;

  select * into v_plan from public.plans where key = p_plan_key and is_active;
  if not found then
    raise exception 'unknown plan' using errcode = '22023';
  end if;

  if coalesce(v_plan.price_minor_units, 0) <= 0 then
    raise exception 'free plans do not go through checkout' using errcode = '22023';
  end if;

  -- Stripe charged what our server asked it to, and our server asked for the
  -- catalogue price. Checked again here so a catalogue price raised between
  -- checkout and payment cannot be redeemed at the old, lower amount — and so
  -- a mistake upstream fails closed rather than granting a tier for less.
  if p_amount_minor_units is null
     or p_amount_minor_units < v_plan.price_minor_units
     or upper(p_currency) <> upper(v_plan.currency) then
    raise exception 'amount paid does not cover this package' using errcode = '22023';
  end if;

  -- Idempotent: Stripe retries webhooks, and the return page races the
  -- webhook by design. A session already applied returns what it produced.
  select * into v_purchase
  from public.purchases
  where platform = 'web' and platform_transaction_id = p_checkout_session_id;

  if found then
    if v_purchase.celebration_id <> p_celebration_id then
      raise exception 'checkout session belongs to another event' using errcode = '22023';
    end if;
    if v_purchase.status in ('refunded', 'revoked') then
      raise exception 'purchase was reversed' using errcode = '22023';
    end if;
  end if;

  -- Act as the host for the rest of this transaction. `auth.uid()` reads
  -- these claims, so `publish_celebration` checks the host's own permission
  -- to publish — a session for an event they no longer manage is refused.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );

  select key into v_free_plan_key
  from public.plans
  where is_active and coalesce(price_minor_units, 0) = 0
  order by tier_rank
  limit 1;

  -- Published on the free tier first, exactly as an App Store purchase
  -- awaiting verification is. Returns early for an event already published.
  perform public.publish_celebration(
    p_celebration_id,
    v_free_plan_key,
    array[]::text[],
    'web'
  );

  insert into public.purchases (
    celebration_id, purchased_by, platform, platform_product_id,
    platform_transaction_id, plan_id, status,
    price_minor_units, currency, failure_code
  )
  values (
    p_celebration_id, p_user_id, 'web',
    coalesce(v_plan.web_product_id, v_plan.key),
    p_checkout_session_id,
    v_plan.id, 'pending',
    p_amount_minor_units, upper(p_currency),
    'awaiting_receipt_verification'
  )
  on conflict (platform, platform_transaction_id) do nothing;

  perform private.activate_verified_purchase(
    'web', p_checkout_session_id, p_amount_minor_units, upper(p_currency));

  perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);

  select * into v_celebration from public.celebrations where id = p_celebration_id;

  return query select v_celebration.id, v_celebration.event_code, v_plan.key;
end;
$$;

comment on function private.complete_web_checkout is
  'Publishes a web-created event and grants the package a paid Stripe '
  'Checkout Session bought. Service role only, called after the server has '
  'retrieved the session from Stripe and confirmed it paid.';

create or replace function public.complete_web_checkout(
  p_celebration_id uuid,
  p_user_id uuid,
  p_plan_key text,
  p_checkout_session_id text,
  p_amount_minor_units integer,
  p_currency char(3)
)
returns table (celebration_id uuid, event_code text, plan_key text)
language sql
security definer
set search_path = ''
as $$
  select * from private.complete_web_checkout(
    p_celebration_id, p_user_id, p_plan_key,
    p_checkout_session_id, p_amount_minor_units, p_currency);
$$;

revoke all on function private.complete_web_checkout(uuid, uuid, text, text, integer, char) from public, anon, authenticated;
revoke all on function public.complete_web_checkout(uuid, uuid, text, text, integer, char) from public, anon, authenticated;
grant execute on function private.complete_web_checkout(uuid, uuid, text, text, integer, char) to service_role;
grant execute on function public.complete_web_checkout(uuid, uuid, text, text, integer, char) to service_role;

comment on function public.complete_web_checkout is
  'Service-role only. Stripe Checkout''s door into the same verified-purchase '
  'path App Store purchases use.';

commit;
