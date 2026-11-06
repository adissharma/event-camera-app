import type { Allowance, PaywallPlan } from '@/features/payments/plan-catalogue';

/** What the stepper moves by. Small enough for a dinner, quick enough for a wedding. */
const STEP = 5;

/** The most guests an event can actually hold: the lower of its package and its host. */
export function effectiveGuestLimit(
  plan: PaywallPlan | null,
  hostLimit: number | null,
): Allowance | null {
  if (!plan) return hostLimit;
  if (plan.guestLimit === 'unlimited') return hostLimit ?? 'unlimited';
  return hostLimit === null ? plan.guestLimit : Math.min(hostLimit, plan.guestLimit);
}

/**
 * What to store for the number the host chose.
 *
 * Choosing the package's own ceiling is the same as having no limit of their own,
 * and storing it as that means a later upgrade is not silently held back by it.
 */
export function hostLimitToSave(plan: PaywallPlan | null, value: number | null): number | null {
  if (value === null) return null;
  if (plan && plan.guestLimit !== 'unlimited' && value >= plan.guestLimit) return null;
  return value;
}

/** Moves to the next multiple of the step, so 12 goes up to 15 and down to 10. */
export function stepGuestLimit(value: number, direction: 1 | -1, max: number | null): number {
  const next =
    direction === 1
      ? (Math.floor(value / STEP) + 1) * STEP
      : (Math.ceil(value / STEP) - 1) * STEP;
  const atLeastOne = Math.max(next, 1);
  return max === null ? atLeastOne : Math.min(atLeastOne, max);
}

export type GuestCapacityState = 'room' | 'nearlyFull' | 'full';

/** How close a capped event is to its limit, for how hard to press an upgrade. */
export function guestCapacityState(joined: number, limit: number): GuestCapacityState {
  if (joined >= limit) return 'full';
  return joined / limit >= 0.8 ? 'nearlyFull' : 'room';
}

/**
 * The per-guest photo limit an event should be created with on a package.
 *
 * `null` means unlimited, both here and in the database, so a package with an
 * allowance has to turn that into its number. With no package known, the host's
 * choice stands: there is nothing to hold it against.
 */
export function shotLimitForPlan(plan: PaywallPlan | null, chosen: number | null): number | null {
  if (!plan || plan.photoAllowance === 'unlimited') return chosen;
  return chosen === null ? plan.photoAllowance : Math.min(chosen, plan.photoAllowance);
}
