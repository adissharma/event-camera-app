-- Promo codes: a code that makes a package free.
--
-- WHY
-- ---
-- Hosts can enter a code on the paywall and get the package they picked for
-- nothing. No store or Stripe transaction takes place, so there is no receipt
-- to verify; the code is the only thing standing between a caller and a paid
-- tier, and it is checked here rather than in the app.
--
-- HOW IT FITS THE EXISTING RULES
-- ------------------------------
-- `publish_celebration` is unchanged and still refuses a paid tier on the
-- web platform. `publish_celebration_with_promo` publishes on the free tier
-- first, records a zero-priced purchase, and grants the package through
-- `private.activate_verified_purchase`: the same door App Store and Stripe
-- purchases use, so `private.reverse_purchase` can withdraw it too.
--
-- MANAGING CODES
-- --------------
-- Both tables are in `private`, so no client can read them. Add and revoke
-- codes with the queries in `supabase/snippets/promo_codes.sql`.

begin;

create table private.promo_codes (
  id uuid primary key default gen_random_uuid(),
  -- Matched case-insensitively, so `Friends` and `FRIENDS` are one code.
  code text not null check (length(btrim(code)) > 0),
  -- For us: who or what this code was made for.
  note text,
  -- Total uses across everyone. Null means no limit.
  max_redemptions integer check (max_redemptions > 0),
  -- Uses per account. Null means no limit.
  max_per_account integer default 1 check (max_per_account > 0),
  expires_at timestamptz,
  -- Set this to stop a code working. Events already made with it keep their
  -- package.
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index promo_codes_code_key on private.promo_codes (upper(btrim(code)));

create table private.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references private.promo_codes (id) on delete cascade,
  -- Set null rather than cascaded: a deleted event or account must still
  -- count against the code's limit.
  celebration_id uuid unique references public.celebrations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  purchase_id uuid references public.purchases (id) on delete set null,
  redeemed_at timestamptz not null default now()
);

create index promo_code_redemptions_code_idx
  on private.promo_code_redemptions (promo_code_id, user_id);

-- Wrong guesses, so a code cannot be found by trying them in bulk.
create table private.promo_code_failed_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index promo_code_failed_attempts_user_idx
  on private.promo_code_failed_attempts (user_id, attempted_at);

alter table private.promo_codes enable row level security;
alter table private.promo_code_redemptions enable row level security;
alter table private.promo_code_failed_attempts enable row level security;

revoke all on private.promo_codes from public, anon, authenticated;
revoke all on private.promo_code_redemptions from public, anon, authenticated;
revoke all on private.promo_code_failed_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The one decision about whether a code can be used.
--
-- Locks the code's row, so two hosts taking the last use of a code queue up
-- instead of both getting it. Returns a status rather than raising, because
-- raising would roll back the failed attempt it has just recorded.
-- ---------------------------------------------------------------------------

create or replace function private.evaluate_promo_code(
  p_code text,
  p_user_id uuid,
  out status text,
  out promo_code_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code private.promo_codes%rowtype;
begin
  if (
    select count(*) >= 10
    from private.promo_code_failed_attempts a
    where a.user_id = p_user_id
      and a.attempted_at > now() - interval '1 hour'
  ) then
    status := 'rate_limited';
    return;
  end if;

  select * into v_code
  from private.promo_codes c
  where upper(btrim(c.code)) = upper(btrim(p_code))
  for update;

  if not found
     or v_code.revoked_at is not null
     or (v_code.expires_at is not null and v_code.expires_at <= now()) then
    insert into private.promo_code_failed_attempts (user_id) values (p_user_id);
    delete from private.promo_code_failed_attempts a
     where a.user_id = p_user_id
       and a.attempted_at <= now() - interval '1 day';
    status := 'invalid';
    return;
  end if;

  if v_code.max_per_account is not null and (
    select count(*) >= v_code.max_per_account
    from private.promo_code_redemptions r
    where r.promo_code_id = v_code.id and r.user_id = p_user_id
  ) then
    status := 'already_used';
    return;
  end if;

  if v_code.max_redemptions is not null and (
    select count(*) >= v_code.max_redemptions
    from private.promo_code_redemptions r
    where r.promo_code_id = v_code.id
  ) then
    status := 'used_up';
    return;
  end if;

  status := 'valid';
  promo_code_id := v_code.id;
end;
$$;

revoke all on function private.evaluate_promo_code(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Check: can this code be applied? Uses nothing up.
-- ---------------------------------------------------------------------------

create or replace function public.check_promo_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return (select e.status from private.evaluate_promo_code(p_code, v_user_id) e);
end;
$$;

comment on function public.check_promo_code is
  'Whether the signed-in host can use a code: valid, invalid, already_used, '
  'used_up or rate_limited. Does not redeem it.';

revoke all on function public.check_promo_code(text) from public, anon;
grant execute on function public.check_promo_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Redeem and publish, in one transaction.
--
-- Returns null when the code cannot be used, for the same reason the
-- evaluation returns a status: an exception would undo the record of a wrong
-- guess, and this function could then be used to guess freely.
-- ---------------------------------------------------------------------------

create or replace function public.publish_celebration_with_promo(
  p_celebration_id uuid,
  p_plan_key text,
  p_code text
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
  v_free_plan_key text;
  v_transaction_id text := 'promo-' || p_celebration_id::text;
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
    p_celebration_id, v_user_id, 'web', v_plan.key,
    v_transaction_id, v_plan.id, 'pending',
    0, v_plan.currency, 'awaiting_receipt_verification'
  )
  returning id into v_purchase_id;

  perform private.activate_verified_purchase('web', v_transaction_id, 0, v_plan.currency);

  insert into private.promo_code_redemptions (
    promo_code_id, celebration_id, user_id, purchase_id
  )
  values (v_promo_code_id, p_celebration_id, v_user_id, v_purchase_id);

  return v_result;
end;
$$;

comment on function public.publish_celebration_with_promo is
  'Publishes a draft with the package a valid promo code makes free. Returns '
  'null if the code cannot be used.';

revoke all on function public.publish_celebration_with_promo(uuid, text, text) from public, anon;
grant execute on function public.publish_celebration_with_promo(uuid, text, text) to authenticated;

commit;
