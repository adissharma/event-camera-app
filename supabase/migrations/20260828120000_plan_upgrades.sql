-- ---------------------------------------------------------------------------
-- Package upgrades for an already-published event.
--
-- `publish_celebration` grants a plan once, at publish time. There was no way
-- to move an event up a tier afterwards, so a host who bought Small Event and
-- then wanted Guestbook had nowhere to go.
--
-- These tiers are one-time purchases rather than subscriptions, so the store
-- has no proration to offer: the client buys a per-path upgrade product priced
-- at the difference between the two tiers (see
-- `src/features/payments/upgrade-catalogue.ts`) and then calls this. The
-- product collected the delta; the entitlements written here are the
-- destination tier's in full.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Which plan is an event on?
-- ---------------------------------------------------------------------------

create or replace function public.celebration_plan_key(p_celebration_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- The highest tier that granted any of this event's entitlements. Highest
  -- rather than most recent: an upgrade rewrites the rows it supersedes but
  -- leaves any it does not, so recency would report the older plan whenever
  -- the newer one happened to grant fewer keys.
  select p.key
  from public.celebration_entitlements ce
  join public.plans p on p.id = ce.granted_by_plan_id
  where ce.celebration_id = p_celebration_id
    and (ce.expires_at is null or ce.expires_at > now())
  order by p.tier_rank desc
  limit 1;
$$;

comment on function public.celebration_plan_key is
  'The package an event is currently on, as a plans.key. Null for an event '
  'with no plan-granted entitlements — treat that as granting nothing, never '
  'as granting everything.';

-- Readable by anyone who can reach the event at all. A guest needs this to
-- know whether the event has a guestbook; it reveals only the tier name, and
-- the guest UI uses it to hide features rather than to offer upgrades.
grant execute on function public.celebration_plan_key(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Move an event up a tier
-- ---------------------------------------------------------------------------

create or replace function public.upgrade_celebration_plan(
  p_celebration_id uuid,
  p_plan_key text,
  p_platform_product_id text default null,
  p_platform_transaction_id text default null
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
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Only the host buys. A guest must never be able to reach this, upgrade
  -- prompts being host-only by design.
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

    -- Already there: succeed without charging or rewriting anything. A client
    -- retrying after a dropped response must get the same answer, not a
    -- second purchase row.
    if found and v_current.tier_rank >= v_plan.tier_rank then
      return v_current.key;
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- PRE-LAUNCH BEHAVIOUR — same caveat as `publish_celebration`.
  --
  -- Recorded as 'pending' and activated immediately, with no verified store
  -- receipt. Correct for development, NOT acceptable in production: anyone
  -- able to call this could grant themselves any tier. Before launch this
  -- must move behind server-side receipt verification and refuse to activate
  -- without a `purchases` row at status = 'verified'.
  -- ------------------------------------------------------------------
  insert into public.purchases (
    celebration_id, purchased_by, platform, platform_product_id,
    platform_transaction_id, plan_id, status,
    price_minor_units, currency, failure_code
  )
  values (
    p_celebration_id, (select auth.uid()), 'web',
    coalesce(p_platform_product_id, v_plan.web_product_id, v_plan.key),
    coalesce(
      p_platform_transaction_id,
      'dev-upgrade-' || p_celebration_id::text || '-' || v_plan.key
    ),
    v_plan.id, 'pending',
    -- The delta actually charged is the client's business and the store's
    -- receipt; what is recorded here is the tier this row grants.
    v_plan.price_minor_units, v_plan.currency,
    'unverified_development_purchase'
  )
  on conflict (platform, platform_transaction_id) do update
    set updated_at = now()
  returning id into v_purchase_id;

  perform private.activate_plan_entitlements(p_celebration_id, v_plan.id, v_purchase_id);

  return v_plan.key;
end;
$$;

comment on function public.upgrade_celebration_plan is
  'Moves a published event up to a higher package and activates that tier''s '
  'entitlements. Idempotent, and refuses to move an event down a tier.';

grant execute on function public.upgrade_celebration_plan(uuid, text, text, text) to authenticated;
