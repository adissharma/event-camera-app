-- Guest access: links, anonymous guest sessions and QR assets.
--
-- No secret in this file is ever stored in plain text. Access tokens and PINs
-- are held only as SHA-256 digests, so a database disclosure does not hand an
-- attacker working guest links.

-- ---------------------------------------------------------------------------
-- access_links
-- ---------------------------------------------------------------------------

create table public.access_links (
  id uuid primary key default gen_random_uuid(),
  event_session_id uuid not null references public.event_sessions (id) on delete cascade,
  kind public.access_link_kind not null default 'guest',
  -- SHA-256 of the token. The plaintext is returned to the creator exactly once
  -- and never persisted.
  token_hash bytea not null,
  -- SHA-256 of the event PIN, when one is set.
  pin_hash bytea,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint access_links_token_hash_length check (octet_length(token_hash) = 32),
  constraint access_links_pin_hash_length check (
    pin_hash is null or octet_length(pin_hash) = 32
  )
);

comment on table public.access_links is
  'Tokens granting guest access to one event session. Only digests are stored.';

comment on column public.access_links.token_hash is
  'SHA-256 digest. Never store or log the plaintext token.';

-- Lookup during join is by digest, so this must be unique and indexed.
create unique index access_links_token_hash_idx on public.access_links (token_hash);
create index access_links_session_idx on public.access_links (event_session_id)
  where is_active;

create trigger access_links_set_updated_at
  before update on public.access_links
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- guest_sessions
-- ---------------------------------------------------------------------------

create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  event_session_id uuid not null references public.event_sessions (id) on delete cascade,
  -- Optional. A guest may contribute without giving any name at all.
  display_name text,
  anonymous_token_hash bytea not null,
  -- A salted digest, never a raw device identifier. Used only to reconcile a
  -- returning guest with their own contributions and shot count.
  device_identifier_hash bytea,
  consent_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint guest_sessions_token_hash_length check (
    octet_length(anonymous_token_hash) = 32
  ),
  constraint guest_sessions_device_hash_length check (
    device_identifier_hash is null or octet_length(device_identifier_hash) = 32
  ),
  constraint guest_sessions_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  )
);

comment on table public.guest_sessions is
  'An anonymous or lightly identified guest participating in one event session. '
  'Collect the minimum: a name is optional and no raw device identifier is kept.';

comment on column public.guest_sessions.device_identifier_hash is
  'Salted SHA-256. Never a raw device identifier — that would be a persistent '
  'cross-event identifier for a person who never created an account.';

create unique index guest_sessions_token_hash_idx
  on public.guest_sessions (anonymous_token_hash);
create index guest_sessions_session_idx on public.guest_sessions (event_session_id);

-- ---------------------------------------------------------------------------
-- qr_assets
-- ---------------------------------------------------------------------------

create table public.qr_assets (
  id uuid primary key default gen_random_uuid(),
  event_session_id uuid not null references public.event_sessions (id) on delete cascade,
  access_link_id uuid not null references public.access_links (id) on delete cascade,
  template_key text not null,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint qr_assets_template_key_format check (template_key ~ '^[a-z0-9_]+$')
);

comment on table public.qr_assets is
  'Rendered QR artwork per template (digital card, A4 poster, table card…).';

create unique index qr_assets_session_template_idx
  on public.qr_assets (event_session_id, template_key);

create trigger qr_assets_set_updated_at
  before update on public.qr_assets
  for each row execute function private.set_updated_at();
