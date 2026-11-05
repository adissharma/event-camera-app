-- Enforce the paid features on the server.
--
-- WHY
-- ---
-- `plan_entitlements` says what each package grants and `celebration_entitlements`
-- copies that onto the event, but no database code read the grants for video,
-- photo allowance, Guestbook or Challenges. Only the app's own gates did, so
-- anyone calling the API directly got them for free:
--
--   * Video. `allowed_media_types` was the only check, and it does not describe
--     the package: the app sends 'video' for every event, and upgrades never
--     touched the column.
--   * Photo allowance. Any manager could write any `shot_limit_per_guest`.
--   * Guestbook and Challenges. Nothing looked. A 'guestbook' tag in an upload's
--     metadata also skipped the media type check and the shot limit, on any plan.
--
-- WHAT
-- ----
-- The rules live on the tables rather than in each function, for the reason
-- 20261105120000 gives for guest limits: media arrives through three upload
-- functions and has been rewritten repeatedly, and challenges and session settings
-- are written straight through RLS. On the table, a new way in cannot forget.
--
-- An event's grants are the authority. A key nobody granted means not included,
-- matching the app's `entitlementsForPlan`.
--
-- WHAT IS DELIBERATELY NOT REFUSED
-- --------------------------------
-- Only new use is gated. Nothing here deletes or hides anything:
--
--   * Reads stay open. Media, Guestbook messages and challenge submissions already
--     on an event remain readable, whatever its package is now.
--   * Retries pass. The checks run on what a write adds, so an upload accepted
--     before this migration can still finish.
--   * Existing photo limits stand. A limit above the package is kept and can be
--     lowered. It just cannot be raised again beyond what the package allows.
--
-- WHY A CEILING, NOT THE OPTIONS LIST
-- -----------------------------------
-- `photo_limit_options` is read as its highest value rather than as an exact list.
-- The app offers [5, 10, 16, 24, 36] and the plans list [5, 10, 15, 20, 25], so
-- requiring a listed value would refuse the app's own 16 on every package. See the
-- note on `PHOTOS_PER_GUEST` in plan-catalogue.ts.
--
-- WHY CREATION DOES NOT REFUSE ANYTHING
-- -------------------------------------
-- The app creates the draft before the host has paid, so at creation there is no
-- package to check against. The check waits until there is one: the first plan
-- activated on an event brings its limit down to what that plan allows.

begin;

-- ---------------------------------------------------------------------------
-- Reading an event's package
-- ---------------------------------------------------------------------------

create function private.celebration_grant(p_celebration_id uuid, p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select ce.value
  from public.celebration_entitlements ce
  where ce.celebration_id = p_celebration_id
    and ce.entitlement_key = p_key
    and (ce.expires_at is null or ce.expires_at > now());
$$;

create function private.celebration_has_feature(p_celebration_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.celebration_grant(p_celebration_id, p_key) = 'true'::jsonb, false);
$$;

comment on function private.celebration_has_feature(uuid, text) is
  'Whether an event''s package includes a boolean feature. No grant means no.';

-- The most photos per guest a host may set, or null when nothing caps it: either
-- the package is unlimited, or the event has no package to read yet.
create function private.celebration_photo_ceiling(p_celebration_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.celebration_has_feature(p_celebration_id, 'unlimited_photos') then null
    else (
      select max(option::integer)
      from jsonb_array_elements_text(
        coalesce(private.celebration_grant(p_celebration_id, 'photo_limit_options'), '[]'::jsonb)
      ) as option
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Video, Guestbook and Challenges uploads
-- ---------------------------------------------------------------------------

-- Set once, when this migration lands, so the fallback below applies only to
-- events published from now on.
insert into private.app_settings (key, value, description)
values (
  'package_enforcement_started_at',
  to_jsonb(now()),
  'When server-side package enforcement began. Events published before this are '
  'not capped for having no package, because we cannot tell an old event from one '
  'whose payment never reached us.'
)
on conflict (key) do nothing;

create function private.enforce_media_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration_id uuid;
  v_kind text := coalesce(new.metadata ->> 'submission_kind', '');
  v_old_kind text;
  -- Judged by the file as well as the label: without the mime type, a video
  -- reserved as a 'photo' would walk straight past the check.
  v_is_video boolean := new.media_type = 'video' or lower(coalesce(new.mime_type, '')) like 'video/%';
  v_is_audio boolean := new.media_type = 'audio' or lower(coalesce(new.mime_type, '')) like 'audio/%';
  v_was_video boolean := false;
  v_was_audio boolean := false;
  v_published_at timestamptz;
  v_allowance integer;
  v_shots_used integer;
begin
  select s.celebration_id, c.published_at into v_celebration_id, v_published_at
  from public.event_sessions s
  join public.celebrations c on c.id = s.celebration_id
  where s.id = new.event_session_id;

  if tg_op = 'UPDATE' then
    v_old_kind := coalesce(old.metadata ->> 'submission_kind', '');
    v_was_video := old.media_type = 'video' or lower(coalesce(old.mime_type, '')) like 'video/%';
    v_was_audio := old.media_type = 'audio' or lower(coalesce(old.mime_type, '')) like 'audio/%';
  end if;

  -- Only what this write adds is judged. An upload retried, finalised or moderated
  -- on an event that has since lost a feature keeps what it already is.
  if v_kind is distinct from v_old_kind then
    if v_kind = 'guestbook' and not private.celebration_has_feature(v_celebration_id, 'audio_guestbook') then
      raise exception 'this event''s package does not include the guestbook' using errcode = '42501';
    end if;
    if v_kind = 'challenge' and not private.celebration_has_feature(v_celebration_id, 'challenges') then
      raise exception 'this event''s package does not include challenges' using errcode = '42501';
    end if;
  end if;

  if v_is_audio and not v_was_audio
     and not private.celebration_has_feature(v_celebration_id, 'audio_guestbook') then
    raise exception 'this event does not allow this media type' using errcode = '42501';
  end if;

  -- A Guestbook message may be a video on a package that does not otherwise take
  -- them, as the upload functions have always allowed.
  if v_is_video and v_kind <> 'guestbook'
     and (not v_was_video or v_old_kind = 'guestbook')
     and not coalesce(private.celebration_grant(v_celebration_id, 'media_types') ? 'video', false) then
    raise exception 'this event does not allow this media type' using errcode = '42501';
  end if;

  -- An event published with no package holds whatever limit its draft asked for,
  -- and a purchase that never verifies would leave it there for good. Its guests
  -- get the lowest package's allowance until a plan activates. The limit itself is
  -- left alone, since a real purchase still on its way may allow it.
  if tg_op = 'INSERT' and new.guest_session_id is not null and v_kind <> 'guestbook'
     and private.celebration_grant(v_celebration_id, 'unlimited_photos') is null
     and private.celebration_grant(v_celebration_id, 'photo_limit_options') is null
     and v_published_at >= (
       select (value #>> '{}')::timestamptz
       from private.app_settings
       where key = 'package_enforcement_started_at'
     ) then
    select case
      when pe_unlimited.value = 'true'::jsonb then null
      else (select max(option::integer) from jsonb_array_elements_text(pe_options.value) as option)
    end into v_allowance
    from public.plans p
    left join public.plan_entitlements pe_unlimited
      on pe_unlimited.plan_id = p.id and pe_unlimited.entitlement_key = 'unlimited_photos'
    left join public.plan_entitlements pe_options
      on pe_options.plan_id = p.id and pe_options.entitlement_key = 'photo_limit_options'
    where p.is_active
    order by p.tier_rank asc
    limit 1;

    if v_allowance is not null then
      select count(*)::integer into v_shots_used
      from public.media_items
      where guest_session_id = new.guest_session_id and deleted_at is null and status <> 'permanent_failed'
        and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

      if v_shots_used >= v_allowance then
        raise exception 'shot limit reached' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger media_items_enforce_entitlements
  before insert or update of media_type, mime_type, metadata on public.media_items
  for each row execute function private.enforce_media_entitlements();

-- ---------------------------------------------------------------------------
-- Photo allowance
-- ---------------------------------------------------------------------------

create function private.enforce_photo_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ceiling integer;
begin
  -- Keeping or lowering is always allowed, including from a limit above the package.
  if tg_op = 'UPDATE' and (
    old.shot_limit_per_guest is not distinct from new.shot_limit_per_guest
    or old.shot_limit_per_guest is null
    or new.shot_limit_per_guest <= old.shot_limit_per_guest
  ) then
    return new;
  end if;

  v_ceiling := private.celebration_photo_ceiling(new.celebration_id);

  if v_ceiling is not null and (new.shot_limit_per_guest is null or new.shot_limit_per_guest > v_ceiling) then
    raise exception 'this photo limit is not included in this event''s package' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger event_sessions_enforce_photo_allowance
  before insert or update of shot_limit_per_guest on public.event_sessions
  for each row execute function private.enforce_photo_allowance();

create or replace function private.activate_plan_entitlements(
  p_celebration_id uuid,
  p_plan_id uuid,
  p_purchase_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_first_plan boolean;
  v_ceiling integer;
begin
  v_is_first_plan := not exists (
    select 1 from public.celebration_entitlements
    where celebration_id = p_celebration_id and granted_by_plan_id is not null
  );

  insert into public.celebration_entitlements (
    celebration_id, entitlement_key, value,
    granted_by_plan_id, granted_by_purchase_id
  )
  select p_celebration_id, pe.entitlement_key, pe.value, p_plan_id, p_purchase_id
  from public.plan_entitlements pe
  where pe.plan_id = p_plan_id
  on conflict (celebration_id, entitlement_key) do update
    set value = excluded.value,
        granted_by_plan_id = excluded.granted_by_plan_id,
        granted_by_purchase_id = excluded.granted_by_purchase_id,
        granted_at = now();

  perform private.restore_paid_add_on_features(p_celebration_id);

  -- The first plan is the moment the draft's choice meets a package. Never on a
  -- later plan: an upgrade must not take back a limit the event already has.
  if v_is_first_plan then
    v_ceiling := private.celebration_photo_ceiling(p_celebration_id);
    if v_ceiling is not null then
      update public.event_sessions
        set shot_limit_per_guest = v_ceiling
        where celebration_id = p_celebration_id
          and (shot_limit_per_guest is null or shot_limit_per_guest > v_ceiling);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- `allowed_media_types` follows the package
-- ---------------------------------------------------------------------------

-- The upload functions still check this column, so an upgrade that did not reach
-- it would sell a host video and then refuse it. On the grant rather than in the
-- activation function, because add-ons and refunds write grants too.
create function private.sync_session_media_types()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration_id uuid := coalesce(new.celebration_id, old.celebration_id);
  v_types public.media_type[];
begin
  if coalesce(new.entitlement_key, old.entitlement_key) <> 'media_types' then
    return null;
  end if;

  select array_agg(distinct type::public.media_type) into v_types
  from jsonb_array_elements_text(
    '["photo"]'::jsonb || coalesce(private.celebration_grant(v_celebration_id, 'media_types'), '[]'::jsonb)
  ) as type;

  update public.event_sessions
    set allowed_media_types = v_types
    where celebration_id = v_celebration_id
      and allowed_media_types is distinct from v_types;

  return null;
end;
$$;

create trigger celebration_entitlements_sync_media_types
  after insert or update or delete on public.celebration_entitlements
  for each row execute function private.sync_session_media_types();

-- ---------------------------------------------------------------------------
-- Add-ons survive a plan
-- ---------------------------------------------------------------------------

-- A plan's grants overwrite by key, and every plan carries `media_types` and
-- `audio_guestbook`. So activating any plan, or the backfill in 20260901120000,
-- quietly took back a Media Bundle the host had paid for. That cost nothing while
-- no server code read those grants. It does now.
--
-- Limited to those two keys, the only ones an add-on sells. Rows that already
-- match are left alone, so refunding an add-on cannot take from a plan that grants
-- the same thing. 'web' is excluded because no web checkout has ever taken money.
create function private.restore_paid_add_on_features(p_celebration_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.celebration_entitlements (
    celebration_id, entitlement_key, value,
    granted_by_add_on_id, granted_by_purchase_id
  )
  select distinct on (pu.celebration_id, ae.entitlement_key)
    pu.celebration_id, ae.entitlement_key, ae.value, pu.add_on_id, pu.id
  from public.purchases pu
  join public.add_on_entitlements ae on ae.add_on_id = pu.add_on_id
  where pu.status = 'verified'
    and pu.platform <> 'web'
    and ae.entitlement_key in ('media_types', 'audio_guestbook')
    and (p_celebration_id is null or pu.celebration_id = p_celebration_id)
  order by pu.celebration_id, ae.entitlement_key, pu.verified_at desc nulls last
  on conflict (celebration_id, entitlement_key) do update
    set value = excluded.value,
        granted_by_add_on_id = excluded.granted_by_add_on_id,
        granted_by_purchase_id = excluded.granted_by_purchase_id,
        granted_at = now()
    where public.celebration_entitlements.value is distinct from excluded.value;
$$;

-- ---------------------------------------------------------------------------
-- Guestbook settings
-- ---------------------------------------------------------------------------

-- 20260811185000 added the icon parameter but only dropped a three-argument
-- signature that never existed, so the original two-argument function is still
-- there and callable. Left in place it would be an ungated way round the check.
drop function if exists public.upsert_event_guestbook(uuid, text);

create or replace function public.upsert_event_guestbook(
  p_celebration_id uuid,
  p_instructions text,
  p_icon text default U&'\+01F48C'
)
returns public.event_guestbooks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_guestbooks%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to manage this guestbook' using errcode = '42501';
  end if;

  if not private.celebration_has_feature(p_celebration_id, 'audio_guestbook') then
    raise exception 'this event''s package does not include the guestbook' using errcode = '42501';
  end if;

  insert into public.event_guestbooks (celebration_id, instructions, guestbook_icon)
  values (
    p_celebration_id,
    coalesce(nullif(trim(p_instructions), ''), 'Leave a message for the host.'),
    case
      when p_icon in (U&'\+01F48C', U&'\+01F381', U&'\+01F49B', U&'\+01F31F', U&'\+01F4AB', U&'\+01F338') then p_icon
      else U&'\+01F48C'
    end
  )
  on conflict (celebration_id) do update
    set instructions = excluded.instructions,
        guestbook_icon = excluded.guestbook_icon
  returning * into v_row;

  return v_row;
end;
$$;

-- `get_host_guestbook` and `get_guest_guestbook` stay as they are: a host keeps
-- every message already left, whatever the event's package is now.

drop policy "event_guestbooks: managers insert" on public.event_guestbooks;
drop policy "event_guestbooks: managers update" on public.event_guestbooks;

create policy "event_guestbooks: managers insert"
  on public.event_guestbooks for insert to authenticated
  with check (
    private.can_manage_celebration(celebration_id)
    and private.celebration_has_feature(celebration_id, 'audio_guestbook')
  );

create policy "event_guestbooks: managers update"
  on public.event_guestbooks for update to authenticated
  using (private.can_manage_celebration(celebration_id))
  with check (
    private.can_manage_celebration(celebration_id)
    and private.celebration_has_feature(celebration_id, 'audio_guestbook')
  );

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------

-- Split out of one `for all` policy so writes can be gated separately. That policy
-- also let managers read soft-deleted rows, which an update needs in order to set
-- `deleted_at` under RLS, so "managers read" has to stay.
drop policy "event_challenges: managers write" on public.event_challenges;

create policy "event_challenges: managers read"
  on public.event_challenges for select to authenticated
  using (private.can_manage_celebration(celebration_id));

create policy "event_challenges: managers insert"
  on public.event_challenges for insert to authenticated
  with check (
    private.can_manage_celebration(celebration_id)
    and private.celebration_has_feature(celebration_id, 'challenges')
  );

-- A host may always clear away a challenge. They just cannot edit or restore one
-- on a package that does not include them.
create policy "event_challenges: managers update"
  on public.event_challenges for update to authenticated
  using (private.can_manage_celebration(celebration_id))
  with check (
    private.can_manage_celebration(celebration_id)
    and (deleted_at is not null or private.celebration_has_feature(celebration_id, 'challenges'))
  );

create policy "event_challenges: managers delete"
  on public.event_challenges for delete to authenticated
  using (private.can_manage_celebration(celebration_id));

-- Not an error when the feature is missing. The app calls this to find out whether
-- the caller is a host, and treats a refusal as "must be a guest", which would
-- leave a host on a lower package with no list at all.
create or replace function public.seed_event_challenges_if_empty(
  p_celebration_id uuid,
  p_challenges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing integer;
  v_challenges jsonb;
  v_included boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to manage this event' using errcode = '42501';
  end if;

  v_included := private.celebration_has_feature(p_celebration_id, 'challenges');

  -- Serialises concurrent seeding attempts for this celebration. Without it two
  -- devices can both observe an empty list and both insert the defaults.
  perform pg_advisory_xact_lock(hashtextextended(p_celebration_id::text, 0));

  select count(*)::integer into v_existing
  from public.event_challenges
  where celebration_id = p_celebration_id
    and deleted_at is null;

  if v_existing = 0 and v_included then
    insert into public.event_challenges (celebration_id, label, icon, instructions, photo_uri, sort_order)
    select
      p_celebration_id,
      item ->> 'label',
      item ->> 'icon',
      nullif(item ->> 'instructions', ''),
      nullif(item ->> 'photo_uri', ''),
      coalesce((item ->> 'sort_order')::integer, ordinality::integer - 1)
    from jsonb_array_elements(p_challenges) with ordinality as t(item, ordinality)
    where coalesce(item ->> 'label', '') <> ''
      and coalesce(item ->> 'icon', '') <> '';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ec.id,
      'label', ec.label,
      'icon', ec.icon,
      'instructions', ec.instructions,
      'photo_uri', ec.photo_uri,
      'sort_order', ec.sort_order
    )
    order by ec.sort_order asc, ec.created_at asc
  ), '[]'::jsonb) into v_challenges
  from public.event_challenges ec
  where ec.celebration_id = p_celebration_id
    and ec.deleted_at is null;

  return jsonb_build_object('challenges', v_challenges, 'seeded', v_existing = 0 and v_included);
end;
$$;

-- Guests get an empty list rather than prompts they could not answer. The rows
-- stay, so they come back if the host upgrades. Submissions already made are read
-- through `get_guest_challenge_photos`, which is untouched.
create or replace function public.get_guest_challenges(
  p_event_code text,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_guest public.guest_sessions%rowtype;
  v_clean_code text;
  v_challenges jsonb;
begin
  v_clean_code := trim(lower(p_event_code));

  select * into v_celebration
  from public.celebrations
  where lower(event_code) = v_clean_code
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'event not found or unavailable' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  select * into v_guest
  from public.guest_sessions
  where anonymous_token_hash = private.digest_token(p_guest_token)
    and event_session_id = v_session.id;

  if not found then
    raise exception 'invalid guest session for this event' using errcode = '42501';
  end if;

  if not private.celebration_has_feature(v_celebration.id, 'challenges') then
    return jsonb_build_object('challenges', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ec.id,
      'label', ec.label,
      'icon', ec.icon,
      'instructions', ec.instructions,
      'photo_uri', ec.photo_uri,
      'sort_order', ec.sort_order
    )
    order by ec.sort_order asc, ec.created_at asc
  ), '[]'::jsonb) into v_challenges
  from public.event_challenges ec
  where ec.celebration_id = v_celebration.id
    and ec.deleted_at is null;

  return jsonb_build_object('challenges', v_challenges);
end;
$$;

-- ---------------------------------------------------------------------------
-- Existing events
-- ---------------------------------------------------------------------------

-- Hand back any Media Bundle a plan overwrote. Runs before the column backfill so
-- that sees the restored grants.
select private.restore_paid_add_on_features();

-- 20260811153000 turned video on for every session while testing. Bring the column
-- back in line with what each event actually has. This touches a setting, not media:
-- videos already uploaded are unaffected. Events with no grant to read are left
-- alone here, and are refused video by the trigger above.
--
-- A session with a video still on its way keeps its column for now. The upload
-- functions check the column before they look for the existing row, so narrowing
-- it would refuse the retry that upload needs. The trigger above still stops any
-- new video there, and the next change to the event's grants brings it in line.
update public.event_sessions s
  set allowed_media_types = g.types
  from (
    select ce.celebration_id, (
      select array_agg(distinct type::public.media_type)
      from jsonb_array_elements_text('["photo"]'::jsonb || ce.value) as type
    ) as types
    from public.celebration_entitlements ce
    where ce.entitlement_key = 'media_types'
      and (ce.expires_at is null or ce.expires_at > now())
  ) g
  where s.celebration_id = g.celebration_id
    and s.allowed_media_types is distinct from g.types
    and not exists (
      select 1 from public.media_items mi
      where mi.event_session_id = s.id
        and mi.media_type = 'video'
        and mi.status not in ('ready', 'permanent_failed', 'hidden', 'deleted')
        and mi.deleted_at is null
    );

commit;
