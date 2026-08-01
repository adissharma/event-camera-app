-- Add event codes for guest QR code generation.
--
-- Each event gets a 6-character random code (e.g., "ABC123") for guest invitations.
-- This is separate from the internal public_slug to avoid guessing attacks.

-- Add event_code column
alter table public.celebrations
add column event_code text unique;

-- Constraint: 6 uppercase alphanumeric characters
alter table public.celebrations
add constraint celebrations_event_code_format
check (event_code ~ '^[A-Z0-9]{6}$');

-- Function to generate a 6-character event code
create or replace function private.generate_event_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'Failed to generate unique event code after 10 attempts';
    end if;

    -- Generate random 6-char code: A-Z, 0-9
    v_code := (
      select string_agg(chr(ascii_code), '')
      from (
        select ascii_code
        from (
          select 65 + (random() * 26)::int as ascii_code  -- A-Z
          union all
          select 48 + (random() * 10)::int as ascii_code  -- 0-9
        ) chars
        order by random()
        limit 6
      ) selected
    );

    -- Check uniqueness
    if not exists(select 1 from public.celebrations where event_code = v_code) then
      return v_code;
    end if;
  end loop;
end;
$$;

-- Update the publish_celebration function to generate event code if not already set
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
  for update;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  -- Generate event code if not already present
  if v_celebration.event_code is null then
    update public.celebrations
    set event_code = private.generate_event_code()
    where id = p_celebration_id
    returning * into v_celebration;
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = p_celebration_id and deleted_at is null
  order by sequence_number
  limit 1;

  if not found then
    raise exception 'event has no session to publish' using errcode = '22023';
  end if;

  -- Check if already published
  if v_session.published_at is not null then
    return (
      v_celebration.id,
      v_session.id,
      v_celebration.public_slug,
      v_session.published_at,
      true
    )::public.published_celebration;
  end if;

  -- Mark session as published
  update public.event_sessions
  set published_at = now()
  where id = v_session.id;

  -- Activate plan entitlements
  if p_plan_key is not null then
    select * into v_plan
    from public.plans
    where key = p_plan_key;

    if found then
      insert into public.plan_purchases (user_id, plan_id)
      values (auth.uid(), v_plan.id)
      on conflict (user_id, plan_id) do update
      set purchased_at = now()
      returning id into v_purchase_id;

      perform private.activate_plan_entitlements(p_celebration_id, v_plan.id, v_purchase_id);
    end if;
  end if;

  -- Activate add-ons
  foreach v_add_on_key in array p_add_on_keys loop
    select * into v_add_on
    from public.add_ons
    where key = v_add_on_key;

    if found then
      insert into public.add_on_purchases (user_id, add_on_id)
      values (auth.uid(), v_add_on.id)
      on conflict (user_id, add_on_id) do update
      set purchased_at = now()
      returning id into v_add_on_purchase_id;

      perform private.activate_plan_entitlements(
        p_celebration_id,
        null::uuid,
        v_add_on_purchase_id
      );
    end if;
  end loop;

  return (
    v_celebration.id,
    v_session.id,
    v_celebration.public_slug,
    now(),
    false
  )::public.published_celebration;
end;
$$;
