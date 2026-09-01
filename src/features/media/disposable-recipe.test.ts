import { DISPOSABLE_PRESET } from './disposable-preset';
import {
  buildDisposableRecipe,
  channelMixer,
  compose,
  saturation,
  temperature,
  tint,
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
    const m = saturation(1.2);
    expect(compose(IDENTITY, m)).toEqual(m);
    compose(m, IDENTITY).forEach((v, i) => expect(v).toBeCloseTo(m[i], 10));
  });

  it('composes in left-to-right order', () => {
    const combined = compose(temperature(0.1), temperature(0.1));
    const [r] = apply(combined, [0.5, 0.5, 0.5]);
    expect(r).toBeCloseTo(0.5 * 1.09 * 1.09, 10);
  });
});

describe('colour primitives', () => {
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
    const [r, , b] = apply(temperature(0.06), [0.5, 0.5, 0.5]);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
  });

  it('shifts toward magenta on a positive tint', () => {
    const [r, g, b] = apply(tint(0.1), [0.5, 0.5, 0.5]);
    expect(g).toBeLessThan(0.5);
    expect(r).toBeGreaterThan(g);
    expect(b).toBeGreaterThan(g);
  });

  it('leaves neutrals alone in the channel mixer', () => {
    // The whole reason this is a mixer rather than a per-channel gain: it must
    // enrich a blue sky without tinting every grey in the frame.
    const mixer = channelMixer(0.3, -0.2);
    const [r, g, b] = apply(mixer, [0.5, 0.5, 0.5]);
    expect(r).toBeCloseTo(0.5, 10);
    expect(g).toBeCloseTo(0.5, 10);
    expect(b).toBeCloseTo(0.5, 10);
  });

  it('enriches a colour the channel mixer is pointed at', () => {
    const [, , b] = apply(channelMixer(0.3, 0), [0.2, 0.35, 0.8]);
    expect(b).toBeGreaterThan(0.8);
  });
});

describe('buildDisposableRecipe', () => {
  it('is deterministic for a given seed', () => {
    expect(buildDisposableRecipe('media-item-a')).toEqual(buildDisposableRecipe('media-item-a'));
  });

  it('differs between photos', () => {
    expect(buildDisposableRecipe('media-item-a')).not.toEqual(
      buildDisposableRecipe('media-item-b'),
    );
  });

  it('keeps every randomised value inside the preset range it came from', () => {
    const within = (value: number, { base, vary }: { base: number; vary: number }) => {
      const low = base * (1 - vary);
      const high = base * (1 + vary);
      // Tiny epsilon: these are floating-point products of the same numbers.
      expect(value).toBeGreaterThanOrEqual(Math.min(low, high) - 1e-9);
      expect(value).toBeLessThanOrEqual(Math.max(low, high) + 1e-9);
    };

    // Enough seeds to exercise the ranges rather than one lucky draw.
    for (let i = 0; i < 500; i += 1) {
      const recipe = buildDisposableRecipe(`seed-${i}`);

      within(recipe.grain.intensity, DISPOSABLE_PRESET.grain.intensity);
      within(recipe.vignette.strength, DISPOSABLE_PRESET.vignette.strength);
      within(recipe.vignette.radius, DISPOSABLE_PRESET.vignette.radius);

      if (recipe.dust) {
        within(recipe.dust.opacity, DISPOSABLE_PRESET.dust.opacity);
        within(recipe.dust.density, DISPOSABLE_PRESET.dust.density);
        within(recipe.dust.size, DISPOSABLE_PRESET.dust.size);
      }
      if (recipe.scratches) {
        within(recipe.scratches.opacity, DISPOSABLE_PRESET.scratches.opacity);
        within(recipe.scratches.width, DISPOSABLE_PRESET.scratches.width);
      }
      if (recipe.lightLeak) {
        within(recipe.lightLeak.opacity, DISPOSABLE_PRESET.lightLeak.opacity);
        within(recipe.lightLeak.spread, DISPOSABLE_PRESET.lightLeak.spread);
        // The leak slides along its own edge, so the origin has to stay on the
        // frame or the leak enters from somewhere that is not an edge at all.
        recipe.lightLeak.origin.forEach((component) => {
          expect(component).toBeGreaterThanOrEqual(-0.3);
          expect(component).toBeLessThanOrEqual(1.3);
        });
      }

      expect(recipe.colorMatrix).toHaveLength(20);
      expect(recipe.colorMatrix.every(Number.isFinite)).toBe(true);
    }
  });

  it('fires each optional layer at roughly its configured frequency', () => {
    const total = 4000;
    const seeds = Array.from({ length: total }, (_, i) => `seed-${i}`);
    // Not point-free: `map` passes the index as a second argument, which
    // would land in `buildDisposableRecipe`'s optional `preset` parameter.
    const recipes = seeds.map((seed) => buildDisposableRecipe(seed));

    const rate = (predicate: (r: (typeof recipes)[number]) => boolean) =>
      recipes.filter(predicate).length / total;

    // Generous bands: this is asserting "the dice are the dice we asked for",
    // not a precise proportion.
    expect(rate((r) => r.lightLeak !== null)).toBeCloseTo(
      DISPOSABLE_PRESET.lightLeak.probability,
      1,
    );
    expect(rate((r) => r.dust !== null)).toBeCloseTo(DISPOSABLE_PRESET.dust.probability, 1);
    expect(rate((r) => r.scratches !== null)).toBeLessThan(0.15);
  });

  it('spreads light leaks over every configured edge', () => {
    const edges = new Set(
      Array.from({ length: 2000 }, (_, i) => buildDisposableRecipe(`seed-${i}`).lightLeak?.edge)
        .filter(Boolean),
    );
    expect(edges.size).toBe(DISPOSABLE_PRESET.lightLeak.edges.length);
  });

  it('keeps mid-grey close to neutral, so the look never reads as orange', () => {
    for (let i = 0; i < 100; i += 1) {
      const [r, g, b] = apply(buildDisposableRecipe(`seed-${i}`).colorMatrix, [0.5, 0.5, 0.5]);
      // Warm, but only just: red should lead blue by a visible-yet-subtle margin.
      expect(r).toBeGreaterThan(b);
      expect(r - b).toBeLessThan(0.1);
      // And the matrix should not be shifting exposure — that is the tone
      // curve's job, in the shader.
      expect(g).toBeGreaterThan(0.45);
      expect(g).toBeLessThan(0.55);
    }
  });
});
