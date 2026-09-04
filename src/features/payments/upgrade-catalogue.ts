import { LOCALE_CONFIG } from '@/config/app-config';
import { formatPrice } from '@/services/plans';
import {
  PAID_PAYWALL_PLANS,
  getPaywallPlan,
  type PaywallPlan,
  type PaywallPlanId,
} from './plan-catalogue';

/**
 * Moving an event from one package to a higher one.
 *
 * These tiers are one-time purchases, not subscriptions, and StoreKit offers
 * no proration for those — a host who bought Small Event and then wants
 * Stills+ would otherwise be charged the full £49.99 on top of the £14.99
 * they already paid. So each upgrade path is its own product, priced at the
 * difference, and the store charges that instead.
 *
 * The prices are declared rather than computed, because the store cannot
 * charge an arbitrary amount: Apple's price points are .99-ending, so the
 * exact differences (£15.00, £35.00, £20.00) are not purchasable and the real
 * products are a penny under. A computed delta would therefore display a
 * price the host is never charged.
 *
 * Declaring them by hand is what a computed value was avoiding, so the
 * relationship is asserted in the tests instead: every upgrade must cost no
 * more than the gap it closes, and within a pound of it. That still catches a
 * transposed tier or a misplaced decimal, while allowing the rounding the
 * store forces.
 */

export interface UpgradePath {
  from: PaywallPlan;
  to: PaywallPlan;
  /**
   * What the store charges for this move — the price of the upgrade product,
   * which is the gap between the tiers rounded to a purchasable price point.
   */
  priceMinorUnits: number;
  currency: string;
  /**
   * The store product for this specific move.
   *
   * One per ordered pair, because that is what a store needs to charge a
   * delta. They must exist in App Store Connect / Play Console before an
   * upgrade can transact — see `UPGRADE_PRODUCT_IDS` for the full list to
   * create.
   */
  storeProductId: string;
  /**
   * The catalogue key the *server* must activate on success — the target
   * plan's, not the upgrade's. The upgrade product is how the money is
   * collected; the entitlements granted are the destination tier's.
   */
  grantsCatalogueKey: string;
}

/** `com.potoevents.eventcamera.upgrade.small_event_to_stories_plus` and friends. */
function upgradeProductId(from: PaywallPlanId, to: PaywallPlanId): string {
  return `com.potoevents.eventcamera.upgrade.${from}_to_${to}`;
}

/**
 * What each upgrade product actually costs in the store.
 *
 * Keyed `from->to`. These must match App Store Connect and Play Console
 * exactly — this is the number the host is shown, and showing one the store
 * does not charge is the bug this table exists to prevent.
 */
const UPGRADE_PRICE_MINOR_UNITS: Record<string, number> = {
  'small_event->stories': 1499,
  'small_event->stories_plus': 3499,
  'stories->stories_plus': 1999,
};

function buildPaths(): UpgradePath[] {
  const paths: UpgradePath[] = [];
  for (const from of PAID_PAYWALL_PLANS) {
    for (const to of PAID_PAYWALL_PLANS) {
      if (to.priceMinorUnits <= from.priceMinorUnits) continue;
      const declared = UPGRADE_PRICE_MINOR_UNITS[`${from.id}->${to.id}`];
      paths.push({
        from,
        to,
        // Falling back to the raw gap would quietly ship a price no product
        // sells at. A missing entry is a configuration error, and the tests
        // assert every path has one.
        priceMinorUnits: declared ?? to.priceMinorUnits - from.priceMinorUnits,
        currency: to.currency,
        storeProductId: upgradeProductId(from.id, to.id),
        grantsCatalogueKey: to.catalogueKey,
      });
    }
  }
  return paths;
}

export const UPGRADE_PATHS: readonly UpgradePath[] = buildPaths();

/**
 * Every product id that has to exist in the stores for upgrades to work.
 *
 * Exported so it can be listed in a release checklist rather than discovered
 * by a host hitting a purchase that fails.
 */
export const UPGRADE_PRODUCT_IDS: readonly string[] = UPGRADE_PATHS.map(
  (path) => path.storeProductId,
);

/**
 * How to charge for moving this event up to `to`.
 *
 * `from` is `null` for an event on the free tier — nothing was paid, so there
 * is nothing to discount and the host buys the target outright at its own
 * price and product. That is not an upgrade in the store's sense, and
 * pretending it is would invent a delta against a payment that never happened.
 */
export function upgradeChargeFor(
  from: PaywallPlan | null,
  to: PaywallPlan,
): { priceMinorUnits: number; currency: string; storeProductId: string; isDelta: boolean } | null {
  if (from && from.priceMinorUnits >= to.priceMinorUnits) return null;

  if (!from || from.isFree) {
    if (!to.storeProductId) return null;
    return {
      priceMinorUnits: to.priceMinorUnits,
      currency: to.currency,
      storeProductId: to.storeProductId,
      isDelta: false,
    };
  }

  const path = UPGRADE_PATHS.find((candidate) => candidate.from.id === from.id && candidate.to.id === to.id);
  if (!path) return null;
  return {
    priceMinorUnits: path.priceMinorUnits,
    currency: path.currency,
    storeProductId: path.storeProductId,
    isDelta: true,
  };
}

/** What the host is asked to pay, formatted. */
export function upgradePriceLabel(from: PaywallPlan | null, to: PaywallPlan): string | null {
  const charge = upgradeChargeFor(from, to);
  if (!charge) return null;
  return formatPrice(charge.priceMinorUnits, charge.currency, LOCALE_CONFIG.locale);
}

/** Test seam and a readable lookup for screens. */
export function upgradePath(from: PaywallPlanId, to: PaywallPlanId): UpgradePath | null {
  return (
    UPGRADE_PATHS.find((path) => path.from.id === from && path.to.id === to) ?? null
  );
}

/** The plan an upgrade product grants, for the server-side activation call. */
export function planGrantedByUpgradeProduct(storeProductId: string): PaywallPlan | null {
  const path = UPGRADE_PATHS.find((candidate) => candidate.storeProductId === storeProductId);
  if (path) return path.to;
  return PAID_PAYWALL_PLANS.find((plan) => plan.storeProductId === storeProductId) ?? null;
}

export { getPaywallPlan };
