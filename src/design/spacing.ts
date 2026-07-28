/**
 * Spacing, radii and layout constants.
 *
 * A 4pt base grid. Screen gutters are deliberately generous (20pt) so that a
 * single decision can own the screen — see `docs/form-patterns.md`.
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
  giant: 72,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  /** Device frame corner radius used by the guest preview. */
  device: 44,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;

export const layout = {
  /** Horizontal screen gutter. */
  gutter: spacing.lg,
  /**
   * Minimum interactive target. 48pt exceeds both the iOS 44pt and Android 48dp
   * guidance, which keeps one-handed use comfortable in the creation flow.
   */
  minTouchTarget: 48,
  /** Height of the sticky bottom action bar, excluding safe-area inset. */
  stickyActionHeight: 88,
  /** Maximum readable measure for body copy. */
  maxReadableWidth: 560,
  /** Hairline that survives on both platforms. */
  hairline: 1,
} as const;
