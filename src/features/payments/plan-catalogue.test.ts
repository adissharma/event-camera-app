import {
  FREE_PAYWALL_PLAN,
  PAID_PAYWALL_PLANS,
  PAYWALL_PLANS,
  RECOMMENDED_PLAN_ID,
  getPaywallPlan,
  isFreePlanKey,
  planFeatureRows,
  planForCatalogueKey,
  planGuestSubtitle,
  planPriceLabel,
} from './plan-catalogue';

/**
 * These pin the packaging the paywall promises.
 *
 * The screen renders none of these strings itself — it asks this module — so
 * a change to what a tier includes shows up here rather than only in a
 * screenshot someone has to notice. That is the whole reason the numbers were
 * moved out of the view: the previous screen kept its own copy of the plan
 * list beside the catalogue's, and two copies of "how many guests" is a bug
 * waiting for one of them to be edited.
 */

describe('paid plans', () => {
  it('offers exactly the three purchasable tiers, in display order', () => {
    expect(PAID_PAYWALL_PLANS.map((p) => p.id)).toEqual(['small_event', 'stories', 'stories_plus']);
  });

  it('prices each tier as advertised', () => {
    expect(PAID_PAYWALL_PLANS.map(planPriceLabel)).toEqual(['£14.99', '£29.99', '£49.99']);
  });

  it('summarises capacity on the card', () => {
    expect(PAID_PAYWALL_PLANS.map(planGuestSubtitle)).toEqual([
      'Up to 25 guests',
      'Up to 100 guests',
      'Unlimited guests',
    ]);
  });

  it('recommends Stories+, and only Stories+', () => {
    expect(RECOMMENDED_PLAN_ID).toBe('stories_plus');
    expect(PAYWALL_PLANS.filter((p) => p.isRecommended)).toHaveLength(1);
  });
});

describe('hero entitlement rows', () => {
  /*
   * Always five, always in the same order, whichever plan is selected — the
   * rows answer differently but never reorder or change count, so switching
   * plans does not reshuffle the layout.
   */
  it('is always five rows for every plan', () => {
    for (const plan of PAYWALL_PLANS) {
      expect(planFeatureRows(plan)).toHaveLength(5);
    }
  });

  it('describes Stories+ as fully included', () => {
    const rows = planFeatureRows(getPaywallPlan('stories_plus')!);
    expect(rows.map((r) => r.label)).toEqual([
      'Unlimited guests',
      'Unlimited photos',
      'Unlimited videos',
      'Guestbook',
      'Challenges',
    ]);
    expect(rows.every((r) => r.included)).toBe(true);
  });

  it('describes Stories with its three exclusions', () => {
    const rows = planFeatureRows(getPaywallPlan('stories')!);
    expect(rows.map((r) => r.label)).toEqual([
      '100 guests',
      '20 photos per guest',
      'No videos',
      'No guestbook',
      'No challenges',
    ]);
    expect(rows.map((r) => r.included)).toEqual([true, true, false, false, false]);
  });

  it('describes Small Event on the same pattern', () => {
    const rows = planFeatureRows(getPaywallPlan('small_event')!);
    expect(rows[0]!.label).toBe('25 guests');
    expect(rows.map((r) => r.included)).toEqual([true, true, false, false, false]);
  });

  it('never marks an unavailable feature as included', () => {
    for (const plan of PAYWALL_PLANS) {
      const rows = planFeatureRows(plan);
      expect(rows[2]!.included).toBe(plan.videos);
      expect(rows[3]!.included).toBe(plan.guestbook);
      expect(rows[4]!.included).toBe(plan.challenges);
    }
  });
});

describe('catalogue mapping', () => {
  /*
   * `catalogueKey` is what `publishDraft` carries into the purchase and
   * publish stages. A tier pointing at a key the catalogue does not serve
   * would fail at the till, so the join is worth pinning.
   */
  it('maps every tier to a distinct catalogue key', () => {
    const keys = PAYWALL_PLANS.map((p) => p.catalogueKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('round-trips a persisted selection back to its plan', () => {
    for (const plan of PAYWALL_PLANS) {
      expect(planForCatalogueKey(plan.catalogueKey)?.id).toBe(plan.id);
    }
  });

  it('returns nothing for an unknown or absent key', () => {
    expect(planForCatalogueKey('guests_9999')).toBeNull();
    expect(planForCatalogueKey(null)).toBeNull();
    expect(getPaywallPlan(null)).toBeNull();
  });
});

describe('the free tier', () => {
  it('is five guests and costs nothing', () => {
    expect(FREE_PAYWALL_PLAN.guestLimit).toBe(5);
    expect(FREE_PAYWALL_PLAN.priceMinorUnits).toBe(0);
    expect(FREE_PAYWALL_PLAN.isFree).toBe(true);
  });

  it('is not one of the three cards', () => {
    expect(PAID_PAYWALL_PLANS.some((p) => p.isFree)).toBe(false);
  });

  /*
   * `publishDraft` asks this before entering the purchase stage. If it ever
   * answered false for the free tier, choosing "try for free" would send the
   * host to the store — the one thing that path exists to avoid.
   */
  it('is recognised as free by its catalogue key, so purchase is skipped', () => {
    expect(isFreePlanKey(FREE_PAYWALL_PLAN.catalogueKey)).toBe(true);
  });

  it('does not treat a paid tier as free', () => {
    for (const plan of PAID_PAYWALL_PLANS) {
      expect(isFreePlanKey(plan.catalogueKey)).toBe(false);
    }
    expect(isFreePlanKey(null)).toBe(false);
    expect(isFreePlanKey('guests_9999')).toBe(false);
  });

  it('carries no store product, unlike every paid tier', () => {
    expect(FREE_PAYWALL_PLAN.storeProductId).toBeNull();
    for (const plan of PAID_PAYWALL_PLANS) {
      expect(typeof plan.storeProductId).toBe('string');
    }
  });
});
