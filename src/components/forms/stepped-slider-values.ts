export const MOMENT_LIMIT_VALUES = [5, 10, 16, 24, 36, null] as const;
export type MomentLimit = (typeof MOMENT_LIMIT_VALUES)[number];
export const MOMENT_LIMIT_DOT_INSET = 0.07;

export function momentLimitIndex(value: MomentLimit | undefined): number {
  if (value === undefined || value === null) return MOMENT_LIMIT_VALUES.length - 1;
  const index = MOMENT_LIMIT_VALUES.indexOf(value);
  return index === -1 ? MOMENT_LIMIT_VALUES.length - 1 : index;
}

export function nearestMomentLimitIndex(progress: number): number {
  'worklet';
  return Math.max(0, Math.min(MOMENT_LIMIT_VALUES.length - 1, Math.round(progress * (MOMENT_LIMIT_VALUES.length - 1))));
}

/** Physical track position of a value's dot, from 0 to 1. */
export function momentLimitDotProgress(index: number): number {
  'worklet';
  const stepCount = MOMENT_LIMIT_VALUES.length - 1;
  return MOMENT_LIMIT_DOT_INSET + (index / stepCount) * (1 - MOMENT_LIMIT_DOT_INSET * 2);
}

/** Converts a physical track coordinate to its nearest supported value. */
export function momentLimitIndexForTrackPosition(x: number, trackWidth: number): number {
  'worklet';
  if (trackWidth <= 0) return 0;

  const progress = Math.max(0, Math.min(1, x / trackWidth));
  return nearestMomentLimitIndex(
    (progress - momentLimitDotProgress(0))
      / (momentLimitDotProgress(MOMENT_LIMIT_VALUES.length - 1) - momentLimitDotProgress(0)),
  );
}

/**
 * Selects only after the fill itself reaches a dot. This deliberately differs
 * from `nearestMomentLimitIndex`, which remains responsible for the slider's
 * generous snap regions on release.
 */
export function momentLimitIndexAtDotProgress(
  progress: number,
  activeIndex: number,
  dotRadiusProgress = 0,
): number {
  'worklet';
  const stepCount = MOMENT_LIMIT_VALUES.length - 1;
  let nextIndex = activeIndex;

  if (nextIndex < stepCount && progress >= momentLimitDotProgress(nextIndex + 1) - dotRadiusProgress) {
    while (nextIndex < stepCount && progress >= momentLimitDotProgress(nextIndex + 1) - dotRadiusProgress) {
      nextIndex += 1;
    }
  } else if (nextIndex > 0 && progress <= momentLimitDotProgress(nextIndex) + dotRadiusProgress) {
    while (nextIndex > 0 && progress <= momentLimitDotProgress(nextIndex) + dotRadiusProgress) {
      nextIndex -= 1;
    }
  }

  return nextIndex;
}
