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

insert into public.entitlement_definitions (key, name, description, value_kind, default_value)
values
  ('participant_limit', 'Guest limit',
   'Maximum number of guest sessions for one event session.',
   'integer', '30'::jsonb),

  ('photo_limit_options', 'Photo limit options',
   'Per-guest shot limits the host may choose from.',
   'integer_array', '[5,10,15]'::jsonb),

  ('unlimited_photos', 'Unlimited photos',
   'Allows the host to remove the per-guest shot limit entirely.',
   'boolean', 'false'::jsonb),

  ('camera_roll_uploads', 'Camera-roll uploads',
   'Guests may add photos from their camera roll as well as capturing live.',
   'boolean', 'true'::jsonb),

  ('camera_roll_upload_limit', 'Camera-roll upload limit',
   'How many camera-roll photos each guest may add.',
   'integer', '5'::jsonb),

  ('media_types', 'Contribution formats',
   'Which media types guests may contribute.',
   'string_array', '["photo"]'::jsonb),

  ('audio_guestbook', 'Audio Guestbook',
   'Guests may leave a short spoken message.',
   'boolean', 'false'::jsonb),

  ('memory_book', 'Memory Book',
   'The organised final output combining photos, text, audio and video.',
   'boolean', 'false'::jsonb),

  ('moderation', 'Host approval',
   'Host reviews contributions before they appear in the gallery.',
   'boolean', 'false'::jsonb),

  ('cohost_count', 'Co-hosts',
   'How many additional people may help manage the event.',
   'integer', '0'::jsonb),

  ('qr_templates', 'QR templates',
   'Which printable and shareable QR designs are available.',
   'string_array', '["digital_card"]'::jsonb),

  ('gallery_retention_days', 'Gallery availability',
   'How long the gallery stays available after the event closes.',
   'integer', '90'::jsonb),

  ('support_level', 'Support',
   'Support tier for the host.',
   'string', '"standard"'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  value_kind = excluded.value_kind,
  default_value = excluded.default_value;

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
--
-- Product identifiers are placeholders and must be replaced with the real
-- StoreKit and Play Billing identifiers before release — see docs/renaming.md.

insert into public.plans (
  key, name, description, tier_rank, price_minor_units, currency,
  apple_product_id, google_product_id, web_product_id, sort_order
)
values
  ('essential', 'Essential',
   'Everything you need for one celebration.',
   1, 4900, 'GBP',
   'com.example.eventcamera.plan.essential',
   'plan_essential',
   'web_plan_essential', 10),

  ('signature', 'Signature',
   'More guests, more photos, more ways to contribute.',
   2, 7900, 'GBP',
   'com.example.eventcamera.plan.signature',
   'plan_signature',
   'web_plan_signature', 20),

  ('heirloom', 'Heirloom',
   'The complete record of the day, kept for good.',
   3, 14900, 'GBP',
   'com.example.eventcamera.plan.heirloom',
   'plan_heirloom',
   'web_plan_heirloom', 30)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  tier_rank = excluded.tier_rank,
  price_minor_units = excluded.price_minor_units,
  currency = excluded.currency,
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  web_product_id = excluded.web_product_id,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Plan entitlements
-- ---------------------------------------------------------------------------

with plan_ids as (
  select key, id from public.plans where key in ('essential', 'signature', 'heirloom')
),
grants (plan_key, entitlement_key, value) as (
  values
    -- Essential
    ('essential', 'participant_limit',        '50'::jsonb),
    ('essential', 'photo_limit_options',      '[5,10,15,25]'::jsonb),
    ('essential', 'unlimited_photos',         'false'::jsonb),
    ('essential', 'camera_roll_uploads',      'true'::jsonb),
    ('essential', 'camera_roll_upload_limit', '5'::jsonb),
    ('essential', 'media_types',              '["photo"]'::jsonb),
    ('essential', 'cohost_count',             '1'::jsonb),
    ('essential', 'qr_templates',             '["digital_card","a4_poster"]'::jsonb),
    ('essential', 'gallery_retention_days',   '90'::jsonb),
    ('essential', 'support_level',            '"standard"'::jsonb),

    -- Signature
    ('signature', 'participant_limit',        '150'::jsonb),
    ('signature', 'photo_limit_options',      '[5,10,15,25]'::jsonb),
    ('signature', 'unlimited_photos',         'true'::jsonb),
    ('signature', 'camera_roll_uploads',      'true'::jsonb),
    ('signature', 'camera_roll_upload_limit', '15'::jsonb),
    ('signature', 'media_types',              '["photo"]'::jsonb),
    ('signature', 'moderation',               'true'::jsonb),
    ('signature', 'cohost_count',             '3'::jsonb),
    ('signature', 'qr_templates',             '["digital_card","a4_poster","a5_sign","table_card"]'::jsonb),
    ('signature', 'gallery_retention_days',   '365'::jsonb),
    ('signature', 'support_level',            '"priority"'::jsonb),

    -- Heirloom
    ('heirloom',  'participant_limit',        '500'::jsonb),
    ('heirloom',  'photo_limit_options',      '[5,10,15,25]'::jsonb),
    ('heirloom',  'unlimited_photos',         'true'::jsonb),
    ('heirloom',  'camera_roll_uploads',      'true'::jsonb),
    ('heirloom',  'camera_roll_upload_limit', '50'::jsonb),
    -- Video and audio are granted here but remain hidden behind feature flags
    -- until they actually ship. The interface must label them honestly as
    -- coming later rather than render a control that fails.
    ('heirloom',  'media_types',              '["photo"]'::jsonb),
    ('heirloom',  'moderation',               'true'::jsonb),
    ('heirloom',  'memory_book',              'false'::jsonb),
    ('heirloom',  'cohost_count',             '10'::jsonb),
    ('heirloom',  'qr_templates',             '["digital_card","a4_poster","a5_sign","table_card","square_social","venue_screen"]'::jsonb),
    ('heirloom',  'gallery_retention_days',   '3650'::jsonb),
    ('heirloom',  'support_level',            '"priority"'::jsonb)
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
  ('extra_guests_100', 'Extra guests',
   'Raises the guest limit by 100.',
   1900, 'GBP',
   'com.example.eventcamera.addon.extraguests100',
   'addon_extra_guests_100',
   'web_addon_extra_guests_100', 10, true),

  ('extended_gallery', 'Extended gallery',
   'Keeps the gallery available for a further two years.',
   2900, 'GBP',
   'com.example.eventcamera.addon.extendedgallery',
   'addon_extended_gallery',
   'web_addon_extended_gallery', 20, true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  price_minor_units = excluded.price_minor_units,
  is_active = excluded.is_active;

with add_on_ids as (
  select key, id from public.add_ons
),
grants (add_on_key, entitlement_key, value) as (
  values
    ('extra_guests_100', 'participant_limit',      '100'::jsonb),
    ('extended_gallery', 'gallery_retention_days', '730'::jsonb)
)
insert into public.add_on_entitlements (add_on_id, entitlement_key, value)
select a.id, g.entitlement_key, g.value
from grants g
join add_on_ids a on a.key = g.add_on_key
on conflict (add_on_id, entitlement_key) do update set value = excluded.value;
