# Database

Migrations, policies, seed data and tests for the backend.

## Prerequisites

The Supabase CLI needs Docker to run the local stack. Neither is installed on
the current development machine, so **these migrations have been authored and
reviewed but not yet applied**. See "Verification status" below.

```bash
brew install supabase/tap/supabase   # or: npm i -g supabase
# Docker Desktop: https://www.docker.com/products/docker-desktop
```

## Local development

```bash
supabase start                # boots Postgres, Auth, Storage, Studio
supabase db reset             # applies every migration, then seed.sql
supabase test db              # runs the pgTAP suites in tests/
supabase stop
```

Studio: <http://localhost:54323> · Mail catcher: <http://localhost:54324>

## Applying to a hosted project

```bash
supabase link --project-ref <your-project-ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql   # catalogue and themes
```

## Regenerating TypeScript types

`src/types/database.ts` is hand-written to match these migrations exactly. Once
the CLI can run against a database, replace it with generated output:

```bash
supabase gen types typescript --local > src/types/database.ts
# or, against the hosted project:
supabase gen types typescript --project-id <ref> > src/types/database.ts
```

## Layout

```
migrations/
  20260728100000_extensions_and_enums.sql   extensions, private schema, enums
  20260728100100_core_tables.sql            workspaces → celebrations → sessions
  20260728100200_access_and_guests.sql      access links, guest sessions, QR
  20260728100300_media.sql                  media, intents, variants, jobs
  20260728100400_commerce.sql               plans, add-ons, entitlements
  20260728100500_functions.sql              auth helpers, bootstrap, atomic RPC
  20260728100600_rls.sql                    row level security
  20260728100700_storage.sql                private buckets and their policies
seed.sql                                    themes and commercial catalogue
tests/                                      pgTAP suites
```

Migrations are append-only. Never edit an applied file — add a new one.

## Design decisions worth knowing

**Brand neutrality.** No table, column, enum, function, bucket or seed value
contains a product name. Renaming the product touches no SQL.

**Secrets are digests.** Access tokens, guest tokens and PINs are stored only as
32-byte SHA-256 digests, enforced by check constraints. A plaintext token is
returned to its creator exactly once and is not recoverable afterwards —
regenerating the link is the recovery path.

**Helpers live in `private`.** RLS policies that query the table they protect
recurse infinitely. The helpers in `private` are SECURITY DEFINER so they read
beneath RLS and break the cycle. `private` is excluded from the exposed schema
list in `config.toml`, so PostgREST will not serve them.

**Every SECURITY DEFINER function sets `search_path = ''`.** Without it a caller
can shadow an unqualified name and run their own code with the definer's
privileges.

**Clients cannot write media, guest sessions, purchases or entitlements.**
Those are created by server-side operations that enforce shot limits, event
open/closed state, permitted media types and store receipt verification. Both
RLS *and* table privileges deny the write, so a mistakenly added policy still
cannot open a hole.

**Internal pipeline tables have RLS enabled and no policies**, which denies by
default, and privileges are revoked as well.

**Soft deletion.** Important user content sets `deleted_at`. There is no delete
policy on celebrations — an accidental tap must be recoverable, and media
cleanup is queued rather than immediate.

**Uploads are idempotent** via `unique (event_session_id, client_media_id)`,
where the client id is generated before any network access. A retry reuses the
row; it never creates a duplicate photograph.

**Money is integer minor units.** Floating-point currency produces rounding
errors that surface on invoices.

## Verification status

| | Status |
|---|---|
| SQL authored and reviewed | ✅ |
| Applied to a database | ❌ — needs Docker or a hosted project |
| pgTAP suites executed | ❌ — needs `supabase test db` |
| Types generated from a live schema | ❌ — hand-written for now |

The tests are written and committed, but **they have not been run**. Treat them
as unverified until `supabase test db` passes. Running them is the first task
once Docker or hosted credentials are available.
