import { DISPOSABLE_PRESET } from './disposable-preset';
import { buildDisposableRecipe } from './disposable-recipe';
import { DISPOSABLE_SHADER_SOURCE } from './disposable-shader';
import {
  buildDisposableUniforms,
  resolveGrain,
  resolveSoftness,
  toShaderMatrix,
  toShaderOffset,
} from './disposable-uniforms';

/** Every `uniform <type> <name>;` the shader declares, except the image child. */
function declaredUniforms(): { name: string; floats: number }[] {
  const sizes: Record<string, number> = {
    float: 1,
    float2: 2,
    float3: 3,
    float4: 4,
    float3x3: 9,
    half: 1,
  };
  const pattern = /uniform\s+(\w+)\s+(\w+)\s*;/g;
  const found: { name: string; floats: number }[] = [];
  for (const match of DISPOSABLE_SHADER_SOURCE.matchAll(pattern)) {
    const [, type, name] = match;
    if (type === 'shader') continue;
    found.push({ name, floats: sizes[type] ?? Number.NaN });
  }
  return found;
}

const recipe = buildDisposableRecipe('uniform-test');
const options = { width: 1200, height: 900, devicePixelRatio: 1 };

describe('shader uniforms', () => {
  /*
   * `makeShaderWithChildren` takes a flat float array. Supply one value too
   * few and every uniform after it silently shifts by a slot, which does not
   * throw — it renders a plausible-looking wrong photograph. These two tests
   * are what stop the shader and the code that feeds it drifting apart.
   */
  it('supplies a value for every uniform the shader declares', () => {
    const supplied = buildDisposableUniforms(recipe, options);
    const missing = declaredUniforms()
      .map(({ name }) => name)
      .filter((name) => supplied[name] === undefined);
    expect(missing).toEqual([]);
  });

  it('supplies nothing the shader does not declare', () => {
    const declared = new Set(declaredUniforms().map(({ name }) => name));
    const extra = Object.keys(buildDisposableUniforms(recipe, options)).filter(
      (name) => !declared.has(name),
    );
    expect(extra).toEqual([]);
  });

  it('supplies the right number of floats for each uniform', () => {
    const supplied = buildDisposableUniforms(recipe, options);
    declaredUniforms().forEach(({ name, floats }) => {
      const value = supplied[name];
      const length = typeof value === 'number' ? 1 : value.length;
      expect(`${name}:${length}`).toBe(`${name}:${floats}`);
    });
  });

  it('produces only finite numbers, including when every layer is absent', () => {
    // The optional layers are null on a good fraction of photos, and NaN in a
    // uniform does not throw — it renders a black or transparent frame.
    const bare = buildDisposableRecipe('uniform-test');
    bare.dust = null;
    bare.scratches = null;
    bare.lightLeak = null;
    Object.values(buildDisposableUniforms(bare, options))
      .flatMap((value) => (typeof value === 'number' ? [value] : value))
      .forEach((value) => expect(Number.isFinite(value)).toBe(true));
  });
});

describe('colour matrix packing', () => {
  it('reads the 3x3 linear part in column-major order', () => {
    // Row-major 4x5 in; SkSL's float3x3 takes columns.
    const matrix = [
      1, 2, 3, 0, 0.1,
      4, 5, 6, 0, 0.2,
      7, 8, 9, 0, 0.3,
      0, 0, 0, 1, 0,
    ];
    expect(toShaderMatrix(matrix)).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
    expect(toShaderOffset(matrix)).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('resolution scaling', () => {
  it('keeps grain the same size relative to the frame as resolution grows', () => {
    // Both above the size at which the minimum-cell floor starts clamping
    // (grain.cells x grainMinCellPx, about 3000px today).
    const small = resolveGrain(recipe, 3200, 1);
    const large = resolveGrain(recipe, 4032, 1);
    // Cells across the long edge, not pixels per cell: the number of grains
    // spanning the photograph is what has to stay constant.
    expect(3200 / small.cellPx).toBeCloseTo(4032 / large.cellPx, 6);
    expect(4032 / large.cellPx).toBeCloseTo(recipe.grain.cells, 6);
  });

  it('starts clamping below the resolution that can carry full-detail grain', () => {
    // Worth stating explicitly, because it is the reason a gallery thumbnail
    // shows coarser grain than the saved file: below this size the frame
    // simply has not got the pixels to draw the full grain count.
    const threshold = recipe.grain.cells * DISPOSABLE_PRESET.render.grainMinCellPx;
    expect(4032 / resolveGrain(recipe, 4032, 1).cellPx).toBeCloseTo(recipe.grain.cells, 6);
    expect(1024 / resolveGrain(recipe, 1024, 1).cellPx).toBeLessThan(recipe.grain.cells);
    expect(threshold).toBeGreaterThan(1024);
  });

  it('floors the cell size so grain never falls below what the output resolves', () => {
    const tiny = resolveGrain(recipe, 120, 3);
    expect(tiny.cellPx * 3).toBeGreaterThanOrEqual(
      DISPOSABLE_PRESET.render.grainMinCellPx - 1e-9,
    );
  });

  it('eases grain amplitude down only when that floor bites', () => {
    const full = resolveGrain(recipe, 4032, 1);
    const thumbnail = resolveGrain(recipe, 120, 3);
    expect(full.intensity).toBeCloseTo(recipe.grain.intensity, 10);
    expect(thumbnail.intensity).toBeLessThan(recipe.grain.intensity);
    expect(thumbnail.intensity).toBeGreaterThan(0);
  });

  it('scales softness proportionally with the frame', () => {
    // The same fraction of the photograph at any size — which is what makes a
    // preview representative of the file that gets saved.
    expect(resolveSoftness(recipe, 4032) / 4032).toBeCloseTo(
      resolveSoftness(recipe, 800) / 800,
      10,
    );
  });
});

describe('compact surfaces', () => {
  it('switches off the layers too small to see, and nothing else', () => {
    const seeded = buildDisposableRecipe('has-every-layer');
    seeded.dust = { opacity: 0.2, density: 26, size: 2, darkRatio: 0.3, seed: 5 };
    seeded.scratches = { opacity: 0.03, width: 0.004, seed: 7 };
    seeded.lightLeak = {
      opacity: 0.05,
      spread: 0.4,
      colour: [1, 0.7, 0.4],
      origin: [1, 0.5],
      direction: [-1, 0],
      edge: 'right',
    };

    const full = buildDisposableUniforms(seeded, options);
    const compact = buildDisposableUniforms(seeded, { ...options, compact: true });

    expect(compact.uDustOpacity).toBe(0);
    expect(compact.uScratchOpacity).toBe(0);
    expect(compact.uLeakOpacity).toBe(0);

    // Tone, colour, grain and vignette are what make a thumbnail recognisable
    // as the same treatment, so they must survive.
    expect(compact.uContrast).toBe(full.uContrast);
    expect(compact.uGrainIntensity).toBe(full.uGrainIntensity);
    expect(compact.uVignetteStrength).toBe(full.uVignetteStrength);
    expect(compact.uColorMatrix).toEqual(full.uColorMatrix);
  });
});
