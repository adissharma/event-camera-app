import { DISPOSABLE_PRESET } from './disposable-preset';
import type { ColorMatrix4x5, DisposableRecipe } from './disposable-recipe';

/**
 * Turns a resolution-independent recipe into the exact uniform values the
 * shader takes at one particular output size.
 *
 * Deliberately free of Skia, and separate from `disposable-paint.ts`, because
 * this is where all the resolution reasoning lives — how large a grain cell
 * should be, how far the softening reaches, which layers a surface is too
 * small to bother drawing — and that is arithmetic worth testing on its own,
 * without a GPU. `disposable-paint.ts` is then only the binding.
 */

export interface DisposableUniformOptions {
  /** Destination rect, in the coordinate space the paint will be drawn into. */
  width: number;
  height: number;
  /**
   * Local units to device pixels: `PixelRatio.get()` for an on-screen canvas
   * measured in points, `1` for an offscreen surface already measured in
   * pixels. Only the grain's minimum-cell floor needs it — everything else is
   * either frame-relative or already in local units.
   */
  devicePixelRatio: number;
  /**
   * Skips dust, scratches and leaks. For grid cells and chips, where they are
   * invisible at that size and not worth the fill rate. Tone, colour, grain
   * and vignette still apply, so a thumbnail still previews the look.
   */
  compact?: boolean;
}

export type UniformValues = Record<string, number | number[]>;

/**
 * The linear 3x3 part of a 4x5 colour matrix, in the column-major order SkSL's
 * `float3x3` expects.
 */
export function toShaderMatrix(matrix: ColorMatrix4x5): number[] {
  const columnMajor: number[] = [];
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      columnMajor.push(matrix[row * 5 + column]);
    }
  }
  return columnMajor;
}

/** The offset column of a 4x5 colour matrix, as RGB. */
export function toShaderOffset(matrix: ColorMatrix4x5): number[] {
  return [matrix[4], matrix[9], matrix[14]];
}

/** Grain cell size and amplitude for one output size. Exported for testing. */
export function resolveGrain(recipe: DisposableRecipe, longEdge: number, devicePixelRatio: number) {
  // Frame-relative grain, floored at a cell size the output can resolve.
  const maxCells = (longEdge * devicePixelRatio) / DISPOSABLE_PRESET.render.grainMinCellPx;
  const cells = Math.max(1, Math.min(recipe.grain.cells, maxCells));

  // When that floor bites — a grid thumbnail can only resolve a fraction of
  // the grain a full-resolution export can — the grain that remains is coarse
  // *relative to the frame*, and coarse grain at full strength is the one
  // thing the look must not become. Easing the amplitude down with the
  // shortfall keeps a thumbnail reading as the same photograph rather than a
  // noisier one. The exponent is gentle on purpose, and at full resolution
  // this is exactly 1, so an export is never quietly softened.
  const resolvedFraction = Math.min(1, cells / recipe.grain.cells);

  return {
    cellPx: longEdge / cells,
    intensity: recipe.grain.intensity * Math.pow(resolvedFraction, 0.35),
  };
}

/**
 * Softening radius in local units.
 *
 * Specified in pixels at a reference long edge and scaled linearly, so it is
 * proportionally identical at every output size rather than vanishing on a
 * 4000px export and dominating a thumbnail. The device pixel ratio cancels
 * out: a radius that is a fixed fraction of the frame is a fixed fraction of
 * the frame however many pixels the frame happens to have.
 */
export function resolveSoftness(recipe: DisposableRecipe, longEdge: number): number {
  return (recipe.softness.blurPx * longEdge) / recipe.softness.referenceLongEdge;
}

export function buildDisposableUniforms(
  recipe: DisposableRecipe,
  { width, height, devicePixelRatio, compact = false }: DisposableUniformOptions,
): UniformValues {
  const longEdge = Math.max(width, height);
  const grain = resolveGrain(recipe, longEdge, devicePixelRatio);

  const dust = compact ? null : recipe.dust;
  const scratches = compact ? null : recipe.scratches;
  const leak = compact ? null : recipe.lightLeak;

  return {
    uResolution: [width, height],
    uAspect: height > 0 ? width / height : 1,
    uSoftness: resolveSoftness(recipe, longEdge),

    uColorMatrix: toShaderMatrix(recipe.colorMatrix),
    uColorOffset: toShaderOffset(recipe.colorMatrix),

    uExposure: recipe.tone.exposure,
    uContrast: recipe.tone.contrast,
    uHighlights: recipe.tone.highlights,
    uShadows: recipe.tone.shadows,
    uBlacks: recipe.tone.blacks,
    uWhites: recipe.tone.whites,

    uWarmHighlights: recipe.colour.warmHighlights,
    uCoolShadows: recipe.colour.coolShadows,
    uBlueDensity: recipe.colour.blueDensity,
    uGreenControl: recipe.colour.greenControl,

    uGrainIntensity: grain.intensity,
    uGrainCellPx: grain.cellPx,
    uGrainContrast: recipe.grain.contrast,
    uGrainShadowBias: recipe.grain.shadowBias,
    uGrainSeed: recipe.grain.seed,

    uVignetteStrength: recipe.vignette.strength,
    uVignetteRadius: recipe.vignette.radius,
    uVignetteSoftness: recipe.vignette.softness,

    // A zero opacity is what switches each of these off in the shader, so the
    // values beside them only have to be finite, never meaningful.
    uDustOpacity: dust?.opacity ?? 0,
    uDustDensity: dust?.density ?? 1,
    uDustSize: dust?.size ?? 1,
    uDustDarkRatio: dust?.darkRatio ?? 0,
    uDustSeed: dust?.seed ?? 0,

    uScratchOpacity: scratches?.opacity ?? 0,
    uScratchWidth: scratches?.width ?? 0.004,
    uScratchSeed: scratches?.seed ?? 0,

    uLeakOpacity: leak?.opacity ?? 0,
    uLeakSpread: leak?.spread ?? 0.4,
    uLeakColour: leak?.colour ?? [0, 0, 0],
    uLeakOrigin: leak?.origin ?? [0, 0],
    uLeakDirection: leak?.direction ?? [1, 0],
  };
}
