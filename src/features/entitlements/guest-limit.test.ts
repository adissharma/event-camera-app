import { getPaywallPlan } from '@/features/payments/plan-catalogue';
import {
  effectiveGuestLimit,
  guestCapacityState,
  hostLimitToSave,
  shotLimitForPlan,
  stepGuestLimit,
} from './guest-limit';

const free = getPaywallPlan('free');
const small = getPaywallPlan('small_event');
const plus = getPaywallPlan('stories_plus');

describe('effectiveGuestLimit', () => {
  it('is unlimited on the top package until the host sets a number', () => {
    expect(effectiveGuestLimit(plus, null)).toBe('unlimited');
    expect(effectiveGuestLimit(plus, 60)).toBe(60);
  });

  it('never lets a host number exceed the package', () => {
    expect(effectiveGuestLimit(small, null)).toBe(25);
    expect(effectiveGuestLimit(small, 10)).toBe(10);
    expect(effectiveGuestLimit(small, 40)).toBe(25);
  });

  it('knows only the host number when the package is unknown', () => {
    expect(effectiveGuestLimit(null, null)).toBeNull();
    expect(effectiveGuestLimit(null, 10)).toBe(10);
  });
});

describe('hostLimitToSave', () => {
  it('stores the package ceiling as no limit, so an upgrade is not held back by it', () => {
    expect(hostLimitToSave(small, 25)).toBeNull();
    expect(hostLimitToSave(small, 30)).toBeNull();
  });

  it('keeps a number below the ceiling', () => {
    expect(hostLimitToSave(small, 24)).toBe(24);
    expect(hostLimitToSave(plus, 500)).toBe(500);
  });

  it('keeps no limit as no limit', () => {
    expect(hostLimitToSave(plus, null)).toBeNull();
  });
});

describe('stepGuestLimit', () => {
  it('moves to the next multiple of five', () => {
    expect(stepGuestLimit(12, 1, null)).toBe(15);
    expect(stepGuestLimit(12, -1, null)).toBe(10);
    expect(stepGuestLimit(15, 1, null)).toBe(20);
    expect(stepGuestLimit(15, -1, null)).toBe(10);
  });

  it('stops at one and at the package ceiling', () => {
    expect(stepGuestLimit(5, -1, null)).toBe(1);
    expect(stepGuestLimit(1, -1, null)).toBe(1);
    expect(stepGuestLimit(24, 1, 25)).toBe(25);
    expect(stepGuestLimit(25, 1, 25)).toBe(25);
  });
});

describe('guestCapacityState', () => {
  it('presses harder as the event fills', () => {
    expect(guestCapacityState(0, 25)).toBe('room');
    expect(guestCapacityState(19, 25)).toBe('room');
    expect(guestCapacityState(20, 25)).toBe('nearlyFull');
    expect(guestCapacityState(25, 25)).toBe('full');
    expect(guestCapacityState(30, 25)).toBe('full');
  });
});

describe('shotLimitForPlan', () => {
  it('keeps unlimited on a package that includes it', () => {
    expect(shotLimitForPlan(plus, null)).toBeNull();
    expect(shotLimitForPlan(plus, 36)).toBe(36);
  });

  it('holds a smaller package to its allowance', () => {
    expect(shotLimitForPlan(free, null)).toBe(20);
    expect(shotLimitForPlan(free, 36)).toBe(20);
    expect(shotLimitForPlan(free, 10)).toBe(10);
  });

  it('leaves the choice alone when the package is unknown', () => {
    expect(shotLimitForPlan(null, null)).toBeNull();
  });
});
