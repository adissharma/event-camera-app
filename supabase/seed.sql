-- Seed data: themes and the commercial catalogue.
--
-- Idempotent — safe to re-run. Uses `on conflict do update` so editing a value
-- here and re-seeding actually changes it, rather than silently doing nothing.
--
-- Nothing here contains a brand name. Package names are original and are not
-- taken from any competitor's tiers.

-- ---------------------------------------------------------------------------
-- Themes
-- ---------------------------------------------------------------------------
--
-- `inspiration_pack` drives suggestion and ordering ONLY. Every active theme is
-- selectable by every user regardless of the pack they chose — a South Asian
-- pack does not hide the garden theme, and choosing "universal" does not hide
-- the mehndi-inspired one.

insert into public.themes (slug, name, description, inspiration_pack, preview_asset_key, sort_order, design_tokens)
values
  ('editorial', 'Editorial',
   'Clean type, generous margins, photography left to speak for itself.',
   'universal', 'theme_editorial', 10,
   '{"cover":{"align":"left","overlay":"scrim_bottom"},"accent":"#EFE9E0"}'::jsonb),

  ('film', 'Film',
   'Warm analogue cast with soft grain, as though shot on a disposable camera.',
   'universal', 'theme_film', 20,
   '{"cover":{"align":"left","overlay":"scrim_bottom"},"accent":"#D9C39A","grain":true}'::jsonb),

  ('midnight', 'Midnight',
   'Deep ink with candlelit highlights. Made for evening receptions.',
   'universal', 'theme_editorial', 30,
   '{"cover":{"align":"left","overlay":"scrim_full"},"accent":"#C8B79A"}'::jsonb),

  ('emerald', 'Emerald',
   'Deep green ground with restrained warm highlights.',
   'south_asian', 'theme_emerald', 40,
   '{"cover":{"align":"centre","overlay":"scrim_bottom"},"accent":"#1F5148"}'::jsonb),

  ('marigold', 'Marigold',
   'Warm saffron and rose, drawn from festival colour.',
   'south_asian', 'theme_floral', 50,
   '{"cover":{"align":"centre","overlay":"scrim_bottom"},"accent":"#D98A2B"}'::jsonb),

  ('garden', 'Garden',
   'Botanical and photographic, never illustrated stationery.',
   'garden', 'theme_floral', 60,
   '{"cover":{"align":"left","overlay":"scrim_bottom"},"accent":"#7FB08A"}'::jsonb),

  ('black_tie', 'Black Tie',
   'Formal, monochrome, minimal.',
   'black_tie', 'theme_editorial', 70,
   '{"cover":{"align":"centre","overlay":"scrim_full"},"accent":"#F5F2ED"}'::jsonb),

  ('modern', 'Modern',
   'Bold type, high contrast, unfussy.',
   'modern', 'theme_editorial', 80,
   '{"cover":{"align":"left","overlay":"scrim_bottom"},"accent":"#E8776D"}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  inspiration_pack = excluded.inspiration_pack,
  preview_asset_key = excluded.preview_asset_key,
  sort_order = excluded.sort_order,
  design_tokens = excluded.design_tokens;

-- ---------------------------------------------------------------------------
-- Entitlement definitions
-- ---------------------------------------------------------------------------

insert into public.entitlement_definitions (key, name, description, value_kind, default_value, combine_strategy)
values
  ('participant_limit', 'Guest limit',
   'Maximum number of guest sessions for one event session.',
   'integer', '30'::jsonb, 'sum'),

  ('photo_limit_options', 'Photo limit options',
   'Per-guest shot limits the host may choose from.',
   'integer_array', '[5,10,15]'::jsonb, 'union'),

  ('unlimited_photos', 'Unlimited photos',
   'Allows the host to remove the per-guest shot limit entirely.',
   'boolean', 'false'::jsonb, 'any_true'),

  ('camera_roll_uploads', 'Camera-roll uploads',
   'Guests may add photos from their camera roll as well as capturing live.',
   'boolean', 'true'::jsonb, 'any_true'),

  ('camera_roll_upload_limit', 'Camera-roll upload limit',
   'How many camera-roll photos each guest may add.',
   'integer', '5'::jsonb, 'max'),

  ('media_types', 'Contribution formats',
   'Which media types guests may contribute.',
   'string_array', '["photo"]'::jsonb, 'union'),

  ('audio_guestbook', 'Audio Guestbook',
   'Guests may leave a short spoken message.',
   'boolean', 'false'::jsonb, 'any_true'),

  ('memory_book', 'Memory Book',
   'The organised final output combining photos, text, audio and video.',
   'boolean', 'false'::jsonb, 'any_true'),

  ('moderation', 'Host approval',
   'Host reviews contributions before they appear in the gallery.',
   'boolean', 'false'::jsonb, 'any_true'),

  ('cohost_count', 'Co-hosts',
   'How many additional people may help manage the event.',
   'integer', '0'::jsonb, 'max'),

  ('qr_templates', 'QR templates',
   'Which printable and shareable QR designs are available.',
   'string_array', '["digital_card"]'::jsonb, 'union'),

  ('gallery_retention_days', 'Gallery availability',
   'How long the gallery stays available after the event closes.',
   'integer', '90'::jsonb, 'sum'),

  ('support_level', 'Support',
   'Support tier for the host.',
   'string', '"standard"'::jsonb, 'override')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  value_kind = excluded.value_kind,
  default_value = excluded.default_value,
  combine_strategy = excluded.combine_strategy;

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
--
-- Product identifiers are placeholders and must be replaced with the real
-- StoreKit and Play Billing identifiers before release — see docs/renaming.md.

insert into public.plans (
  key, name, description, tier_rank, price_minor_units, currency,
  apple_product_id, google_product_id, web_product_id, sort_order, is_active
)
values
  ('guests_5', '5 Guests', 'Up to 5 guests can join.', 1, 200, 'USD', 'com.example.eventcamera.plan.guests5', 'plan_guests_5', 'web_plan_guests_5', 10, true),
  ('guests_10', '10 Guests', 'Up to 10 guests can join.', 2, 1500, 'USD', 'com.example.eventcamera.plan.guests10', 'plan_guests_10', 'web_plan_guests_10', 20, true),
  ('guests_25', '25 Guests', 'Up to 25 guests can join.', 3, 3000, 'USD', 'com.example.eventcamera.plan.guests25', 'plan_guests_25', 'web_plan_guests_25', 30, true),
  ('guests_50', '50 Guests', 'Up to 50 guests can join.', 4, 5000, 'USD', 'com.example.eventcamera.plan.guests50', 'plan_guests_50', 'web_plan_guests_50', 40, true),
  ('guests_100', '100 Guests', 'Up to 100 guests can join.', 5, 10000, 'USD', 'com.example.eventcamera.plan.guests100', 'plan_guests_100', 'web_plan_guests_100', 50, true),
  ('guests_150', '150 Guests', 'Up to 150 guests can join.', 6, 15000, 'USD', 'com.example.eventcamera.plan.guests150', 'plan_guests_150', 'web_plan_guests_150', 60, true),
  ('guests_200', '200 Guests', 'Up to 200 guests can join.', 7, 20000, 'USD', 'com.example.eventcamera.plan.guests200', 'plan_guests_200', 'web_plan_guests_200', 70, true),
  ('guests_unlimited', 'Unlimited Guests', 'Unlimited guests can join.', 8, 10000, 'USD', 'com.example.eventcamera.plan.guestsunlimited', 'plan_guests_unlimited', 'web_plan_guests_unlimited', 80, true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  tier_rank = excluded.tier_rank,
  price_minor_units = excluded.price_minor_units,
  currency = excluded.currency,
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  web_product_id = excluded.web_product_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Plan entitlements
-- ---------------------------------------------------------------------------

with plan_ids as (
  select key, id from public.plans where key like 'guests_%'
),
grants (plan_key, entitlement_key, value) as (
  values
    ('guests_5', 'participant_limit', '5'::jsonb),
    ('guests_5', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_5', 'unlimited_photos', 'true'::jsonb),
    ('guests_5', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_5', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_5', 'media_types', '["photo"]'::jsonb),
    ('guests_5', 'cohost_count', '2'::jsonb),
    ('guests_5', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_5', 'gallery_retention_days', '365'::jsonb),
    ('guests_5', 'support_level', '"standard"'::jsonb),

    ('guests_10', 'participant_limit', '10'::jsonb),
    ('guests_10', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_10', 'unlimited_photos', 'true'::jsonb),
    ('guests_10', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_10', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_10', 'media_types', '["photo"]'::jsonb),
    ('guests_10', 'cohost_count', '2'::jsonb),
    ('guests_10', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_10', 'gallery_retention_days', '365'::jsonb),
    ('guests_10', 'support_level', '"standard"'::jsonb),

    ('guests_25', 'participant_limit', '25'::jsonb),
    ('guests_25', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_25', 'unlimited_photos', 'true'::jsonb),
    ('guests_25', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_25', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_25', 'media_types', '["photo"]'::jsonb),
    ('guests_25', 'cohost_count', '2'::jsonb),
    ('guests_25', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_25', 'gallery_retention_days', '365'::jsonb),
    ('guests_25', 'support_level', '"standard"'::jsonb),

    ('guests_50', 'participant_limit', '50'::jsonb),
    ('guests_50', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_50', 'unlimited_photos', 'true'::jsonb),
    ('guests_50', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_50', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_50', 'media_types', '["photo"]'::jsonb),
    ('guests_50', 'cohost_count', '2'::jsonb),
    ('guests_50', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_50', 'gallery_retention_days', '365'::jsonb),
    ('guests_50', 'support_level', '"standard"'::jsonb),

    ('guests_100', 'participant_limit', '100'::jsonb),
    ('guests_100', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_100', 'unlimited_photos', 'true'::jsonb),
    ('guests_100', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_100', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_100', 'media_types', '["photo"]'::jsonb),
    ('guests_100', 'cohost_count', '2'::jsonb),
    ('guests_100', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_100', 'gallery_retention_days', '365'::jsonb),
    ('guests_100', 'support_level', '"standard"'::jsonb),

    ('guests_150', 'participant_limit', '150'::jsonb),
    ('guests_150', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_150', 'unlimited_photos', 'true'::jsonb),
    ('guests_150', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_150', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_150', 'media_types', '["photo"]'::jsonb),
    ('guests_150', 'cohost_count', '2'::jsonb),
    ('guests_150', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_150', 'gallery_retention_days', '365'::jsonb),
    ('guests_150', 'support_level', '"standard"'::jsonb),

    ('guests_200', 'participant_limit', '200'::jsonb),
    ('guests_200', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_200', 'unlimited_photos', 'true'::jsonb),
    ('guests_200', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_200', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_200', 'media_types', '["photo"]'::jsonb),
    ('guests_200', 'cohost_count', '2'::jsonb),
    ('guests_200', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_200', 'gallery_retention_days', '365'::jsonb),
    ('guests_200', 'support_level', '"standard"'::jsonb),

    ('guests_unlimited', 'participant_limit', 'null'::jsonb),
    ('guests_unlimited', 'photo_limit_options', '[5,10,15,25]'::jsonb),
    ('guests_unlimited', 'unlimited_photos', 'true'::jsonb),
    ('guests_unlimited', 'camera_roll_uploads', 'true'::jsonb),
    ('guests_unlimited', 'camera_roll_upload_limit', '15'::jsonb),
    ('guests_unlimited', 'media_types', '["photo"]'::jsonb),
    ('guests_unlimited', 'cohost_count', '2'::jsonb),
    ('guests_unlimited', 'qr_templates', '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('guests_unlimited', 'gallery_retention_days', '365'::jsonb),
    ('guests_unlimited', 'support_level', '"standard"'::jsonb)
)
insert into public.plan_entitlements (plan_id, entitlement_key, value)
select p.id, g.entitlement_key, g.value
from grants g
join plan_ids p on p.key = g.plan_key
on conflict (plan_id, entitlement_key) do update set value = excluded.value;

-- ---------------------------------------------------------------------------
-- Add-ons
-- ---------------------------------------------------------------------------

insert into public.add_ons (
  key, name, description, price_minor_units, currency,
  apple_product_id, google_product_id, web_product_id, sort_order, is_active
)
values
  ('media_bundle', 'Media Bundle',
   'Unlock Audio Guestbook & Video Uploads.',
   1500, 'USD',
   'com.example.eventcamera.addon.mediabundle',
   'addon_media_bundle',
   'web_addon_media_bundle', 10, true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  price_minor_units = excluded.price_minor_units,
  currency = excluded.currency,
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  web_product_id = excluded.web_product_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

with add_on_ids as (
  select key, id from public.add_ons
),
grants (add_on_key, entitlement_key, value) as (
  values
    ('media_bundle', 'audio_guestbook', 'true'::jsonb),
    ('media_bundle', 'media_types', '["photo", "video"]'::jsonb)
)
insert into public.add_on_entitlements (add_on_id, entitlement_key, value)
select a.id, g.entitlement_key, g.value
from grants g
join add_on_ids a on a.key = g.add_on_key
on conflict (add_on_id, entitlement_key) do update set value = excluded.value;

-- ---------------------------------------------------------------------------
-- Local Test Celebration Seed
-- ---------------------------------------------------------------------------

-- 1. Insert a dummy owner user in auth.users
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role)
values (
  '00000000-0000-0000-0000-000000000001',
  'test-owner@example.com',
  '{"display_name": "Test Owner"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  'authenticated',
  'authenticated'
)
on conflict (id) do nothing;

-- 2. Insert a workspace
insert into public.workspaces (id, name, created_by, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000002',
  'Test Workspace',
  '00000000-0000-0000-0000-000000000001',
  now(),
  now()
)
on conflict (id) do nothing;

-- 3. Insert workspace member link
insert into public.workspace_members (workspace_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'owner'
)
on conflict do nothing;

-- 4. Insert celebration with target test slug: leavingdo2026
insert into public.celebrations (
  id, workspace_id, created_by, title, status, public_slug, starts_at, ends_at, timezone, default_theme_id
)
values (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Arjun''s Leaving Do',
  'published',
  'leavingdo2026',
  now(),
  now() + interval '7 days',
  'Europe/London',
  (select id from public.themes where slug = 'editorial' limit 1)
)
on conflict (id) do nothing;

-- 5. Insert event session
insert into public.event_sessions (
  id, celebration_id, name, status, sequence_number, starts_at, ends_at, reveal_mode, reveal_at, shot_limit_per_guest
)
values (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  'Main event',
  'published',
  1,
  now(),
  now() + interval '7 days',
  'instant',
  null,
  10
)
on conflict (id) do nothing;

-- 6. Insert access link for guests
insert into public.access_links (
  id, event_session_id, kind, token_hash, is_active
)
values (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000004',
  'guest',
  private.digest_token('test_guest_access_token'),
  true
)
on conflict (id) do nothing;
