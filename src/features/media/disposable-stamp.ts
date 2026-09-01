import { BlendMode, Skia, TileMode, type SkCanvas, type SkPaint, type SkPath } from '@shopify/react-native-skia';

import { layoutDateStamp, STAMP_METRICS, type StampGlyph } from './disposable-date-stamp';
import type { DisposableDateStamp } from './disposable-preset';

/**
 * Draws the date imprint onto a frame.
 *
 * Three passes, which is what turns a shape into a light source: a wide faint
 * halo that bleeds into the image, a tight bloom hugging the digits, and the
 * digits themselves — all slightly blurred, because the thing being imitated is
 * an LED exposing emulsion through a gate, and that has no hard edge anywhere
 * in it.
 *
 * The two halo passes composite additively. A date back *adds* light to the
 * film; it cannot subtract any, so an additive halo is not a stylistic choice
 * but the actual behaviour, and it is why the glow reads as coming from inside
 * the photograph rather than sitting on top of it. The core is drawn normally
 * so the digits stay legible over a bright sky, where a purely additive stamp
 * would wash out to nothing.
 *
 * Native-only; `disposable-stamp.web.ts` stands in on web.
 */

export interface DateStampOptions {
  /** The frame, in the coordinate space being drawn into. */
  width: number;
  height: number;
  text: string;
  style: DisposableDateStamp;
  /** Stable per-photo value, so the unevenness does not shimmer between renders. */
  seed: number;
}

/** mulberry32, matching `disposable-recipe.ts` — small and deterministic. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glyphPath(glyph: StampGlyph, originX: number, originY: number, scale: number): SkPath {
  const path = Skia.Path.Make();
  for (const polygon of glyph.polygons) {
    for (let i = 0; i < polygon.length; i += 2) {
      const x = originX + (glyph.x + polygon[i]) * scale;
      const y = originY + polygon[i + 1] * scale;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.close();
  }
  return path;
}

function blurred(colour: string, sigma: number, alpha: number, blend: BlendMode): SkPaint {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(colour));
  paint.setAlphaf(alpha);
  paint.setBlendMode(blend);
  paint.setAntiAlias(true);
  if (sigma > 0.01) {
    // `Decal` so the halo fades to nothing past its radius instead of
    // smearing the edge colour outward across the frame.
    paint.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal));
  }
  return paint;
}

export function drawDisposableDateStamp(canvas: SkCanvas, options: DateStampOptions): void {
  const { width, height, text, style, seed } = options;
  if (width <= 0 || height <= 0 || !text) return;

  // Sized against the short edge so a portrait and a landscape frame get the
  // same stamp, rather than one twice the size of the other.
  const digitHeight = Math.min(width, height) * style.size;
  if (digitHeight < 1) return;

  const layout = layoutDateStamp(text, STAMP_METRICS);
  if (!layout.glyphs.length) return;

  const stampWidth = layout.width * digitHeight;
  const originX = width - width * style.marginX - stampWidth;
  const originY = height - height * style.marginY - digitHeight;

  const random = createRandom(seed >>> 0 || 1);

  const passes = [
    { colour: style.glow, sigma: style.bleedRadius, alpha: style.bleedOpacity, blend: BlendMode.Plus },
    { colour: style.glow, sigma: style.bloomRadius, alpha: style.bloomOpacity, blend: BlendMode.Plus },
    { colour: style.core, sigma: style.softness, alpha: style.opacity, blend: BlendMode.SrcOver },
  ];

  for (const glyph of layout.glyphs) {
    // One draw of unevenness per glyph, shared across its three passes, so a
    // dim digit is dim in its halo too — which is how a weak segment actually
    // behaves. Varying them independently would just look like noise.
    const brightness = 1 - style.unevenness * random();
    const path = glyphPath(glyph, originX, originY, digitHeight);

    for (const pass of passes) {
      canvas.drawPath(
        path,
        blurred(pass.colour, pass.sigma * digitHeight, pass.alpha * brightness, pass.blend),
      );
    }
  }
}
