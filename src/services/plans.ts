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
  try {
    const client = requireSupabase();

    const [plansResult, definitionsResult, grantsResult] = await Promise.all([
      client.from('plans').select('*').eq('is_active', true).order('sort_order'),
      client.from('entitlement_definitions').select('*'),
      client.from('plan_entitlements').select('*'),
    ]);

    if (plansResult.error) throw plansResult.error;
    if (definitionsResult.error) throw definitionsResult.error;
    if (grantsResult.error) throw grantsResult.error;

    if (!plansResult.data || plansResult.data.length === 0) {
      throw new Error('No plans active in database');
    }

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
  } catch (e) {
    console.warn('Failed to fetch catalogue from Supabase, falling back to local catalogue:', e);
    const plans: PlanWithEntitlements[] = [
      {
        id: 'guests_5',
        key: 'guests_5',
        name: '5 Guests',
        description: 'Up to 5 guests can join.',
        tierRank: 1,
        priceMinorUnits: 200,
        currency: 'USD',
        entitlements: { participant_limit: 5 },
      },
      {
        id: 'guests_10',
        key: 'guests_10',
        name: '10 Guests',
        description: 'Up to 10 guests can join.',
        tierRank: 2,
        priceMinorUnits: 1500,
        currency: 'USD',
        entitlements: { participant_limit: 10 },
      },
      {
        id: 'guests_25',
        key: 'guests_25',
        name: '25 Guests',
        description: 'Up to 25 guests can join.',
        tierRank: 3,
        priceMinorUnits: 3000,
        currency: 'USD',
        entitlements: { participant_limit: 25 },
      },
      {
        id: 'guests_50',
        key: 'guests_50',
        name: '50 Guests',
        description: 'Up to 50 guests can join.',
        tierRank: 4,
        priceMinorUnits: 5000,
        currency: 'USD',
        entitlements: { participant_limit: 50 },
      },
      {
        id: 'guests_100',
        key: 'guests_100',
        name: '100 Guests',
        description: 'Up to 100 guests can join.',
        tierRank: 5,
        priceMinorUnits: 10000,
        currency: 'USD',
        entitlements: { participant_limit: 100 },
      },
      {
        id: 'guests_150',
        key: 'guests_150',
        name: '150 Guests',
        description: 'Up to 150 guests can join.',
        tierRank: 6,
        priceMinorUnits: 15000,
        currency: 'USD',
        entitlements: { participant_limit: 150 },
      },
      {
        id: 'guests_200',
        key: 'guests_200',
        name: '200 Guests',
        description: 'Up to 200 guests can join.',
        tierRank: 7,
        priceMinorUnits: 20000,
        currency: 'USD',
        entitlements: { participant_limit: 200 },
      },
      {
        id: 'guests_unlimited',
        key: 'guests_unlimited',
        name: 'Unlimited Guests',
        description: 'Unlimited guests can join.',
        tierRank: 8,
        priceMinorUnits: 10000,
        currency: 'USD',
        entitlements: { participant_limit: 99999 },
      },
    ];

    const definitions: EntitlementDefinition[] = [
      { key: 'participant_limit', combineStrategy: 'sum', defaultValue: 30 },
      { key: 'photo_limit_options', combineStrategy: 'union', defaultValue: [5, 10, 15] },
      { key: 'unlimited_photos', combineStrategy: 'any_true', defaultValue: false },
      { key: 'camera_roll_uploads', combineStrategy: 'any_true', defaultValue: true },
      { key: 'camera_roll_upload_limit', combineStrategy: 'max', defaultValue: 5 },
      { key: 'media_types', combineStrategy: 'union', defaultValue: ['photo'] },
      { key: 'audio_guestbook', combineStrategy: 'any_true', defaultValue: false },
      { key: 'memory_book', combineStrategy: 'any_true', defaultValue: false },
      { key: 'moderation', combineStrategy: 'any_true', defaultValue: false },
      { key: 'cohost_count', combineStrategy: 'max', defaultValue: 0 },
      { key: 'qr_templates', combineStrategy: 'union', defaultValue: ['digital_card'] },
      { key: 'gallery_retention_days', combineStrategy: 'sum', defaultValue: 90 },
      { key: 'support_level', combineStrategy: 'override', defaultValue: 'standard' },
    ];

    return { plans, definitions };
  }
}

/** Formats minor units without floating-point arithmetic. */
export function formatPrice(minorUnits: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
  }).format(minorUnits / 100);
}
