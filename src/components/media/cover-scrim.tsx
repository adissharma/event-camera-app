import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colours } from '@/design';

/**
 * A single stop on the cover ramp, expressed against the page background.
 *
 * The last stop must match `colours.background` exactly — that is what removes
 * the visible edge where the photograph ends and the page begins.
 */
export function scrimStop(alpha: number): string {
  const hex = colours.background.replace('#', '');
  return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${alpha})`;
}

export const SCRIM_COLORS = [
  scrimStop(0),
  scrimStop(0),
  scrimStop(0.35),
  scrimStop(0.75),
  scrimStop(0.95),
  scrimStop(1),
] as readonly [string, string, ...string[]];

/**
 * The guest cover ramp: nothing across the top half, then an accelerating fall
 * to the background. Holding off that long is what keeps the cover reading as a
 * photograph rather than a darkened panel.
 */
export const SCRIM_LOCATIONS = [0, 0.42, 0.6, 0.75, 0.88, 1] as readonly [
  number,
  number,
  ...number[],
];

/**
 * The same ramp compressed for a half-height cover.
 *
 * A shorter block reaches the fold sooner, so the clear section is proportion-
 * ally longer and the fall steeper — otherwise the photograph starts dimming
 * almost immediately and loses its subject.
 */
export const SCRIM_LOCATIONS_HALF = [0, 0.5, 0.68, 0.82, 0.93, 1] as readonly [
  number,
  number,
  ...number[],
];

/**
 * Success screen ramp: pushes the transition even lower to keep the photograph
 * as the visual lead, with content emerging from the dark end.
 */
export const SCRIM_LOCATIONS_SUCCESS = [0, 0.65, 0.78, 0.88, 0.96, 1] as readonly [
  number,
  number,
  ...number[],
];

/** Fills its parent. The parent must be the element clipping the photograph. */
export function CoverScrim({
  locations = SCRIM_LOCATIONS,
}: {
  locations?: readonly [number, number, ...number[]];
}) {
  return (
    <LinearGradient
      colors={SCRIM_COLORS}
      locations={locations}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
