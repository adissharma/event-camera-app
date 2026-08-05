import {
  buildDisposableRecipe,
  compose,
  contrast,
  exposure,
  saturation,
  warmth,
  type ColorMatrix4x5,
} from './disposable-recipe';

/** Applies a 4x5 matrix to a colour, the way the shader pipeline will. */
function apply(matrix: ColorMatrix4x5, rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb;
  return [
    matrix[0] * r + matrix[1] * g + matrix[2] * b + matrix[4],
    matrix[5] * r + matrix[6] * g + matrix[7] * b + matrix[9],
    matrix[10] * r + matrix[11] * g + matrix[12] * b + matrix[14],
  ];
}

const IDENTITY: ColorMatrix4x5 = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

describe('compose', () => {
  it('leaves a matrix unchanged when composed with the identity', () => {
    const m = contrast(1.2);
    expect(compose(IDENTITY, m)).toEqual(m);
    compose(m, IDENTITY).forEach((v, i) => expect(v).toBeCloseTo(m[i], 10));
  });

  it('composes in left-to-right order', () => {
    // Two exposure scalings should multiply.
    const combined = compose(exposure(2), exposure(3));
    const [r] = apply(combined, [0.1, 0.1, 0.1]);
    expect(r).toBeCloseTo(0.6, 10);
  });

  it('carries offsets through the second matrix linear part', () => {
    // contrast() offsets around mid-grey; scaling after it must scale the
    // offset too, or the composition silently shifts exposure.
    const combined = compose(contrast(2), exposure(0.5));
    const [r] = apply(combined, [0.5, 0.5, 0.5]);
    expect(r).toBeCloseTo(0.25, 10);
  });
});

describe('colour primitives', () => {
  it('pivots contrast around mid-grey', () => {
    const [r, g, b] = apply(contrast(1.4), [0.5, 0.5, 0.5]);
    expect(r).toBeCloseTo(0.5, 10);
    expect(g).toBeCloseTo(0.5, 10);
    expect(b).toBeCloseTo(0.5, 10);
  });

  it('leaves colour untouched at full saturation', () => {
    const [r, g, b] = apply(saturation(1), [0.2, 0.6, 0.9]);
    expect(r).toBeCloseTo(0.2, 10);
    expect(g).toBeCloseTo(0.6, 10);
    expect(b).toBeCloseTo(0.9, 10);
  });

  it('collapses to luminance at zero saturation', () => {
    const [r, g, b] = apply(saturation(0), [0.2, 0.6, 0.9]);
    const luma = 0.2126 * 0.2 + 0.7152 * 0.6 + 0.0722 * 0.9;
    expect(r).toBeCloseTo(luma, 10);
    expect(g).toBeCloseTo(luma, 10);
    expect(b).toBeCloseTo(luma, 10);
  });

  it('warms by raising red and lowering blue', () => {
    const [r, , b] = apply(warmth(0.06), [0.5, 0.5, 0.5]);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
  });
});

describe('buildDisposableRecipe', () => {
  it('is deterministic for a given seed', () => {
    expect(buildDisposableRecipe('media-item-a')).toEqual(buildDisposableRecipe('media-item-a'));
  });

  it('differs between photos', () => {
    const a = buildDisposableRecipe('media-item-a');
    const b = buildDisposableRecipe('media-item-b');
    expect(a).not.toEqual(b);
  });

  it('keeps every randomised value inside its tasteful range', () => {
    // Sweep enough seeds to exercise the ranges rather than one lucky draw.
    for (let i = 0; i < 300; i += 1) {
      const recipe = buildDisposableRecipe(`seed-${i}`);

      expect(recipe.grainIntensity).toBeGreaterThanOrEqual(0.05);
      expect(recipe.grainIntensity).toBeLessThan(0.09);

      expect(recipe.blurRadius).toBeGreaterThanOrEqual(0.3);
      expect(recipe.blurRadius).toBeLessThan(0.6);

      expect(recipe.vignette.opacity).toBeGreaterThanOrEqual(0.22);
      expect(recipe.vignette.opacity).toBeLessThan(0.4);
      expect(recipe.vignette.innerStop).toBeGreaterThanOrEqual(0.45);
      expect(recipe.vignette.innerStop).toBeLessThan(0.62);

      if (recipe.lightLeak) {
        expect(recipe.lightLeak.strength).toBeGreaterThanOrEqual(0.08);
        expect(recipe.lightLeak.strength).toBeLessThan(0.17);
        expect([0, 1, 2, 3]).toContain(recipe.lightLeak.corner);
      }

      if (recipe.dust) {
        expect([0, 1]).toContain(recipe.dust.variant);
        expect(recipe.dust.opacity).toBeLessThan(0.12);
      }

      if (recipe.scratches) {
        expect([0, 1]).toContain(recipe.scratches.variant);
        expect(recipe.scratches.opacity).toBeLessThan(0.1);
      }

      expect(recipe.colorMatrix).toHaveLength(20);
      expect(recipe.colorMatrix.every(Number.isFinite)).toBe(true);
    }
  });

  it('leaves most photos without a light leak, but not all', () => {
    const seeds = Array.from({ length: 300 }, (_, i) => `seed-${i}`);
    const withLeak = seeds.filter((s) => buildDisposableRecipe(s).lightLeak !== null).length;
    // Both branches must actually occur — a leak on every photo (or none)
    // is the failure this randomisation exists to avoid.
    expect(withLeak).toBeGreaterThan(30);
    expect(withLeak).toBeLessThan(270);
  });

  it('keeps mid-grey close to neutral, so the look never reads as orange', () => {
    for (let i = 0; i < 100; i += 1) {
      const { colorMatrix } = buildDisposableRecipe(`seed-${i}`);
      const [r, g, b] = apply(colorMatrix, [0.5, 0.5, 0.5]);
      // Warm, but only just: red should lead blue by a visible-yet-subtle margin.
      expect(r).toBeGreaterThan(b);
      expect(r - b).toBeLessThan(0.14);
      // And exposure shouldn't run away in either direction.
      expect(g).toBeGreaterThan(0.4);
      expect(g).toBeLessThan(0.68);
    }
  });
});
