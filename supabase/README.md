# Database

Migrations, policies, seed data and tests for the backend.

## Prerequisites

```bash
brew install supabase/tap/supabase   # or use the local devDependency via npx
```

Docker is required for the local stack and for `supabase test db`.

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

`src/types/database.generated.ts` is generated and is the source of truth. Never
edit it. Regenerate after every migration:

```bash
npx supabase gen types typescript --linked > src/types/database.generated.ts
```

`src/types/database.ts` holds only derived aliases over it (`CelebrationRow`
rather than `Database['public']['Tables']['celebrations']['Row']`). Because
every alias is derived rather than restated, a schema change that breaks an
assumption surfaces as a type error instead of drifting silently.

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
  20260728100800_entitlement_combination.sql  how plan + add-on grants combine
  20260728100900_explicit_grants.sql        explicit table privileges
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
| Applied to a local stack | ✅ all 10 migrations |
| Applied to the hosted project | ✅ |
| pgTAP suites executed | ✅ **35/35 passing** |
| Types generated from the live schema | ✅ `database.generated.ts` |
| Anon lockout verified over REST | ✅ hosted, with the shipping anon key |

Re-run with:

```bash
npx supabase test db
```

### What the run found

Two real defects, both fixed:

**1. Privileges were environment-dependent.** The RLS migration only ever
`REVOKE`d, leaving the grant side to Supabase's `alter default privileges`
setup. That is not identical everywhere: the same schema returned `[]` for
`public.celebrations` on the hosted project (grant present, RLS filtering) and
`permission denied` locally (no grant at all). Privileges are now stated
explicitly in `20260728100900_explicit_grants.sql`, so the schema means the same
thing in every environment.

**2. A test asserted the weaker guarantee.** The anonymous-access tests checked
for *zero rows*, which passed on the hosted project only because the implicit
grants let the query run and RLS filter it. They now assert `42501` — anon is
refused at the privilege layer, before RLS is consulted. A policy added by
mistake later still cannot expose those tables.

The lesson worth keeping: the suite passing against one environment proved less
than it appeared to. It was running the schema locally, where the defaults
differ, that exposed both.

