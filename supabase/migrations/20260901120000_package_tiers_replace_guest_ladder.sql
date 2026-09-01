-- Replace the guest-count plan ladder with the four package tiers.
--
-- WHY
-- ---
-- `public.plans` was an eight-rung guest-count ladder (guests_5 … guests_200,
-- guests_unlimited) priced in USD. The app's paywall has since become a
-- four-tier package model — Free, Small Event, Stories, Stories+ — priced in
-- GBP, which mapped opportunistically onto four of those eight keys and left
-- the other four orphaned.
--
-- The two models disagreed about what a tier actually grants, and the server
-- was the one that was wrong. No plan granted `audio_guestbook` at any tier,
-- none carried 'video' in `media_types`, there was no `challenges` grant at
-- all, and `unlimited_photos` was true even on the cheapest paid rung. A host
-- could pay to unlock the Guestbook, be taken into it, and find the tile gone
-- when they returned — because the upgrade granted nothing the Guestbook
-- looks for.
--
-- After this migration the four package tiers are the whole ladder, they are
-- the source of truth for every gated feature, and their grants match
-- `src/features/payments/plan-catalogue.ts` exactly.

begin;

-- ---------------------------------------------------------------------------
-- 1. Remap celebrations off the four retired tiers.
--
-- Done FIRST, while those plans are still active and their rows still exist.
--
-- Capacity is never reduced: each retired tier moves to the lowest package
-- that holds at least as many guests. A host who bought 50 guests keeps at
-- least 50 (Stories, 100); one who bought 150 or 200 moves to unlimited.
-- Rounding the other way would silently take away capacity people paid for,
-- which is not a migration's decision to make.
--
--   guests_10  ->  guests_25         (Small Event)
--   guests_50  ->  guests_100        (Stories)
--   guests_150 ->  guests_unlimited  (Stories+)
--   guests_200 ->  guests_unlimited  (Stories+)
-- ---------------------------------------------------------------------------

create temporary table _plan_remap (from_key text primary key, to_key text not null) on commit drop;
insert into _plan_remap (from_key, to_key) values
  ('guests_10',  'guests_25'),
  ('guests_50',  'guests_100'),
  ('guests_150', 'guests_unlimited'),
  ('guests_200', 'guests_unlimited');

-- Purchase rows are historical records of what was actually bought, so their
-- `plan_id` is deliberately left pointing at the retired plan. Only the live
-- grant moves.
update public.celebration_entitlements e
   set granted_by_plan_id = target.id
  from _plan_remap m
  join public.plans source on source.key = m.from_key
  join public.plans target on target.key = m.to_key
 where e.granted_by_plan_id = source.id;

-- ---------------------------------------------------------------------------
-- 2. Retire the four guest-count tiers.
--
-- Deactivated, not deleted: `purchases.plan_id` references them and those
-- rows are the record of real transactions.
--
-- `tier_rank` is deliberately left untouched. Parking retired tiers at rank 0
-- to keep `celebration_plan_key` (which picks the highest rank) away from
-- them is both impossible — `plans_tier_rank_positive` rejects it — and the
-- wrong mechanism: it would make a retired plan unresolvable only by virtue
-- of sorting low, which quietly stops being true the moment anyone adds a
-- tier. Retirement itself is what should disqualify a plan, so the resolver
-- below is taught to ignore inactive ones outright.
-- ---------------------------------------------------------------------------

update public.plans
   set is_active = false,
       updated_at = now()
 where key in (select from_key from _plan_remap);

-- A retired tier can never be an event's current plan, whatever its rank. If
-- an event's only grants came from one, this returns null — which the app
-- reads as granting nothing, the correct fail-closed answer for a plan that
-- no longer exists. After the remap above no event is in that position.
create or replace function public.celebration_plan_key(p_celebration_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- The highest ACTIVE tier that granted any of this event's entitlements.
  -- Highest rather than most recent: an upgrade rewrites the rows it
  -- supersedes but leaves any it does not, so recency would report the older
  -- plan whenever the newer one happened to grant fewer keys.
  select p.key
  from public.celebration_entitlements ce
  join public.plans p on p.id = ce.granted_by_plan_id
  where ce.celebration_id = p_celebration_id
    and p.is_active
    and (ce.expires_at is null or ce.expires_at > now())
  order by p.tier_rank desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Restate the four package tiers.
--
-- Ranks become contiguous 1-4. Prices and currency match the catalogue, and
-- `apple_product_id` picks up the real App Store ids that replaced the
-- `com.example.*` placeholders.
-- ---------------------------------------------------------------------------

update public.plans set
  name              = 'Free',
  description       = 'Up to 5 guests.',
  tier_rank         = 1,
  price_minor_units = 0,
  currency          = 'GBP',
  apple_product_id  = null,
  is_active         = true,
  sort_order        = 0,
  updated_at        = now()
where key = 'guests_5';

update public.plans set
  name              = 'Small Event',
  description       = 'Up to 25 guests.',
  tier_rank         = 2,
  price_minor_units = 1499,
  currency          = 'GBP',
  apple_product_id  = 'com.potoevents.eventcamera.package.small_event',
  is_active         = true,
  sort_order        = 1,
  updated_at        = now()
where key = 'guests_25';

update public.plans set
  name              = 'Stories',
  description       = 'Up to 100 guests.',
  tier_rank         = 3,
  price_minor_units = 2999,
  currency          = 'GBP',
  apple_product_id  = 'com.potoevents.eventcamera.package.stories',
  is_active         = true,
  sort_order        = 2,
  updated_at        = now()
where key = 'guests_100';

update public.plans set
  name              = 'Stories+',
  description       = 'Unlimited guests, video, guestbook and challenges.',
  tier_rank         = 4,
  price_minor_units = 4999,
  currency          = 'GBP',
  apple_product_id  = 'com.potoevents.eventcamera.package.stories_plus',
  is_active         = true,
  sort_order        = 3,
  updated_at        = now()
where key = 'guests_unlimited';

-- ---------------------------------------------------------------------------
-- 4. Restate what each tier grants.
--
-- Every tier now carries the SAME key set, differing only in value. That is
-- what makes `activate_plan_entitlements` safe across a tier change: it
-- upserts by key and never deletes, so a key present on the old plan but
-- absent from the new one would otherwise linger as a grant nobody paid for.
-- A uniform key set means every grant is overwritten on every activation.
--
-- The three premium features — video, guestbook, challenges — belong to
-- Stories+ alone, matching the catalogue. `challenges` is new here; challenge
-- gating has been client-side until now, and this makes the server the
-- authority for it like every other feature.
-- ---------------------------------------------------------------------------

-- `challenges` is a new entitlement. `plan_entitlements.entitlement_key` is a
-- foreign key onto this registry, so the definition has to exist before any
-- plan can grant it. `any_true` matches the other boolean feature flags:
-- across combined grants, having it anywhere means having it.
insert into public.entitlement_definitions (key, name, description, value_kind, combine_strategy, default_value)
values (
  'challenges',
  'Photo challenges',
  'Lets the host set photo prompts for guests to capture.',
  'boolean',
  'any_true',
  'false'::jsonb
)
on conflict (key) do nothing;

delete from public.plan_entitlements
 where plan_id in (select id from public.plans
                    where key in ('guests_5','guests_25','guests_100','guests_unlimited'));

insert into public.plan_entitlements (plan_id, entitlement_key, value)
select p.id, g.entitlement_key, g.value
from public.plans p
join (
  values
    -- key,               entitlement,                value
    ('guests_5',          'participant_limit',        '5'::jsonb),
    ('guests_5',          'unlimited_photos',         'false'),
    ('guests_5',          'photo_limit_options',      '[5, 10, 15, 20]'),
    ('guests_5',          'media_types',              '["photo"]'),
    ('guests_5',          'audio_guestbook',          'false'),
    ('guests_5',          'challenges',               'false'),
    ('guests_5',          'camera_roll_uploads',      'true'),
    ('guests_5',          'camera_roll_upload_limit', '5'),
    ('guests_5',          'cohost_count',             '0'),
    ('guests_5',          'qr_templates',             '["digital_card"]'),
    ('guests_5',          'gallery_retention_days',   '90'),
    ('guests_5',          'support_level',            '"standard"'),

    ('guests_25',         'participant_limit',        '25'),
    ('guests_25',         'unlimited_photos',         'false'),
    ('guests_25',         'photo_limit_options',      '[5, 10, 15, 20]'),
    ('guests_25',         'media_types',              '["photo"]'),
    ('guests_25',         'audio_guestbook',          'false'),
    ('guests_25',         'challenges',               'false'),
    ('guests_25',         'camera_roll_uploads',      'true'),
    ('guests_25',         'camera_roll_upload_limit', '10'),
    ('guests_25',         'cohost_count',             '1'),
    ('guests_25',         'qr_templates',             '["digital_card", "a5_sign"]'),
    ('guests_25',         'gallery_retention_days',   '180'),
    ('guests_25',         'support_level',            '"standard"'),

    ('guests_100',        'participant_limit',        '100'),
    ('guests_100',        'unlimited_photos',         'false'),
    ('guests_100',        'photo_limit_options',      '[5, 10, 15, 20, 25]'),
    ('guests_100',        'media_types',              '["photo"]'),
    ('guests_100',        'audio_guestbook',          'false'),
    ('guests_100',        'challenges',               'false'),
    ('guests_100',        'camera_roll_uploads',      'true'),
    ('guests_100',        'camera_roll_upload_limit', '25'),
    ('guests_100',        'cohost_count',             '2'),
    ('guests_100',        'qr_templates',             '["digital_card", "a4_poster", "a5_sign", "table_card"]'),
    ('guests_100',        'gallery_retention_days',   '365'),
    ('guests_100',        'support_level',            '"standard"'),

    -- `participant_limit` null is the established encoding for unlimited:
    -- it is what guests_unlimited already carried, and what the app reads.
    ('guests_unlimited',  'participant_limit',        'null'),
    ('guests_unlimited',  'unlimited_photos',         'true'),
    ('guests_unlimited',  'photo_limit_options',      '[5, 10, 15, 20, 25]'),
    ('guests_unlimited',  'media_types',              '["photo", "video"]'),
    ('guests_unlimited',  'audio_guestbook',          'true'),
    ('guests_unlimited',  'challenges',               'true'),
    ('guests_unlimited',  'camera_roll_uploads',      'true'),
    ('guests_unlimited',  'camera_roll_upload_limit', '100'),
    ('guests_unlimited',  'cohost_count',             '5'),
    ('guests_unlimited',  'qr_templates',             '["digital_card", "a4_poster", "a5_sign", "table_card"]'),
    ('guests_unlimited',  'gallery_retention_days',   '365'),
    ('guests_unlimited',  'support_level',            '"priority"')
) as g(plan_key, entitlement_key, value) on g.plan_key = p.key;

-- ---------------------------------------------------------------------------
-- 5. Backfill every existing celebration.
--
-- `activate_plan_entitlements` only runs at purchase time, so without this
-- step the new grants would reach new events only and every event already in
-- the database would keep the old, wrong ones — including the 19 remapped off
-- guests_50, which would otherwise sit on a plan they no longer point at.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select distinct e.celebration_id, e.granted_by_plan_id
      from public.celebration_entitlements e
     where e.granted_by_plan_id is not null
  loop
    perform private.activate_plan_entitlements(r.celebration_id, r.granted_by_plan_id);
  end loop;
end;
$$;

commit;
