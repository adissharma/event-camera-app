import {
  entitlementsForPlanKey,
  upgradeForFeature,
  upgradeGains,
  upgradeSummary,
  upgradesForFeature,
  upgradesForGuestLimit,
  allowanceSatisfies,
} from './event-entitlements';
import { getPaywallPlan } from '@/features/payments/plan-catalogue';

const small = getPaywallPlan('small_event')!;
const stories = getPaywallPlan('stories')!;
const plus = getPaywallPlan('stories_plus')!;

describe('what an event includes', () => {
  it('reads the package off the key the event was published on', () => {
    expect(entitlementsForPlanKey('guests_25').plan?.id).toBe('small_event');
    expect(entitlementsForPlanKey('guests_100').plan?.id).toBe('stories');
    expect(entitlementsForPlanKey('guests_unlimited').plan?.id).toBe('stories_plus');
  });

  it('grants nothing at all when the package is unknown', () => {
    // Loading, or an event published before the plan was recorded. Assuming
    // the generous answer would flash premium controls at a host who has not
    // bought them — and at guests, who must never see them.
    for (const key of [null, undefined, 'not_a_plan']) {
      const e = entitlementsForPlanKey(key);
      expect(e.has('video')).toBe(false);
      expect(e.has('guestbook')).toBe(false);
      expect(e.has('challenges')).toBe(false);
      expect(e.has('unlimitedPhotos')).toBe(false);
    }
  });

  it('puts guestbook, challenges and video behind Stories+ only', () => {
    for (const feature of ['guestbook', 'challenges', 'video'] as const) {
      expect(entitlementsForPlanKey('guests_25').has(feature)).toBe(false);
      expect(entitlementsForPlanKey('guests_100').has(feature)).toBe(false);
      expect(entitlementsForPlanKey('guests_unlimited').has(feature)).toBe(true);
    }
  });

  it('carries the guest and photo allowances through', () => {
    expect(entitlementsForPlanKey('guests_25').guestLimit).toBe(25);
    expect(entitlementsForPlanKey('guests_100').guestLimit).toBe(100);
    expect(entitlementsForPlanKey('guests_unlimited').guestLimit).toBe('unlimited');
    expect(entitlementsForPlanKey('guests_unlimited').has('unlimitedPhotos')).toBe(true);
  });
});

describe('which upgrade unlocks a feature', () => {
  it('offers the cheapest package that actually includes it', () => {
    expect(upgradeForFeature(small, 'guestbook')?.id).toBe('stories_plus');
    expect(upgradeForFeature(stories, 'challenges')?.id).toBe('stories_plus');
  });

  it('offers nothing when the event already has it', () => {
    expect(upgradeForFeature(plus, 'guestbook')).toBeNull();
    expect(upgradeForFeature(plus, 'video')).toBeNull();
  });

  it('never offers a sideways or downward move', () => {
    // Stories costs more than Small Event but adds none of these, so it must
    // not appear as a way to get them.
    expect(upgradesForFeature(small, 'video').map((p) => p.id)).toEqual(['stories_plus']);
  });
});

describe('which upgrades satisfy a guest allowance', () => {
  it('offers every package that would do it, cheapest first', () => {
    // A Small Event host asking for 100 can be served by Stories or Stories+;
    // choosing between them is the host's call, not this layer's.
    expect(upgradesForGuestLimit(small, 100).map((p) => p.id)).toEqual([
      'stories',
      'stories_plus',
    ]);
  });

  it('omits packages that would not actually satisfy the request', () => {
    // Stories caps at 100, so it is not an answer to "I want unlimited".
    expect(upgradesForGuestLimit(small, 'unlimited').map((p) => p.id)).toEqual(['stories_plus']);
  });

  it('offers only what is above the current package', () => {
    expect(upgradesForGuestLimit(stories, 'unlimited').map((p) => p.id)).toEqual(['stories_plus']);
    expect(upgradesForGuestLimit(plus, 'unlimited')).toEqual([]);
  });

  it('treats unlimited as covering every finite request', () => {
    expect(allowanceSatisfies('unlimited', 9999)).toBe(true);
    expect(allowanceSatisfies(100, 'unlimited')).toBe(false);
    expect(allowanceSatisfies(100, 100)).toBe(true);
    expect(allowanceSatisfies(25, 100)).toBe(false);
  });
});

describe('what the upgrade screen promises', () => {
  it('lists only what the package actually adds over the current one', () => {
    const gains = upgradeGains(stories, plus);
    expect(gains).toContain('unlimited guests');
    expect(gains).toContain('guestbook');
    expect(gains).toContain('challenges');
    expect(gains).toContain('video');
  });

  it('does not re-promise something the host already has', () => {
    // Both include 20 photos per guest, so the jump from Small Event to
    // Stories must not claim to add photos.
    expect(upgradeGains(small, stories)).not.toContain('20 photos per guest');
  });

  it('reads as a sentence', () => {
    expect(upgradeSummary(stories, plus)).toMatch(/^Upgrade to Stories\+ to unlock .+\.$/);
    expect(upgradeSummary(stories, plus)).toContain(' and ');
  });
});
