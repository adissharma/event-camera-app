import {
  PAID_PAYWALL_PLANS,
  PAYWALL_PLANS,
  planForCatalogueKey,
  type Allowance,
  type PaywallPlan,
} from '@/features/payments/plan-catalogue';

/**
 * What one event's package allows.
 *
 * The single place the app answers "can this event do X". Screens ask this
 * rather than reading the plan catalogue themselves, because a screen that
 * knows Guestbook needs Stills+ is a screen that has to be found and edited
 * the next time packaging changes — and the ones that get missed fail open,
 * which is the expensive direction.
 *
 * Entitlements belong to the *event*, not to the person looking at it. A host
 * who bought Stills+ for one wedding has not bought it for the next, and a
 * guest's own account is irrelevant to what the event they were invited to
 * includes. Everything here is therefore derived from the plan the event was
 * published on.
 */

/**
 * The gated capabilities, named once.
 *
 * A closed set rather than free-form strings: adding a capability should be a
 * type error everywhere that switches on one, not a silent no-op in the three
 * places nobody remembered to update.
 */
export type FeatureKey = 'video' | 'guestbook' | 'challenges' | 'unlimitedPhotos';

/** How each capability is described where a host is asked to pay for it. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  video: 'Video',
  guestbook: 'Guestbook',
  challenges: 'Challenges',
  unlimitedPhotos: 'Unlimited photos',
};

/** Whether a given plan includes a capability. The only per-feature mapping. */
function planIncludes(plan: PaywallPlan, feature: FeatureKey): boolean {
  switch (feature) {
    case 'video':
      return plan.videos;
    case 'guestbook':
      return plan.guestbook;
    case 'challenges':
      return plan.challenges;
    case 'unlimitedPhotos':
      return plan.photoAllowance === 'unlimited';
  }
}

export interface EventEntitlements {
  /**
   * The package this event was published on, or `null` when that is not known
   * yet — still loading, or an event that predates the plan being recorded.
   */
  plan: PaywallPlan | null;
  guestLimit: Allowance;
  photoAllowance: Allowance;
  /** Whether the event includes a capability. Unknown plans include nothing. */
  has: (feature: FeatureKey) => boolean;
  /** True while the package is still being resolved. */
  isLoading: boolean;
}

/** Ordered cheapest-first, which is the order an upgrade should be offered in. */
const PLANS_BY_PRICE: readonly PaywallPlan[] = [...PAID_PAYWALL_PLANS].sort(
  (a, b) => a.priceMinorUnits - b.priceMinorUnits,
);

/**
 * The cheapest package that would unlock a capability, above what the event
 * already has.
 *
 * Cheapest rather than "the recommended one": a host being asked to pay to use
 * something should be shown the smallest amount that does it. Returns `null`
 * when the event already has the capability, or when nothing sells it.
 */
export function upgradeForFeature(
  current: PaywallPlan | null,
  feature: FeatureKey,
): PaywallPlan | null {
  if (current && planIncludes(current, feature)) return null;
  return (
    PLANS_BY_PRICE.find(
      (plan) => planIncludes(plan, feature) && plan.priceMinorUnits > (current?.priceMinorUnits ?? -1),
    ) ?? null
  );
}

/**
 * Every package that would satisfy a required guest allowance, above the
 * current one.
 *
 * Plural because the answer legitimately is: a host on Small Event who wants
 * more room may be served by either Stills Lite or Stills+, and picking for them
 * is not this layer's job. The spec is explicit that packages which would
 * *not* satisfy the request must not be offered, which is what the filter is
 * for — an upgrade screen listing a tier that still cannot do the thing is
 * worse than no upgrade screen.
 */
export function upgradesForGuestLimit(
  current: PaywallPlan | null,
  requested: Allowance,
): PaywallPlan[] {
  return PLANS_BY_PRICE.filter(
    (plan) =>
      plan.priceMinorUnits > (current?.priceMinorUnits ?? -1) && allowanceSatisfies(plan.guestLimit, requested),
  );
}

/** Every package above the current one that unlocks a capability. */
export function upgradesForFeature(
  current: PaywallPlan | null,
  feature: FeatureKey,
): PaywallPlan[] {
  return PLANS_BY_PRICE.filter(
    (plan) => planIncludes(plan, feature) && plan.priceMinorUnits > (current?.priceMinorUnits ?? -1),
  );
}

/** Whether an allowance covers a requested one. `'unlimited'` covers everything. */
export function allowanceSatisfies(available: Allowance, requested: Allowance): boolean {
  if (available === 'unlimited') return true;
  if (requested === 'unlimited') return false;
  return available >= requested;
}

/**
 * What a package adds over the one below it, in the host's words.
 *
 * Read off the two plans rather than written out per upgrade path, so the
 * sentence on an upgrade screen cannot promise something the package does not
 * actually grant — which is the failure the spec warns about when it says to
 * use the real entitlements rather than the example sentence.
 */
export function upgradeGains(from: PaywallPlan | null, to: PaywallPlan): string[] {
  const gains: string[] = [];

  if (!from || !allowanceSatisfies(from.guestLimit, to.guestLimit)) {
    gains.push(to.guestLimit === 'unlimited' ? 'unlimited guests' : `${to.guestLimit} guests`);
  }
  if (!from || !allowanceSatisfies(from.photoAllowance, to.photoAllowance)) {
    gains.push(
      to.photoAllowance === 'unlimited'
        ? 'unlimited photos'
        : `${to.photoAllowance} photos per guest`,
    );
  }
  for (const feature of ['video', 'guestbook', 'challenges'] as const) {
    if (planIncludes(to, feature) && !(from && planIncludes(from, feature))) {
      gains.push(FEATURE_LABELS[feature].toLowerCase());
    }
  }
  return gains;
}

/** One sentence saying what the upgrade buys, built from the gains above. */
export function upgradeSummary(from: PaywallPlan | null, to: PaywallPlan): string {
  const gains = upgradeGains(from, to);
  if (gains.length === 0) return `Upgrade to ${to.displayName}.`;
  const list =
    gains.length === 1
      ? gains[0]!
      : `${gains.slice(0, -1).join(', ')} and ${gains[gains.length - 1]}`;
  return `Upgrade to ${to.displayName} to unlock ${list}.`;
}

/**
 * Builds the entitlement set for a plan.
 *
 * An unresolved plan grants nothing. That is deliberate: the alternative —
 * assuming the most generous tier while loading — flashes premium controls at
 * a host who has not bought them and, worse, at guests who should never see
 * them at all.
 */
export function entitlementsForPlan(
  plan: PaywallPlan | null,
  isLoading = false,
): EventEntitlements {
  return {
    plan,
    guestLimit: plan?.guestLimit ?? 0,
    photoAllowance: plan?.photoAllowance ?? 0,
    has: (feature) => (plan ? planIncludes(plan, feature) : false),
    isLoading,
  };
}

/** The same, from the `plans.key` the event was published on. */
export function entitlementsForPlanKey(
  key: string | null | undefined,
  isLoading = false,
): EventEntitlements {
  return entitlementsForPlan(planForCatalogueKey(key), isLoading);
}

/** Exposed for tests and for screens that need to enumerate the tiers. */
export const ALL_PLANS = PAYWALL_PLANS;
