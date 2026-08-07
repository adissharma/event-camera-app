-- Fixes a regression introduced in 20260801140000_event_codes.sql, which
-- rewrote publish_celebration to add event-code generation but silently
-- dropped most of the function's actual publishing logic in the process, and
-- introduced a genuine bug on top of that:
--
-- 1. `v_session.published_at` — `event_sessions` has no such column;
--    `published_at` lives on `celebrations` (see 20260728100100_core_tables.sql).
--    Raised "record \"v_session\" has no field \"published_at\"" on every call.
-- 2. Even past that, the function tried to return `event_code` as part of the
--    `published_celebration` composite type, but that type was never altered
--    to carry an `event_code` attribute — the RETURN would have failed with a
--    wrong-number-of-columns error regardless.
-- 3. Along the way, the rewrite dropped: the archived-status guard, the
--    "needs a closing time" guard, the "needs an active guest access link"
--    guard, strict plan-key validation (silently skipping an unknown plan
--    instead of rejecting it), and real idempotency (checked `event_sessions`
--    instead of `celebrations.status`, which the rest of the schema treats as
--    the source of truth for publication state).
--
-- This restores the original function's full logic from
-- 20260728101100_publication.sql and layers the event-code generation on top
-- of it, rather than the other way around.

alter type public.published_celebration add attribute event_code text;

create or replace function public.publish_celebration(
  p_celebration_id uuid,
  p_plan_key text default null,
  p_add_on_keys text[] default array[]::text[]
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
  -- Serialises concurrent publish attempts on the same row, which is what
  -- makes the double-tap case safe rather than merely unlikely.
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

  -- IDEMPOTENCY. Already published is a success, not an error: the caller
  -- retrying after a timeout wants the same answer, not a failure.
  if v_celebration.status = 'published' then
    return (
      v_celebration.id, v_session.id, v_celebration.public_slug,
      v_celebration.published_at, true, v_celebration.event_code
    )::public.published_celebration;
  end if;

  if v_celebration.status = 'archived' then
    raise exception 'event is archived' using errcode = '42501';
  end if;

  -- Refuse to publish something guests cannot use.
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

    -- ------------------------------------------------------------------
    -- PRE-LAUNCH BEHAVIOUR — see docs/payments.md
    --
    -- The purchase row is recorded as 'pending' and entitlements are activated
    -- immediately, WITHOUT a verified store receipt. That is correct for
    -- development and is NOT acceptable in production: anyone able to call this
    -- function would grant themselves any plan.
    --
    -- Before launch, activation must move behind server-side receipt
    -- verification in an Edge Function, and this function must refuse to
    -- activate anything that has no `purchases` row with status = 'verified'.
    -- The schema already carries the provenance needed to do that.
    -- ------------------------------------------------------------------
    insert into public.purchases (
      celebration_id, purchased_by, platform, platform_product_id,
      platform_transaction_id, plan_id, status,
      price_minor_units, currency, failure_code
    )
    values (
      p_celebration_id, (select auth.uid()), 'web',
      coalesce(v_plan.web_product_id, v_plan.key),
      'dev-' || p_celebration_id::text || '-' || v_plan.key,
      v_plan.id, 'pending',
      v_plan.price_minor_units, v_plan.currency,
      'unverified_development_purchase'
    )
    on conflict (platform, platform_transaction_id) do update
      set updated_at = now()
    returning id into v_purchase_id;

    perform private.activate_plan_entitlements(p_celebration_id, v_plan.id, v_purchase_id);
  end if;

  -- Activate add-ons if provided
  if p_add_on_keys is not null and array_length(p_add_on_keys, 1) > 0 then
    foreach v_add_on_key in array p_add_on_keys
    loop
      select * into v_add_on from public.add_ons where key = v_add_on_key and is_active;
      if found then
        -- Insert purchase for the add-on
        insert into public.purchases (
          celebration_id, purchased_by, platform, platform_product_id,
          platform_transaction_id, add_on_id, status,
          price_minor_units, currency, failure_code
        )
        values (
          p_celebration_id, (select auth.uid()), 'web',
          coalesce(v_add_on.web_product_id, v_add_on.key),
          'dev-' || p_celebration_id::text || '-' || v_add_on.key,
          v_add_on.id, 'pending',
          v_add_on.price_minor_units, v_add_on.currency,
          'unverified_development_purchase'
        )
        on conflict (platform, platform_transaction_id) do update
          set updated_at = now()
        returning id into v_add_on_purchase_id;

        -- Copy add-on entitlements onto celebration
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
    end loop;
  end if;

  -- Generate the guest-facing event code, if this celebration doesn't have
  -- one yet. Separate from the closing status/published_at update below so a
  -- retry that reaches this function again (e.g. after a client timeout that
  -- masked a prior success) never regenerates it.
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

comment on function public.publish_celebration is
  'Idempotent publication. Publishing an already-published event returns the '
  'same result rather than erroring, so a retry after a timeout converges. '
  'Refuses to publish an event with no closing time or no guest access link. '
  'Generates a guest-facing event_code on first publish.';

revoke all on function public.publish_celebration from public, anon;
grant execute on function public.publish_celebration to authenticated;
