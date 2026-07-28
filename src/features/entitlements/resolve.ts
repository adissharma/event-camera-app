import type { Json } from '@/types/database';

/**
 * Entitlement resolution.
 *
 * Commercial rules are never hard-coded in the interface. A plan and any
 * purchased add-ons are reconciled here into one effective set, which the UI
 * then reads to decide what to show, unlock or label as unavailable.
 *
 * The combination strategy comes from the entitlement definition rather than
 * being assumed, because the right answer differs per key. See
 * `supabase/migrations/20260728100800_entitlement_combination.sql`.
 */

export type CombineStrategy = 'max' | 'sum' | 'any_true' | 'union' | 'override';

export interface EntitlementDefinition {
  key: string;
  combineStrategy: CombineStrategy;
  defaultValue: Json;
}

export interface EntitlementGrant {
  key: string;
  value: Json;
  /** Higher wins under the `override` strategy. A plan outranks an add-on. */
  rank?: number;
}

export type ResolvedEntitlements = Record<string, Json>;

/** Sentinel for an unlimited allowance. `null` in the database. */
export const UNLIMITED = null;

function asNumber(value: Json): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asArray(value: Json): Json[] {
  return Array.isArray(value) ? value : [];
}

function combine(strategy: CombineStrategy, values: EntitlementGrant[]): Json {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0].value;

  switch (strategy) {
    case 'max': {
      // `null` means unlimited and beats every finite value.
      if (values.some((v) => v.value === UNLIMITED)) return UNLIMITED;
      const numbers = values.map((v) => asNumber(v.value)).filter((n): n is number => n !== null);
      return numbers.length > 0 ? Math.max(...numbers) : values[0].value;
    }

    case 'sum': {
      if (values.some((v) => v.value === UNLIMITED)) return UNLIMITED;
      const numbers = values.map((v) => asNumber(v.value)).filter((n): n is number => n !== null);
      return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) : values[0].value;
    }

    case 'any_true':
      return values.some((v) => v.value === true);

    case 'union': {
      const seen = new Set<string>();
      const merged: Json[] = [];
      for (const grant of values) {
        for (const item of asArray(grant.value)) {
          const fingerprint = JSON.stringify(item);
          if (!seen.has(fingerprint)) {
            seen.add(fingerprint);
            merged.push(item);
          }
        }
      }
      // Numeric option lists (photo limits) must stay ordered for display.
      if (merged.every((m) => typeof m === 'number')) {
        return (merged as number[]).sort((a, b) => a - b);
      }
      return merged;
    }

    case 'override': {
      const ranked = [...values].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
      return ranked[0].value;
    }
  }
}

/**
 * Resolves the effective entitlements for a celebration.
 *
 * Every defined key is present in the result — a key nobody granted falls back
 * to its default. That means the UI never has to distinguish "not granted" from
 * "not configured", which is the usual source of a feature silently vanishing.
 */
export function resolveEntitlements(
  definitions: readonly EntitlementDefinition[],
  grants: readonly EntitlementGrant[],
): ResolvedEntitlements {
  const byKey = new Map<string, EntitlementGrant[]>();
  for (const grant of grants) {
    const existing = byKey.get(grant.key);
    if (existing) existing.push(grant);
    else byKey.set(grant.key, [grant]);
  }

  const resolved: ResolvedEntitlements = {};
  for (const definition of definitions) {
    const applicable = byKey.get(definition.key) ?? [];
    resolved[definition.key] =
      applicable.length === 0
        ? definition.defaultValue
        : combine(definition.combineStrategy, applicable);
  }
  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Typed accessors                                                            */
/* -------------------------------------------------------------------------- */

export function entitlementBoolean(
  entitlements: ResolvedEntitlements,
  key: string,
  fallback = false,
): boolean {
  const value = entitlements[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** Returns `null` for an unlimited allowance. */
export function entitlementNumber(
  entitlements: ResolvedEntitlements,
  key: string,
  fallback: number | null = null,
): number | null {
  if (!(key in entitlements)) return fallback;
  const value = entitlements[key];
  if (value === UNLIMITED) return null;
  return asNumber(value) ?? fallback;
}

export function entitlementList<T extends Json>(
  entitlements: ResolvedEntitlements,
  key: string,
): T[] {
  return asArray(entitlements[key]) as T[];
}

/**
 * The photo-limit options a host may choose from.
 *
 * `null` (unlimited) is appended only when the plan actually grants it, so the
 * interface never offers a control that would fail — the brief is explicit that
 * unlimited is a configured upsell and never a hard-coded amount.
 */
export function photoLimitOptions(entitlements: ResolvedEntitlements): (number | null)[] {
  const options = entitlementList<number>(entitlements, 'photo_limit_options')
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b);

  return entitlementBoolean(entitlements, 'unlimited_photos')
    ? [...options, null]
    : options;
}

/** True when `count` is within the allowance. An unlimited allowance always is. */
export function isWithinAllowance(
  entitlements: ResolvedEntitlements,
  key: string,
  count: number,
): boolean {
  const limit = entitlementNumber(entitlements, key);
  return limit === null || count <= limit;
}
