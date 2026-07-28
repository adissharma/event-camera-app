-- Media contributions and the upload/processing pipeline.
--
-- Binary media is never stored in PostgreSQL. These tables hold only paths and
-- state; the objects live in private storage buckets.

-- ---------------------------------------------------------------------------
-- media_items
-- ---------------------------------------------------------------------------

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  event_session_id uuid not null references public.event_sessions (id) on delete cascade,
  -- Guest contribution, or a host upload, or neither for system-generated media.
  guest_session_id uuid references public.guest_sessions (id) on delete set null,
  uploaded_by_user_id uuid references auth.users (id) on delete set null,

  -- Generated on the client BEFORE any network access, so a photo captured
  -- offline already has a stable identity. This is what makes upload
  -- idempotent: a retry reuses the id rather than creating a duplicate row.
  client_media_id uuid not null,

  media_type public.media_type not null default 'photo',
  source public.media_source not null default 'camera',
  status public.media_status not null default 'local_pending',

  original_storage_path text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,

  -- Supplied by the client where the platform can compute it cheaply; verified
  -- server-side at finalisation when present.
  checksum_algorithm text,
  checksum_value text,

  width integer,
  height integer,
  duration_ms integer,

  captured_at timestamptz,
  uploaded_at timestamptz,
  verified_at timestamptz,
  processing_started_at timestamptz,
  ready_at timestamptz,
  moderated_at timestamptz,

  -- Safe to show a user. Never contains a signed URL, token or internal detail.
  failure_code text,
  failure_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint media_items_size_positive check (
    file_size_bytes is null or file_size_bytes > 0
  ),
  constraint media_items_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint media_items_duration_positive check (
    duration_ms is null or duration_ms >= 0
  ),
  constraint media_items_checksum_paired check (
    (checksum_algorithm is null) = (checksum_value is null)
  )
);

comment on column public.media_items.client_media_id is
  'Client-generated UUID, created before the network is touched. Unique per '
  'session, which is what makes create-intent and finalise idempotent.';

comment on column public.media_items.failure_message is
  'Safe for display. Must never contain a signed URL, token or internal path.';

-- The idempotency key for the whole upload pipeline.
create unique index media_items_session_client_id_idx
  on public.media_items (event_session_id, client_media_id);

create index media_items_session_status_idx
  on public.media_items (event_session_id, status)
  where deleted_at is null;
create index media_items_guest_idx on public.media_items (guest_session_id)
  where deleted_at is null;
-- Supports the per-guest shot-limit count.
create index media_items_guest_counting_idx
  on public.media_items (guest_session_id, event_session_id)
  where deleted_at is null and status <> 'permanent_failed';

create trigger media_items_set_updated_at
  before update on public.media_items
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- upload_intents
-- ---------------------------------------------------------------------------

create table public.upload_intents (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items (id) on delete cascade,

  storage_provider text not null default 'supabase',
  bucket text not null,
  storage_path text not null,
  protocol public.upload_protocol not null default 'standard',

  token_hash bytea,
  -- For TUS: the resumable endpoint, so an interrupted upload continues rather
  -- than restarting from zero on a venue's poor network.
  resumable_url text,

  expected_mime_type text,
  expected_size_bytes bigint,

  expires_at timestamptz not null,
  completed_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint upload_intents_token_hash_length check (
    token_hash is null or octet_length(token_hash) = 32
  ),
  constraint upload_intents_size_positive check (
    expected_size_bytes is null or expected_size_bytes > 0
  )
);

comment on table public.upload_intents is
  'An authorisation to write one object to storage. Re-requesting an intent for '
  'the same media item is safe and does not create a second media row.';

create index upload_intents_media_idx on public.upload_intents (media_item_id);
-- Supports the expired-intent cleanup job.
create index upload_intents_expiry_idx on public.upload_intents (expires_at)
  where completed_at is null and cancelled_at is null;

create trigger upload_intents_set_updated_at
  before update on public.upload_intents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- upload_attempts
-- ---------------------------------------------------------------------------

create table public.upload_attempts (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items (id) on delete cascade,
  upload_intent_id uuid references public.upload_intents (id) on delete set null,

  attempt_number integer not null default 1,
  platform text,
  app_version text,
  browser text,
  network_type text,

  bytes_expected bigint,
  bytes_transferred bigint,

  started_at timestamptz not null default now(),
  ended_at timestamptz,

  outcome text,
  http_status integer,
  error_code text,

  created_at timestamptz not null default now(),

  constraint upload_attempts_attempt_positive check (attempt_number >= 1)
);

comment on table public.upload_attempts is
  'Diagnostics per upload attempt. Deliberately holds no raw device identifier '
  'and no personal data — coarse platform and network type only.';

create index upload_attempts_media_idx on public.upload_attempts (media_item_id);

-- ---------------------------------------------------------------------------
-- media_variants
-- ---------------------------------------------------------------------------

create table public.media_variants (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items (id) on delete cascade,
  variant_type public.media_variant_type not null,

  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  duration_ms integer,

  processing_status public.job_status not null default 'completed',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.media_variants is
  'Derivatives. The original is preserved untouched and privately; photo '
  'treatments and metadata stripping apply to these rows only, which is what '
  'makes a treatment reversible.';

create unique index media_variants_item_type_idx
  on public.media_variants (media_item_id, variant_type);

create trigger media_variants_set_updated_at
  before update on public.media_variants
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- processing_jobs
-- ---------------------------------------------------------------------------

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items (id) on delete cascade,
  job_type public.processing_job_type not null,
  status public.job_status not null default 'pending',

  priority integer not null default 100,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,

  -- Claim/lease model: a worker takes a job by setting locked_by and
  -- lease_expires_at. A crashed worker's lease expires and the job is retried,
  -- so a job cannot be lost by a process dying mid-run.
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  locked_by text,

  started_at timestamptz,
  completed_at timestamptz,
  error_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint processing_jobs_attempts_sane check (
    attempt_count >= 0 and max_attempts >= 1
  )
);

comment on table public.processing_jobs is
  'Durable work queue for media processing. Long-running work (future video '
  'transcoding) must not run inside a request-response function.';

-- The worker claim query: next available job by priority then age.
create index processing_jobs_claim_idx
  on public.processing_jobs (status, available_at, priority)
  where status in ('pending', 'available', 'retrying');
create index processing_jobs_media_idx on public.processing_jobs (media_item_id);
-- Finds jobs abandoned by a dead worker.
create index processing_jobs_expired_lease_idx on public.processing_jobs (lease_expires_at)
  where status = 'running';

create trigger processing_jobs_set_updated_at
  before update on public.processing_jobs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- storage_deletion_jobs
-- ---------------------------------------------------------------------------

create table public.storage_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: an orphaned object may have no surviving media row, which is
  -- exactly the case this queue exists to clean up.
  media_item_id uuid references public.media_items (id) on delete set null,

  storage_provider text not null default 'supabase',
  bucket text not null,
  storage_path text not null,

  status public.job_status not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  error_code text,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.storage_deletion_jobs is
  'Deferred object deletion. A row is written first and the object removed by a '
  'worker, so a failed delete is retried rather than silently leaking storage.';

create index storage_deletion_jobs_claim_idx
  on public.storage_deletion_jobs (status, available_at)
  where status in ('pending', 'available', 'retrying');

create trigger storage_deletion_jobs_set_updated_at
  before update on public.storage_deletion_jobs
  for each row execute function private.set_updated_at();
