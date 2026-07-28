-- Extensions, schemas and enumerated types.
--
-- Naming is brand-neutral throughout: nothing in the database refers to a
-- product name. See docs/renaming.md.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create schema if not exists extensions;

-- pgcrypto supplies digest() for hashing access tokens and PINs. Tokens are
-- NEVER stored in plain text anywhere in this schema.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Private schema
-- ---------------------------------------------------------------------------

-- Helper functions used by RLS policies live here rather than in `public`.
--
-- Two reasons. First, PostgREST does not expose non-public schemas, so these
-- cannot be called directly by a client. Second, RLS policies that query the
-- same table they protect recurse infinitely; the helpers below are SECURITY
-- DEFINER so they read without re-entering RLS, which is the standard way to
-- break that cycle.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
--
-- Typed columns are used wherever a value is searchable or constrained. JSONB is
-- reserved for genuinely extensible metadata.

create type public.workspace_kind as enum ('personal', 'partner');

create type public.workspace_role as enum ('owner', 'admin', 'member');

create type public.celebration_status as enum ('draft', 'published', 'archived');

create type public.celebration_type as enum (
  'wedding', 'birthday', 'party', 'corporate',
  'religious', 'graduation', 'anniversary', 'other'
);

-- An inspiration pack may only influence suggestions, defaults and ordering.
-- It must never restrict a feature, force terminology, or alter a security or
-- privacy rule. Every pack is available to every user.
create type public.inspiration_pack as enum (
  'universal', 'south_asian', 'classic', 'modern', 'black_tie', 'garden', 'custom'
);

create type public.event_status as enum (
  'draft', 'published', 'closed', 'revealed', 'archived'
);

create type public.capture_mode as enum (
  'camera_only', 'library_only', 'camera_and_library'
);

-- The schema supports all three from day one. Only 'photo' is enabled in the
-- first live release — that is a feature-flag decision, not a schema one.
create type public.media_type as enum ('photo', 'video', 'audio');

create type public.reveal_mode as enum ('instant', 'scheduled', 'manual');

create type public.gallery_visibility as enum (
  'all_guests',  -- everyone can see all revealed media
  'own_only',    -- guests see only their own contributions
  'hosts_only'   -- hosts only, until explicitly shared
);

create type public.photo_treatment as enum (
  'original', 'disposable', 'black_and_white', 'warm_film'
);

create type public.collaborator_role as enum ('owner', 'cohost', 'moderator', 'viewer');

create type public.access_link_kind as enum ('guest', 'host_preview', 'cohost_invite');

create type public.media_source as enum (
  'camera', 'library', 'recording', 'host_upload', 'system_generated'
);

-- The full lifecycle of a contribution. Transitions are enforced in application
-- code and asserted by tests; see src/features/media/state-machine.ts.
create type public.media_status as enum (
  'local_pending',
  'upload_authorising',
  'queued',
  'uploading',
  'paused',
  'uploaded',
  'verifying',
  'processing',
  'ready',
  'retryable_failed',
  'permanent_failed',
  'hidden',
  'deleted'
);

create type public.upload_protocol as enum ('standard', 'tus', 'multipart');

create type public.media_variant_type as enum (
  'original',
  'thumbnail',
  'gallery_preview',
  'full_screen',
  'video_poster',
  'video_stream',
  'audio_preview',
  'audio_waveform'
);

create type public.job_status as enum (
  'pending', 'available', 'running', 'retrying', 'completed', 'failed', 'cancelled'
);

create type public.processing_job_type as enum (
  'verify_object',
  'extract_metadata',
  'generate_image_variants',
  'generate_video_poster',
  'transcode_video',
  'generate_audio_preview',
  'strip_derivative_metadata'
);

create type public.purchase_platform as enum ('apple_app_store', 'google_play', 'web');

create type public.purchase_status as enum (
  'pending', 'verified', 'failed', 'refunded', 'revoked'
);
