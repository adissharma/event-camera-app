import { requireSupabase } from '@/lib/supabase/client';
import type { Json } from '@/types/database';
import type { CombineStrategy, EntitlementDefinition, EntitlementGrant } from '@/features/entitlements/resolve';

export interface PlanWithEntitlements {
  id: string;
  key: string;
  name: string;
  description: string | null;
  tierRank: number;
  priceMinorUnits: number;
  currency: string;
  entitlements: Record<string, Json>;
}

export const planKeys = {
  all: ['plans'] as const,
  catalogue: () => [...planKeys.all, 'catalogue'] as const,
};

export interface Catalogue {
  plans: PlanWithEntitlements[];
  definitions: EntitlementDefinition[];
}

/**
 * The commercial catalogue.
 *
 * Loaded from the database rather than hard-coded, so pricing and packaging
 * change without an app release — which matters because a store review cycle
 * is a poor place to discover a pricing mistake.
 */
export async function fetchCatalogue(): Promise<Catalogue> {
  const client = requireSupabase();

  const [plansResult, definitionsResult, grantsResult] = await Promise.all([
    client.from('plans').select('*').eq('is_active', true).order('sort_order'),
    client.from('entitlement_definitions').select('*'),
    client.from('plan_entitlements').select('*'),
  ]);

  if (plansResult.error) throw plansResult.error;
  if (definitionsResult.error) throw definitionsResult.error;
  if (grantsResult.error) throw grantsResult.error;

  const definitions: EntitlementDefinition[] = (definitionsResult.data ?? []).map((row) => ({
    key: row.key,
    combineStrategy: row.combine_strategy as CombineStrategy,
    defaultValue: row.default_value,
  }));

  const grantsByPlan = new Map<string, EntitlementGrant[]>();
  for (const grant of grantsResult.data ?? []) {
    const existing = grantsByPlan.get(grant.plan_id) ?? [];
    existing.push({ key: grant.entitlement_key, value: grant.value, rank: 10 });
    grantsByPlan.set(grant.plan_id, existing);
  }

  const plans: PlanWithEntitlements[] = (plansResult.data ?? []).map((plan) => {
    const grants = grantsByPlan.get(plan.id) ?? [];
    const entitlements: Record<string, Json> = {};
    for (const grant of grants) entitlements[grant.key] = grant.value;

    return {
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      tierRank: plan.tier_rank,
      priceMinorUnits: plan.price_minor_units,
      currency: plan.currency,
      entitlements,
    };
  });

  return { plans, definitions };
}

/** Formats minor units without floating-point arithmetic. */
export function formatPrice(minorUnits: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
  }).format(minorUnits / 100);
}
