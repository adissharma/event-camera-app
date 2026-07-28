-- Plans, add-ons, entitlements and purchases.
--
-- Commercial rules are NEVER hard-coded in the interface. The app reads this
-- catalogue, so pricing, limits and packaging change without a release.
--
-- The schema carries product identifiers for all three billing surfaces from
-- the start, because App Store rules mean digital feature unlocking on iOS goes
-- through StoreKit and cannot be retrofitted cheaply. See docs/payments.md.

create type public.entitlement_value_kind as enum (
  'boolean', 'integer', 'unlimited', 'string', 'string_array', 'integer_array'
);

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  -- Ascending tier order. Drives upgrade direction and comparison ordering.
  tier_rank integer not null,

  price_minor_units integer not null default 0,
  currency char(3) not null default 'GBP',

  apple_product_id text,
  google_product_id text,
  web_product_id text,

  is_active boolean not null default true,
  sort_order integer not null default 100,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plans_key_format check (key ~ '^[a-z0-9_]+$'),
  constraint plans_price_non_negative check (price_minor_units >= 0),
  constraint plans_tier_rank_positive check (tier_rank >= 1)
);

comment on column public.plans.price_minor_units is
  'Minor units (pence). Never a float — currency arithmetic in floating point '
  'produces rounding errors that show up on invoices.';

create index plans_active_sort_idx on public.plans (is_active, sort_order);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- add_ons
-- ---------------------------------------------------------------------------

create table public.add_ons (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,

  price_minor_units integer not null default 0,
  currency char(3) not null default 'GBP',

  apple_product_id text,
  google_product_id text,
  web_product_id text,

  is_active boolean not null default true,
  sort_order integer not null default 100,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint add_ons_key_format check (key ~ '^[a-z0-9_]+$'),
  constraint add_ons_price_non_negative check (price_minor_units >= 0)
);

create trigger add_ons_set_updated_at
  before update on public.add_ons
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Entitlement definitions
-- ---------------------------------------------------------------------------

create table public.entitlement_definitions (
  key text primary key,
  name text not null,
  description text,
  value_kind public.entitlement_value_kind not null,
  -- Applied when no plan or add-on grants this entitlement.
  default_value jsonb not null,
  created_at timestamptz not null default now(),

  constraint entitlement_definitions_key_format check (key ~ '^[a-z0-9_]+$')
);

comment on table public.entitlement_definitions is
  'The vocabulary of what can be granted. A value is JSONB because entitlements '
  'are genuinely heterogeneous — booleans, counts, unlimited, and arrays of '
  'permitted options — and value_kind keeps that honest.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

create table public.plan_entitlements (
  plan_id uuid not null references public.plans (id) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions (key) on delete cascade,
  value jsonb not null,
  primary key (plan_id, entitlement_key)
);

create table public.add_on_entitlements (
  add_on_id uuid not null references public.add_ons (id) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions (key) on delete cascade,
  value jsonb not null,
  primary key (add_on_id, entitlement_key)
);

-- ---------------------------------------------------------------------------
-- purchases
-- ---------------------------------------------------------------------------

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  celebration_id uuid not null references public.celebrations (id) on delete cascade,
  purchased_by uuid references auth.users (id) on delete set null,

  platform public.purchase_platform not null,
  -- The store's own product identifier, kept so a receipt can be reconciled
  -- even if the catalogue row is later renamed.
  platform_product_id text not null,
  platform_transaction_id text not null,

  plan_id uuid references public.plans (id) on delete set null,
  add_on_id uuid references public.add_ons (id) on delete set null,

  status public.purchase_status not null default 'pending',
  price_minor_units integer,
  currency char(3),

  verified_at timestamptz,
  revoked_at timestamptz,
  failure_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchases_target_present check (
    plan_id is not null or add_on_id is not null
  )
);

comment on table public.purchases is
  'Verified store transactions. Verification is always server-side — a client '
  'claim of purchase is never trusted.';

-- Idempotency. A store may deliver the same transaction more than once, and a
-- restore replays every past transaction; neither may double-grant or double-charge.
create unique index purchases_platform_transaction_idx
  on public.purchases (platform, platform_transaction_id);

create index purchases_celebration_idx on public.purchases (celebration_id);

create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- celebration_entitlements
-- ---------------------------------------------------------------------------

create table public.celebration_entitlements (
  celebration_id uuid not null references public.celebrations (id) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions (key) on delete cascade,
  value jsonb not null,
  -- Provenance, so a support question about why something is unlocked is
  -- answerable without guesswork.
  granted_by_plan_id uuid references public.plans (id) on delete set null,
  granted_by_add_on_id uuid references public.add_ons (id) on delete set null,
  granted_by_purchase_id uuid references public.purchases (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,

  primary key (celebration_id, entitlement_key)
);

comment on table public.celebration_entitlements is
  'The resolved, activated entitlements for one celebration. Written by '
  'server-side purchase verification, never by a client.';

create index celebration_entitlements_celebration_idx
  on public.celebration_entitlements (celebration_id);
