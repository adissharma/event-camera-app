import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkPicture,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';

import { DISPOSABLE_PRESET, type DisposableDateStamp } from './disposable-preset';
import type { DisposableRecipe } from './disposable-recipe';
import { drawDisposableDateStamp } from './disposable-stamp';
import { DISPOSABLE_SHADER_SOURCE } from './disposable-shader';
import {
  buildDisposableUniforms,
  type DisposableUniformOptions,
} from './disposable-uniforms';

/**
 * Turns a recipe into the one Skia paint that draws the Disposable look.
 *
 * This is the join between the preview and the export. Both call
 * `buildDisposablePaint` and both draw the resulting paint over a rect — the
 * on-screen canvas at whatever size the layout gives it, the offscreen surface
 * at the photo's native resolution. Because it is literally the same paint,
 * built from the same recipe, there is no second implementation to drift: a
 * change to the preset or the shader moves both at once, and an exported file
 * cannot come back looking different from what the host was shown.
 *
 * What this module owns is the Skia binding: compiling the shader, fitting the
 * source image into the destination rect, and packing uniforms. The arithmetic
 * that decides *what* those uniforms should be at a given output size lives in
 * `disposable-uniforms.ts`, which has no Skia dependency and is tested on its
 * own.
 *
 * Native-only. `disposable-paint.web.ts` stands in on web, where Skia is not
 * bootstrapped — see the note in `disposable-photo.web.tsx`.
 */

/** Compiled lazily so merely importing this module costs nothing. */
let cachedEffect: SkRuntimeEffect | null = null;

function getEffect(): SkRuntimeEffect {
  if (!cachedEffect) {
    const effect = Skia.RuntimeEffect.Make(DISPOSABLE_SHADER_SOURCE);
    if (!effect) {
      throw new Error('Disposable filter: shader failed to compile.');
    }
    cachedEffect = effect;
  }
  return cachedEffect;
}

type UniformValue = number | readonly number[];

/**
 * Packs named values into the flat float array `makeShaderWithChildren` wants.
 *
 * By name via the effect's own reflection, rather than by writing the array out
 * in declaration order: a flat literal silently mis-assigns every uniform after
 * the one you forget, and the result is a plausible-looking wrong photo rather
 * than an error. This throws instead.
 */
function packUniforms(effect: SkRuntimeEffect, values: Record<string, UniformValue>): number[] {
  const packed = new Array<number>(effect.getUniformFloatCount()).fill(0);
  const count = effect.getUniformCount();

  for (let index = 0; index < count; index += 1) {
    const name = effect.getUniformName(index);
    const uniform = effect.getUniform(index);
    const value = values[name];
    if (value === undefined) {
      throw new Error(`Disposable filter: no value supplied for uniform "${name}".`);
    }
    const floats = typeof value === 'number' ? [value] : value;
    const expected = uniform.rows * uniform.columns;
    if (floats.length !== expected) {
      throw new Error(
        `Disposable filter: uniform "${name}" expects ${expected} floats, got ${floats.length}.`,
      );
    }
    for (let slot = 0; slot < expected; slot += 1) {
      packed[uniform.slot + slot] = floats[slot];
    }
  }

  return packed;
}

export interface DisposablePaintOptions extends DisposableUniformOptions {
  /** How the source image is fitted into the destination rect. */
  fit?: 'cover' | 'contain';
  /**
   * The date imprint. Omitted when the event has the stamp switched off, or on
   * surfaces too small to show it.
   *
   * `style` is passed in rather than read from the preset inside, so a caller
   * can render a variant without mutating the module — which is what lets the
   * tuner preview stamp changes live.
   */
  dateStamp?: { text: string; style?: DisposableDateStamp };
}

export interface DisposablePaint {
  paint: SkPaint;
  /** What the shader was told the frame is, for callers that draw on top. */
  width: number;
  height: number;
}

export function buildDisposablePaint(
  image: SkImage,
  recipe: DisposableRecipe,
  options: DisposablePaintOptions,
): DisposablePaint {
  const { width, height, devicePixelRatio, fit = 'cover', compact = false } = options;
  const effect = getEffect();

  const imageWidth = image.width();
  const imageHeight = image.height();

  // Fit the source into the destination rect. Aspect ratio is preserved in
  // both modes — the filter never crops or stretches a photo on its own.
  const scale =
    fit === 'contain'
      ? Math.min(width / imageWidth, height / imageHeight)
      : Math.max(width / imageWidth, height / imageHeight);
  const drawnWidth = imageWidth * scale;
  const drawnHeight = imageHeight * scale;

  const localMatrix = Skia.Matrix();
  localMatrix.translate((width - drawnWidth) / 2, (height - drawnHeight) / 2);
  localMatrix.scale(scale, scale);

  // `Clamp` rather than `Decal` so the softening kernel's outermost taps read
  // the edge pixel instead of transparent black, which would draw a dark
  // hairline around every photo. Mipmaps because a gallery cell can be a
  // twentieth of the source's width, and plain bilinear minification at that
  // ratio aliases badly.
  const imageShader = image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.Linear,
    localMatrix,
  );

  const uniforms = packUniforms(
    effect,
    buildDisposableUniforms(recipe, { width, height, devicePixelRatio, compact }),
  );

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(effect.makeShaderWithChildren(uniforms, [imageShader]));

  return { paint, width, height };
}

/**
 * Draws a built paint over its own frame.
 *
 * One line, but deliberately shared: the on-screen preview and the
 * full-resolution export both go through it, so "how the look is drawn" has a
 * single definition rather than two that agree today.
 */
export function drawDisposable(canvas: SkCanvas, painted: DisposablePaint): void {
  canvas.drawRect(Skia.XYWHRect(0, 0, painted.width, painted.height), painted.paint);
}

/**
 * Records the whole effect into a picture, for the declarative canvas.
 *
 * React Native Skia's JSX components take their paint from `<Paint>` child
 * elements, and there is no prop that accepts a prebuilt `SkPaint` for a fill.
 * Recording the same imperative `drawRect` the exporter performs, and playing
 * it back through `<Picture>`, is what keeps the preview from needing a second,
 * declarative expression of the pipeline that could drift from this one.
 */
export function recordDisposablePicture(
  image: SkImage,
  recipe: DisposableRecipe,
  options: DisposablePaintOptions,
): SkPicture {
  const painted = buildDisposablePaint(image, recipe, options);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(0, 0, painted.width, painted.height),
  );
  drawDisposable(canvas, painted);
  if (options.dateStamp) {
    drawDisposableDateStamp(canvas, {
      width: painted.width,
      height: painted.height,
      text: options.dateStamp.text,
      style: options.dateStamp.style ?? DISPOSABLE_PRESET.dateStamp,
      seed: recipe.grain.seed,
    });
  }
  return recorder.finishRecordingAsPicture();
}
