-- Core ownership and event hierarchy:
--   workspace → celebration → event_session
--
-- The MVP creates one celebration with one child session. The hierarchy exists
-- now so multiple functions (Mehndi, Sangeet, Reception…) ship later as a
-- feature flag rather than a migration redesign.

-- ---------------------------------------------------------------------------
-- Shared trigger
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function private.set_updated_at is
  'Maintains updated_at on write. Attached to every table carrying that column.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 120
  )
);

comment on table public.profiles is
  'Public profile data for an authenticated user. Mirrors auth.users by id.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.workspace_kind not null default 'personal',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint workspaces_name_length check (char_length(name) between 1 and 160)
);

comment on table public.workspaces is
  'Ownership layer. Today a personal workspace per user; later a couple, '
  'planner, venue, caterer, photographer or agency.';

create index workspaces_created_by_idx on public.workspaces (created_by)
  where deleted_at is null;

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),

  primary key (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Membership and role within a workspace. Composite primary key prevents '
  'duplicate membership rows.';

create index workspace_members_user_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- themes
-- ---------------------------------------------------------------------------

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  -- Advisory only. A theme suggested by one pack is selectable by every user;
  -- this column drives ordering and suggestion, never permission.
  inspiration_pack public.inspiration_pack not null default 'universal',
  preview_asset_key text,
  design_tokens jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint themes_slug_format check (slug ~ '^[a-z0-9_]+$')
);

comment on column public.themes.inspiration_pack is
  'Suggestion and ordering only. Never a restriction — every active theme is '
  'available to every user regardless of the pack they chose.';

create index themes_active_sort_idx on public.themes (is_active, sort_order);

create trigger themes_set_updated_at
  before update on public.themes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- celebrations
-- ---------------------------------------------------------------------------

create table public.celebrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  title text not null,
  celebration_type public.celebration_type not null default 'wedding',
  inspiration_pack public.inspiration_pack not null default 'universal',
  status public.celebration_status not null default 'draft',
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Stored separately from the UTC instants above so that a time can be
  -- rendered in the venue's local zone regardless of where the viewer is.
  timezone text not null default 'Europe/London',
  location_name text,
  location_address text,
  cover_storage_path text,
  default_theme_id uuid references public.themes (id) on delete set null,
  public_slug text not null unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint celebrations_title_length check (char_length(title) between 1 and 200),
  constraint celebrations_dates_ordered check (
    starts_at is null or ends_at is null or ends_at >= starts_at
  ),
  -- Non-sequential and hard to guess. Generated by private.generate_public_slug.
  constraint celebrations_public_slug_format check (public_slug ~ '^[a-z0-9]{12,32}$')
);

comment on column public.celebrations.public_slug is
  'URL-safe, non-sequential, high-entropy. Appears in guest links, so it must '
  'not be enumerable — 22 base32 characters is roughly 110 bits.';

create index celebrations_workspace_idx on public.celebrations (workspace_id)
  where deleted_at is null;
create index celebrations_created_by_idx on public.celebrations (created_by)
  where deleted_at is null;
create index celebrations_status_idx on public.celebrations (status)
  where deleted_at is null;

create trigger celebrations_set_updated_at
  before update on public.celebrations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- celebration_collaborators
-- ---------------------------------------------------------------------------

create table public.celebration_collaborators (
  id uuid primary key default gen_random_uuid(),
  celebration_id uuid not null references public.celebrations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  invited_email text,
  role public.collaborator_role not null default 'cohost',
  invited_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  -- A row is either an accepted collaborator or an outstanding invitation.
  constraint collaborators_identity_present check (
    user_id is not null or invited_email is not null
  ),
  constraint collaborators_email_format check (
    invited_email is null or invited_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

comment on table public.celebration_collaborators is
  'Co-hosts, moderators and viewers on a celebration, plus outstanding email '
  'invitations that have no user account yet.';

-- One active row per user per celebration; revoked rows may repeat.
create unique index collaborators_unique_user_idx
  on public.celebration_collaborators (celebration_id, user_id)
  where user_id is not null and revoked_at is null;

create unique index collaborators_unique_email_idx
  on public.celebration_collaborators (celebration_id, lower(invited_email))
  where invited_email is not null and revoked_at is null;

create index collaborators_user_idx on public.celebration_collaborators (user_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- event_sessions
-- ---------------------------------------------------------------------------

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  celebration_id uuid not null references public.celebrations (id) on delete cascade,
  name text not null,
  -- Optional link to a suggested function preset (mehndi, reception, walima…).
  -- Nullable because a host may always type their own name.
  preset_key text,
  sequence_number integer not null default 1,
  status public.event_status not null default 'draft',
  starts_at timestamptz,
  -- The moment guests can no longer capture. Step 2 of creation sets this.
  ends_at timestamptz,
  timezone text not null default 'Europe/London',
  location_name text,
  location_address text,
  theme_id uuid references public.themes (id) on delete set null,

  -- Capture settings
  capture_mode public.capture_mode not null default 'camera_and_library',
  allowed_media_types public.media_type[] not null default array['photo']::public.media_type[],
  -- NULL means unlimited. Unlimited is an entitlement, never a hard-coded number.
  shot_limit_per_guest integer,
  camera_roll_upload_limit integer,
  camera_roll_uploads_after_close boolean not null default true,
  allow_media_from_any_date boolean not null default false,

  -- Reveal
  reveal_mode public.reveal_mode not null default 'scheduled',
  reveal_at timestamptz,

  -- Privacy
  gallery_visibility public.gallery_visibility not null default 'all_guests',
  guest_downloads_enabled boolean not null default true,
  moderation_enabled boolean not null default false,
  pin_required boolean not null default false,

  -- Presentation. Treatments are non-destructive: the original is always kept
  -- and the treatment is applied to derivatives only.
  photo_treatment public.photo_treatment not null default 'original',
  date_stamp_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint event_sessions_name_length check (char_length(name) between 1 and 200),
  constraint event_sessions_sequence_positive check (sequence_number >= 1),
  constraint event_sessions_dates_ordered check (
    starts_at is null or ends_at is null or ends_at >= starts_at
  ),
  constraint event_sessions_shot_limit_positive check (
    shot_limit_per_guest is null or shot_limit_per_guest > 0
  ),
  constraint event_sessions_roll_limit_positive check (
    camera_roll_upload_limit is null or camera_roll_upload_limit >= 0
  ),
  -- A scheduled reveal needs a time; the other modes must not carry one.
  constraint event_sessions_reveal_at_matches_mode check (
    (reveal_mode = 'scheduled' and reveal_at is not null)
    or (reveal_mode <> 'scheduled' and reveal_at is null)
  ),
  constraint event_sessions_media_types_not_empty check (
    array_length(allowed_media_types, 1) >= 1
  )
);

comment on column public.event_sessions.shot_limit_per_guest is
  'NULL means unlimited. Unlimited is granted by an entitlement, so the number '
  'is never hard-coded in the interface.';

comment on column public.event_sessions.photo_treatment is
  'Non-destructive. The original is preserved and the treatment is applied to '
  'gallery derivatives, so a host can change or remove it after the event.';

create unique index event_sessions_sequence_idx
  on public.event_sessions (celebration_id, sequence_number)
  where deleted_at is null;

create index event_sessions_celebration_idx on public.event_sessions (celebration_id)
  where deleted_at is null;
create index event_sessions_status_idx on public.event_sessions (status)
  where deleted_at is null;
-- Supports the scheduled-reveal worker.
create index event_sessions_reveal_due_idx on public.event_sessions (reveal_at)
  where reveal_mode = 'scheduled' and status = 'closed' and deleted_at is null;

create trigger event_sessions_set_updated_at
  before update on public.event_sessions
  for each row execute function private.set_updated_at();
