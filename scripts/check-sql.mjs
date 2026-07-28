#!/usr/bin/env node
/**
 * Static checks over the migrations.
 *
 * This is NOT a substitute for running the SQL — it cannot catch a syntax
 * error. It exists because the security-critical invariants here are
 * structural, and a table that silently ships without RLS is a data breach, not
 * a bug report.
 *
 * Run with `npm run check:sql`. Exits non-zero on any violation.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url).pathname;

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n');
/** Comment-stripped copy, so a table named in prose is not mistaken for code. */
const code = sql.replace(/--[^\n]*/g, '');

const failures = [];
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

/* 1. Every table in `public` must have RLS enabled. ------------------------ */

const declaredTables = [...code.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
const rlsEnabled = new Set(
  [...code.matchAll(/alter table public\.(\w+)\s+enable row level security/g)].map((m) => m[1]),
);

const missingRls = declaredTables.filter((t) => !rlsEnabled.has(t));
check(
  'every public table enables row level security',
  missingRls.length === 0,
  missingRls.length ? `missing: ${missingRls.join(', ')}` : `${declaredTables.length} tables`,
);

/* 2. Every SECURITY DEFINER function must pin an empty search_path. -------- */
//
// Without it, a caller can create a schema earlier in the search path and
// shadow an unqualified name, executing their own code with the definer's
// privileges.

const definerBodies = [...code.matchAll(/create or replace function\s+([\w.]+)[\s\S]*?\$\$/g)];
const unsafeDefiners = definerBodies
  .filter((m) => /security definer/i.test(m[0]) && !/set search_path\s*=\s*''/.test(m[0]))
  .map((m) => m[1]);

check(
  'every SECURITY DEFINER function pins search_path',
  unsafeDefiners.length === 0,
  unsafeDefiners.length ? `unsafe: ${unsafeDefiners.join(', ')}` : 'all pinned',
);

/* 3. No permissive `using (true)` on a private table. ---------------------- */
//
// A handful of catalogue tables are legitimately world-readable. Anything else
// with `using (true)` is almost certainly an accident.

const PUBLIC_CATALOGUE = new Set([
  'themes', 'plans', 'add_ons', 'entitlement_definitions',
  'plan_entitlements', 'add_on_entitlements',
]);

// Split on the statement boundary first. A single regex spanning `create
// policy … using (true)` matches greedily ACROSS policies and reports the
// wrong one — it flagged a correctly-scoped `profiles` policy because a
// legitimate catalogue policy further down the file used `using (true)`.
const policyBlocks = code
  .split(/(?=create policy)/i)
  .filter((block) => /^create policy/i.test(block.trim()));

const permissive = policyBlocks
  .map((block) => {
    const header = block.match(/create policy\s+"([^"]+)"\s+on\s+public\.(\w+)/i);
    if (!header) return null;
    return /using\s*\(\s*true\s*\)/i.test(block)
      ? { table: header[2], name: header[1] }
      : null;
  })
  .filter((hit) => hit !== null && !PUBLIC_CATALOGUE.has(hit.table))
  .map((hit) => `${hit.table}: "${hit.name}"`);

check(
  'no permissive using (true) on private tables',
  permissive.length === 0,
  permissive.length ? permissive.join('; ') : 'none',
);

/* 4. Secrets are stored as digests, never plaintext. ----------------------- */

// Only STORED columns matter. Scanning the whole file also picked up
// `guest_access_token` (a return value of the creation RPC — the token is
// deliberately handed back exactly once) and `v_token` (a plpgsql local), and
// neither is persisted.
const tableBlocks = [...code.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g)];

const plaintextSecretColumns = tableBlocks.flatMap(([, table, body]) =>
  // The secret noun must be the FINAL word of the column name. Substring
  // matching produced false positives on `design_tokens` (a JSONB of design
  // tokens) and `pin_required` (a boolean flag) — neither holds a credential.
  [...body.matchAll(/^\s*(\w+)\s+(?!bytea)\w+/gim)]
    .map((m) => m[1])
    .filter((column) => /(^|_)(token|pin|secret|password)$/i.test(column))
    // A resumable upload URL is a short-lived capability URL, not a stored
    // credential; store product and transaction identifiers are public.
    .filter(
      (column) =>
        !['resumable_url', 'platform_product_id', 'platform_transaction_id'].includes(column),
    )
    .map((column) => `${table}.${column}`),
);

check(
  'no plaintext token, pin, secret or password columns',
  plaintextSecretColumns.length === 0,
  plaintextSecretColumns.length ? `found: ${plaintextSecretColumns.join(', ')}` : 'digests only',
);

/* 5. Dollar-quoted function bodies are balanced. --------------------------- */

const dollarQuotes = (sql.match(/\$\$/g) || []).length;
check(
  'dollar-quoted blocks are balanced',
  dollarQuotes % 2 === 0,
  `${dollarQuotes} delimiters`,
);

/* 6. No brand name anywhere in the schema. -------------------------------- */

const brandHits = [...sql.matchAll(/\b(koto|poto)\b/gi)].map((m) => m[0]);
check(
  'no brand name appears in any migration',
  brandHits.length === 0,
  brandHits.length ? `found: ${brandHits.join(', ')}` : 'brand-neutral',
);

/* 7. Migrations are ordered and uniquely timestamped. ---------------------- */

const timestamps = files.map((f) => f.split('_')[0]);
check(
  'migration timestamps are unique and ordered',
  new Set(timestamps).size === timestamps.length &&
    timestamps.every((t, i) => i === 0 || t >= timestamps[i - 1]),
  `${files.length} migrations`,
);

/* ------------------------------------------------------------------------- */

for (const { name, ok, detail } of checks) {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name.padEnd(52)} ${detail}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} static SQL check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} static SQL checks pass across ${files.length} migrations.`);
console.log('NOTE: static only. Run `supabase test db` to actually execute this schema.');
