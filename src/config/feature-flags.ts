/**
 * Feature flags.
 *
 * The database schema supports every capability listed here today. These flags
 * control only what is EXPOSED in the interface, so that shipping a later phase
 * is a flag change plus UI, never a migration redesign.
 *
 * A flag that is `false` must hide the control or label it honestly as coming
 * later. It must never render a control that looks available and then fails.
 */

export const FEATURE_FLAGS = {
  /** Multiple functions (Mehndi, Sangeet, Reception…) per celebration. */
  multiEventCreation: false,
  /** Short guest video contributions. */
  videoContributions: false,
  /** Audio Guestbook recording. */
  audioGuestbook: false,
  /** Written guest messages. */
  writtenMessages: false,
  /** The organised final output combining photos, text, audio and video. */
  memoryBook: false,
  /** Native guest capture (the guest experience ships as web first). */
  nativeGuestCapture: false,
  /** Live slideshow projection at the venue. */
  liveSlideshow: false,
  /** Host approval queue before media appears in the gallery. */
  moderationQueue: true,
  /** Real in-app purchases. When false, the purchase abstraction runs in
   *  development mode and never contacts a billing service. */
  realPurchases: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
