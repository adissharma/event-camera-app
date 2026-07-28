/**
 * Motion tokens.
 *
 * Three tiers, per `docs/motion-system.md`:
 *
 *   micro     120–220ms  press, selection, toggle, theme/limit/template choice
 *   standard  200–320ms  step changes, sheets, disclosure, validation, preview
 *   emotional 350–550ms  publication, QR generation, upgrade, first event, unlock
 *
 * Motion must be interruptible and must never block interaction. Every value
 * here passes through `useMotion()`, which collapses durations toward a brief
 * fade when the OS reduce-motion setting is on — meaning is preserved, movement
 * is not.
 */

import { Easing } from 'react-native-reanimated';

export const duration = {
  instant: 0,
  microFast: 120,
  micro: 160,
  microSlow: 220,
  standardFast: 200,
  standard: 260,
  standardSlow: 320,
  emotionalFast: 350,
  emotional: 440,
  emotionalSlow: 550,
} as const;

export type DurationToken = keyof typeof duration;

/** Duration used for every animation when reduce-motion is enabled. */
export const REDUCED_MOTION_DURATION = 120;

export const easing = {
  /** Default for entering elements — decelerates into place. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Elements leaving the screen. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** Elements entering from off-screen. */
  enter: Easing.bezier(0, 0, 0.2, 1),
  /** Symmetric, for value changes such as a preview crossfade. */
  inOut: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

/**
 * Restrained spring for selection and press feedback. Low bounce on purpose —
 * excessive bouncing is explicitly out of scope for this product.
 */
export const spring = {
  gentle: { damping: 20, stiffness: 180, mass: 1 },
  responsive: { damping: 26, stiffness: 320, mass: 0.9 },
  /** Only for the publication/unlock moment. */
  celebratory: { damping: 16, stiffness: 150, mass: 1 },
} as const;

/** Delay between items in a staggered reveal (e.g. entitlement unlock). */
export const stagger = {
  tight: 30,
  standard: 45,
  loose: 70,
  /** Never stagger more than this many items — beyond it the wait reads as lag. */
  maxItems: 6,
} as const;

/** Press-state scale. Subtle by design; the shadow change carries most of it. */
export const pressScale = 0.98;
