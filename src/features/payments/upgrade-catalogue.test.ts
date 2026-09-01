import {
  UPGRADE_PATHS,
  UPGRADE_PRODUCT_IDS,
  planGrantedByUpgradeProduct,
  upgradeChargeFor,
  upgradePath,
  upgradePriceLabel,
} from './upgrade-catalogue';
import { getPaywallPlan } from './plan-catalogue';

const free = getPaywallPlan('free')!;
const small = getPaywallPlan('small_event')!;
const stories = getPaywallPlan('stories')!;
const plus = getPaywallPlan('stories_plus')!;

describe('an upgrade costs the difference and nothing more', () => {
  it('matches the prices set in the stores', () => {
    // These are the real product prices, a penny under the exact gap because
    // Apple's price points are .99-ending. If a store price changes, this is
    // the test that should fail — the host is shown this number.
    expect(upgradePath('small_event', 'stories')!.priceMinorUnits).toBe(1499);
    expect(upgradePath('small_event', 'stories_plus')!.priceMinorUnits).toBe(3499);
    expect(upgradePath('stories', 'stories_plus')!.priceMinorUnits).toBe(1999);
  });

  it('never charges more than the gap it closes', () => {
    // The promise is "pay the difference". Costing more than the difference
    // would make upgrading worse than the host's alternative, and is the
    // direction a transposed tier would fail in.
    for (const path of UPGRADE_PATHS) {
      const gap = path.to.priceMinorUnits - path.from.priceMinorUnits;
      expect(path.priceMinorUnits).toBeGreaterThan(0);
      expect(path.priceMinorUnits).toBeLessThanOrEqual(gap);
    }
  });

  it('stays within a pound of the gap, so a misplaced decimal is caught', () => {
    // Loose enough for the store's rounding, tight enough that £3.49 where
    // £34.99 was meant does not slip through.
    for (const path of UPGRADE_PATHS) {
      const gap = path.to.priceMinorUnits - path.from.priceMinorUnits;
      expect(gap - path.priceMinorUnits).toBeLessThanOrEqual(100);
    }
  });

  it('declares a price for every path, rather than falling back to the raw gap', () => {
    // The fallback would ship a price no product actually sells at.
    for (const path of UPGRADE_PATHS) {
      const gap = path.to.priceMinorUnits - path.from.priceMinorUnits;
      expect(path.priceMinorUnits).not.toBe(gap);
    }
  });

  it('never sells a sideways or downward move', () => {
    expect(upgradePath('stories_plus', 'stories')).toBeNull();
    expect(upgradePath('stories', 'small_event')).toBeNull();
    expect(upgradeChargeFor(plus, plus)).toBeNull();
    expect(upgradeChargeFor(plus, small)).toBeNull();
  });
});

describe('what the host is charged', () => {
  it('uses the delta product when they have already paid for a tier', () => {
    const charge = upgradeChargeFor(small, plus)!;
    expect(charge.isDelta).toBe(true);
    // The store's price, not the raw gap — £34.99, a penny under £35.00,
    // because Apple's price points are .99-ending.
    expect(charge.priceMinorUnits).toBe(3499);
    expect(charge.storeProductId).toBe(
      'com.potoevents.eventcamera.upgrade.small_event_to_stories_plus',
    );
  });

  it('charges full price from the free tier, because nothing was paid to discount', () => {
    for (const from of [null, free]) {
      const charge = upgradeChargeFor(from, plus)!;
      expect(charge.isDelta).toBe(false);
      expect(charge.priceMinorUnits).toBe(plus.priceMinorUnits);
      expect(charge.storeProductId).toBe(plus.storeProductId);
    }
  });

  it('formats the delta, not the destination price', () => {
    expect(upgradePriceLabel(small, plus)).toBe(upgradePriceLabel(small, plus));
    expect(upgradePriceLabel(small, plus)).not.toBe(upgradePriceLabel(null, plus));
  });
});

describe('what the server must grant', () => {
  it('activates the destination tier, not the upgrade product', () => {
    // The upgrade SKU is only how the money is collected. The entitlements
    // written to the celebration are the target plan's.
    expect(upgradePath('small_event', 'stories_plus')!.grantsCatalogueKey).toBe(plus.catalogueKey);
    expect(
      planGrantedByUpgradeProduct('com.potoevents.eventcamera.upgrade.stories_to_stories_plus')?.id,
    ).toBe('stories_plus');
  });

  it('still resolves a plain first-purchase product', () => {
    expect(planGrantedByUpgradeProduct(plus.storeProductId!)?.id).toBe('stories_plus');
  });

  it('resolves nothing for an unknown product', () => {
    expect(planGrantedByUpgradeProduct('com.example.not_ours')).toBeNull();
  });
});

describe('the products that must exist in the stores', () => {
  it('is one per ordered pair of paid tiers', () => {
    // 3 paid tiers -> 3 upward pairs. Listed so they can be created up front
    // rather than discovered by a host hitting a failed purchase.
    expect(UPGRADE_PRODUCT_IDS).toEqual([
      'com.potoevents.eventcamera.upgrade.small_event_to_stories',
      'com.potoevents.eventcamera.upgrade.small_event_to_stories_plus',
      'com.potoevents.eventcamera.upgrade.stories_to_stories_plus',
    ]);
  });

  it('has no duplicates', () => {
    expect(new Set(UPGRADE_PRODUCT_IDS).size).toBe(UPGRADE_PRODUCT_IDS.length);
  });
});

describe('the provider can resolve every product we might buy', () => {
  // Regression: the RevenueCat provider maps callers' keys to store ids from
  // PAYWALL_PLANS alone. Upgrade ids were absent, so `getProducts` returned
  // nothing and every upgrade failed on device as "not available to purchase"
  // while still working against the development provider, which echoes any
  // key back. Both catalogues must be reachable.
  it('registers a store id for every base tier and every upgrade path', () => {
    const { PAYWALL_PLANS } = require('./plan-catalogue');
    const resolvable = new Set<string>([
      ...PAYWALL_PLANS.filter((p: any) => p.storeProductId).map((p: any) => p.catalogueKey),
      ...UPGRADE_PATHS.map((path) => path.storeProductId),
    ]);

    for (const path of UPGRADE_PATHS) {
      expect(resolvable.has(path.storeProductId)).toBe(true);
    }
    expect(resolvable.has('guests_unlimited')).toBe(true);
  });
});
