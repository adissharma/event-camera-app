export const MOMENT_LIMIT_VALUES = [5, 10, 16, 24, 36, null] as const;
export type MomentLimit = (typeof MOMENT_LIMIT_VALUES)[number];

export function momentLimitIndex(value: MomentLimit | undefined): number {
  if (value === undefined || value === null) return MOMENT_LIMIT_VALUES.length - 1;
  const index = MOMENT_LIMIT_VALUES.indexOf(value);
  return index === -1 ? MOMENT_LIMIT_VALUES.length - 1 : index;
}

export function nearestMomentLimitIndex(progress: number): number {
  return Math.max(0, Math.min(MOMENT_LIMIT_VALUES.length - 1, Math.round(progress * (MOMENT_LIMIT_VALUES.length - 1))));
}
