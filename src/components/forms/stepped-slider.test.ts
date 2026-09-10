import {
  MOMENT_LIMIT_VALUES,
  momentLimitDotProgress,
  momentLimitIndex,
  momentLimitIndexAtDotProgress,
  nearestMomentLimitIndex,
} from './stepped-slider-values';

describe('stepped moments slider', () => {
  it('uses exactly the supported limits, with null for unlimited', () => {
    expect(MOMENT_LIMIT_VALUES).toEqual([5, 10, 16, 24, 36, null]);
  });

  it('defaults an unset value to the unlimited endpoint', () => {
    expect(momentLimitIndex(undefined)).toBe(5);
    expect(momentLimitIndex(null)).toBe(5);
  });

  it('maps every stored finite limit to its stop', () => {
    expect(MOMENT_LIMIT_VALUES.slice(0, -1).map(momentLimitIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('snaps a track position to the nearest valid stop', () => {
    expect(nearestMomentLimitIndex(0)).toBe(0);
    expect(nearestMomentLimitIndex(0.29)).toBe(1);
    expect(nearestMomentLimitIndex(0.5)).toBe(3);
    expect(nearestMomentLimitIndex(1)).toBe(5);
  });

  it('holds the active value until the fill crosses the next dot', () => {
    const secondDot = momentLimitDotProgress(1);
    expect(momentLimitIndexAtDotProgress(secondDot - 0.001, 0)).toBe(0);
    expect(momentLimitIndexAtDotProgress(secondDot, 0)).toBe(1);
  });

  it('changes down only after the fill reaches the current dot', () => {
    const unlimitedDot = momentLimitDotProgress(5);
    expect(momentLimitIndexAtDotProgress(unlimitedDot + 0.001, 5)).toBe(5);
    expect(momentLimitIndexAtDotProgress(unlimitedDot, 5)).toBe(4);
  });
});
