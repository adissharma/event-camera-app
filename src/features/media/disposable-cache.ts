import { Image as RNImage } from 'react-native';
import { Skia, type SkImage } from '@shopify/react-native-skia';

import { buildDisposablePaint, drawDisposable } from './disposable-paint';
import { DISPOSABLE_PRESET } from './disposable-preset';
import type { DisposableRecipe } from './disposable-recipe';
import { drawDisposableDateStamp } from './disposable-stamp';
import { needsTranscodeForSkia } from './image-orientation';
import { LruCache } from './lru-cache';

/**
 * Shared caches that keep decoding and filtering off the navigation path.
 *
 * Two separate problems, two caches:
 *
 * **Decoded source images.** `useImage` from react-native-skia holds no cache
 * at all — every mount runs `Skia.Data.fromURI` and decodes from scratch. A
 * gallery of twenty photos therefore decodes each original twenty times over,
 * and tapping one decodes it a twenty-first time *during the open animation*,
 * because the hero viewer is a separate component from the grid cell it grew
 * out of. `original` and `black_and_white` never pay this: they render through
 * React Native's `<Image>`, which has a process-wide bitmap cache, so by the
 * time you tap a thumbnail the full-size bitmap is usually already resident.
 * This cache gives Skia the same property.
 *
 * **Rasterised results.** A `<Picture>` re-runs the whole shader — grain,
 * dust, vignette, the nine softening taps, the stamp's blurred paths — over
 * every pixel, every time the canvas redraws. The hero transition animates the
 * container's width and height, so the canvas redraws on every frame of it.
 * Measured against a blit of an already-rendered image, replaying the picture
 * costs two orders of magnitude more per frame. So the picture is rasterised
 * once, into an image, and the animation blits that instead.
 *
 * Neither cache destroys what it evicts — see `LruCache` for why that matters
 * when a component may still be drawing an evicted image.
 *
 * Native-only; `disposable-cache.web.ts` stands in on web.
 */

/** Bytes per pixel of an RGBA surface, for weighing cache entries. */
const BYTES_PER_PIXEL = 4;

/**
 * The most pixels per point a *preview* is ever rendered at.
 *
 * Modern phones report a device pixel ratio of 3, so a full-screen viewer at
 * native density is about 2.7 megapixels of shader — grain, dust, vignette,
 * nine softening taps and the stamp's blurred paths, all evaluated per pixel.
 * At 2x that is 1.2 megapixels, 55% less work, for a difference no one can see
 * on a photograph: the filter's own softening pass is wider than the pixel
 * grid it would be resolving.
 *
 * This ceiling applies only to what is drawn on screen. Export and download
 * run through `disposable-render.ts`, which never consults this and still
 * renders at the source's own resolution.
 */
const MAX_PREVIEW_PIXEL_RATIO = 2;

/**
 * Roughly two full-resolution 12MP originals. Deliberately modest: the point
 * is to stop the *same* photo being decoded repeatedly as it moves between
 * grid and viewer, not to hold a whole gallery resident.
 */
const SOURCE_BUDGET_BYTES = 96 * 1024 * 1024;

/**
 * Around six full-screen renders. Enough that opening a photo, closing it, and
 * opening it again is free, and that swiping back through the last few photos
 * is too.
 */
const RENDER_BUDGET_BYTES = 64 * 1024 * 1024;

const sourceImages = new LruCache<string, SkImage>(SOURCE_BUDGET_BYTES);
const renderedImages = new LruCache<string, SkImage>(RENDER_BUDGET_BYTES);

/** In-flight decodes, so N components mounting at once share one fetch. */
const pendingSources = new Map<string, Promise<SkImage | null>>();

function weigh(image: SkImage): number {
  return image.width() * image.height() * BYTES_PER_PIXEL;
}

/**
 * The decoded image for a URI if it is already resident.
 *
 * Synchronous on purpose: a component can call this during its first render
 * and, on a hit, build its picture in that same render rather than waiting a
 * tick for an effect. That is the difference between a photo that is filtered
 * on the first frame of the open animation and one that pops in partway
 * through it.
 */
export function peekSourceImage(uri: string): SkImage | null {
  return sourceImages.peek(uri) ?? null;
}

/** Decodes a source image, reusing an in-flight decode for the same URI. */
export function loadSourceImage(source: string | number): Promise<SkImage | null> {
  const key = String(source);

  const cached = sourceImages.get(key);
  if (cached) return Promise.resolve(cached);

  const inFlight = pendingSources.get(key);
  if (inFlight) return inFlight;

  // A bundled asset arrives as a module id, not a URL — `require(...)` of a
  // PNG. It has to be resolved to a real URI first, which is exactly what
  // react-native-skia's own `useImage` does internally before loading. Missing
  // this is why every preset photo rendered unfiltered: the load resolved to
  // `null`, so there was no image to build a picture from at all.
  const uri = typeof source === 'number' ? RNImage.resolveAssetSource(source)?.uri : source;

  const request = decode(uri)
    .then((image) => {
      if (image) sourceImages.set(key, image, weigh(image));
      return image;
    })
    .catch(() => null)
    .finally(() => {
      pendingSources.delete(key);
    });

  pendingSources.set(key, request);
  return request;
}


/**
 * Decodes an image for Skia, transcoding first when Skia cannot read the
 * format itself.
 *
 * **Skia has no HEIC decoder**, and every photo an iPhone takes is HEIC by
 * default. `MakeImageFromEncoded` simply returns `null` for one — no error,
 * no warning. That null was the whole bug: with no image there was nothing to
 * filter, so the untreated `<Image>` kept underneath as a loading fallback
 * showed through instead. React Native's `<Image>` renders HEIC fine via the
 * platform decoder, so the photo looked completely normal — just never
 * filtered. Nothing anywhere reported a failure.
 *
 * The exporter already knew this (see `decodeUpright` in
 * `disposable-render.ts`, which is why *saved* photos always came out
 * filtered even when the preview did not) and routes around it the same way:
 * `expo-image-manipulator` decodes with the platform's own codecs and writes
 * the pixels back out as JPEG, which Skia does read. It also bakes in the EXIF
 * orientation, so a photo taken sideways lands upright rather than rotated.
 *
 * The transcode is a fallback rather than the default: it costs a decode and
 * a re-encode, and the common cases (JPEG and PNG) never need it. It runs
 * when the URI or its extension says HEIC, and also whenever a direct decode
 * comes back empty — covering a HEIC file served from a URL that does not
 * admit to being one, which is exactly what a signed storage URL looks like.
 */
async function decode(uri: string | undefined): Promise<SkImage | null> {
  if (!uri) return null;

  if (!needsTranscodeForSkia(uri)) {
    try {
      const data = await Skia.Data.fromURI(uri);
      const image = data ? Skia.Image.MakeImageFromEncoded(data) : null;
      if (image) return image;
    } catch (error) {
      warn('direct decode threw', uri, error);
    }
    // Fell through: worth one attempt through the platform decoder before
    // giving up, since the URI may not reveal the real format.
  }

  try {
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const normalised = await manipulateAsync(uri, [], { compress: 1, format: SaveFormat.JPEG });
    const data = await Skia.Data.fromURI(normalised.uri);
    const image = data ? Skia.Image.MakeImageFromEncoded(data) : null;
    if (!image) warn('transcode produced no image', uri);
    return image;
  } catch (error) {
    warn('transcode threw', uri, error);
    return null;
  }
}

/**
 * A decode that fails silently is indistinguishable from a photo that simply
 * has no filter applied: the untreated `<Image>` underneath keeps showing, so
 * nothing looks broken. That silence has hidden two separate real faults
 * already — Skia's missing HEIC decoder, and an unresolved bundled asset — so
 * failures say so rather than being swallowed.
 */
function warn(message: string, uri: string, error?: unknown): void {
  if (!__DEV__) return;
  // Only the tail of the URI: these are signed URLs and the query string is a
  // credential.
  const tail = uri.split('?')[0]?.slice(-48) ?? '';
  console.warn(`[disposable] ${message}: …${tail}`, error ?? '');
}

export interface DisposableRenderRequest {
  image: SkImage;
  recipe: DisposableRecipe;
  /** Identifies the photo. Two photos never share a cache entry. */
  seedKey: string;
  width: number;
  height: number;
  devicePixelRatio: number;
  fit: 'cover' | 'contain';
  compact: boolean;
  dateStamp?: string;
}

/**
 * Rounds a dimension so that near-identical layouts share one cache entry.
 *
 * React Native reports layout in floats, and two measurements of "the same"
 * box rarely agree to the last decimal. Without this, a photo re-opened at
 * 358.33pt would miss a cache entry stored at 358.34pt and pay for a full
 * re-render to produce a visually identical image.
 */
function bucket(value: number): number {
  return Math.max(1, Math.round(value / 4) * 4);
}

function renderKey(request: DisposableRenderRequest): string {
  return [
    request.seedKey,
    bucket(request.width),
    bucket(request.height),
    Math.round(Math.min(request.devicePixelRatio, MAX_PREVIEW_PIXEL_RATIO) * 100),
    request.fit,
    request.compact ? 'c' : 'f',
    request.dateStamp ?? '',
  ].join('|');
}


/**
 * The largest box with the photo's aspect ratio that fits inside the frame.
 */
function contentRect(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: frameWidth, height: frameHeight };
  }
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}

/**
 * The filtered photo as a flat image, rendered once and reused thereafter.
 *
 * Returns `null` when no GPU surface can be allocated. The caller must fall
 * back to drawing the picture directly in that case — a CPU raster of this
 * shader at full-screen size takes seconds, which would be far worse than the
 * problem being solved.
 */
export function getDisposableRender(request: DisposableRenderRequest): SkImage | null {
  const key = renderKey(request);

  const cached = renderedImages.get(key);
  if (cached) return cached;

  const ratio = Math.min(request.devicePixelRatio, MAX_PREVIEW_PIXEL_RATIO);
  let width = Math.max(1, Math.round(request.width * ratio));
  let height = Math.max(1, Math.round(request.height * ratio));

  // When the photo is being fitted rather than filled, the surface is sized to
  // the photo instead of to the box it will sit in.
  //
  // Otherwise the frame is larger than the picture, and every layer in the
  // pipeline has to reckon with the empty margin around it. The image shader
  // tiles with `TileMode.Clamp` — deliberately, so the softening kernel's
  // outermost taps read a real pixel instead of transparent black — and clamp
  // repeats the edge row outwards forever, smearing the photo's top and bottom
  // rows into vertical streaks across the margin. That was the artifact.
  //
  // Clipping the draw would hide the streaks but leave the rest wrong: the
  // vignette would still be centred on the box rather than the photo, grain
  // would be scaled to the box's longest edge, and the date stamp would sit in
  // the empty margin. Matching the surface to the photo removes the margin
  // altogether, so every layer lands on the picture by construction and
  // there is no outside for anything to bleed into.
  if (request.fit === 'contain') {
    const fitted = contentRect(request.image.width(), request.image.height(), width, height);
    width = Math.max(1, Math.round(fitted.width));
    height = Math.max(1, Math.round(fitted.height));
  }

  // Bail to the caller's `<Picture>` fallback if this device has already been
  // shown not to support the offscreen path — see `offscreenRenderingWorks`.
  if (!offscreenRenderingWorks()) return null;

  // GPU only. `Skia.Surface.Make` (CPU raster) is deliberately not used as a
  // fallback here, unlike in the exporter: the exporter can afford seconds,
  // a screen transition cannot.
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;

  const canvas = surface.getCanvas();
  // The paint is built in the surface's own pixel space, so the shader's
  // frame-relative layers — grain, vignette, dust — land exactly where they
  // would at this size, and `devicePixelRatio` is 1 from here on.
  const painted = buildDisposablePaint(request.image, request.recipe, {
    width,
    height,
    devicePixelRatio: 1,
    // Always `cover`: the surface was just sized to the photo's own shape, so
    // filling it and fitting into it are the same operation.
    fit: 'cover',
    compact: request.compact,
  });
  drawDisposable(canvas, painted);

  if (request.dateStamp) {
    // The whole frame, because the frame is the photo — see the surface sizing
    // above. A date back exposes its digits onto the film itself, so there is
    // no margin for them to fall into.
    drawDisposableDateStamp(canvas, {
      width,
      height,
      text: request.dateStamp,
      style: DISPOSABLE_PRESET.dateStamp,
      seed: request.recipe.grain.seed,
    });
  }

  const snapshot = surface.makeImageSnapshot();
  if (!snapshot) return null;

  const image = snapshot.makeNonTextureImage();
  if (!image) return null;

  renderedImages.set(key, image, weigh(image));
  return image;
}

/**
 * Whether this device can actually render offscreen and read the result back.
 *
 * Checked once, with a real 2x2 render rather than a capability flag: the
 * failure this guards against was not an API being absent — every call
 * returned a perfectly valid-looking object — but the pixels being
 * unreachable from the context that had to draw them. Only rendering
 * something and looking at the bytes distinguishes those two cases.
 *
 * On failure the caller falls back to replaying the picture, which is slower
 * but is the path this component used everywhere before any of this existed.
 * A blank photo is never an acceptable outcome of an optimisation.
 */
let offscreenSupport: boolean | null = null;

function offscreenRenderingWorks(): boolean {
  if (offscreenSupport !== null) return offscreenSupport;

  offscreenSupport = false;
  try {
    const probe = Skia.Surface.MakeOffscreen(2, 2);
    if (!probe) return offscreenSupport;

    const paint = Skia.Paint();
    // Opaque red, chosen so a wrong answer is unambiguous: an unrendered
    // surface reads back as transparent black, and a context mix-up as
    // nothing at all. Neither can be mistaken for this.
    paint.setColor(Skia.Color('#ff0000'));
    probe.getCanvas().drawRect(Skia.XYWHRect(0, 0, 2, 2), paint);
    probe.flush();

    const raster = probe.makeImageSnapshot()?.makeNonTextureImage();
    const pixels = raster?.readPixels();
    if (!pixels || pixels.length < 4) return offscreenSupport;

    // readPixels returns 0..255 bytes or 0..1 floats depending on the buffer
    // type, so compare against each channel's own range rather than assuming.
    const scale = pixels instanceof Float32Array ? 1 : 255;
    offscreenSupport = pixels[0] > scale * 0.5 && pixels[1] < scale * 0.5;
  } catch {
    offscreenSupport = false;
  }

  return offscreenSupport;
}

/**
 * Any already-rendered image of this photo, whatever size it was rendered at.
 *
 * The open animation's problem is not that rendering is slow in absolute
 * terms, it is that a *first* view of a photo at viewer size has to render
 * something before it can show anything — and that lands exactly when the
 * transition starts. The grid cell the user just tapped, though, has already
 * rendered that same photo at thumbnail size, and it is still in the cache.
 *
 * Scaling that up covers the transition with a correctly-filtered image
 * costing one texture draw, and the full-size render swaps in when it is
 * ready. It is briefly soft while the photo is still moving — the same trade
 * every shared-element transition makes — and sharp by the time it settles.
 *
 * Prefers the largest available, so a re-open reuses the viewer-size render
 * rather than dropping back to a thumbnail.
 */
export function peekAnyRenderFor(seedKey: string, aspect: number): SkImage | null {
  let best: SkImage | null = null;
  let bestPixels = 0;

  for (const [key, image] of renderedImages.entriesInUseOrder()) {
    if (!key.startsWith(`${seedKey}|`)) continue;

    // The stand-in is drawn stretched to fill the box, so a render made for a
    // differently-shaped box would distort the photo — which is precisely the
    // fault this whole change set is fixing. A grid cell is 4:5 and the viewer
    // is roughly 9:16, so without this the two would never be interchangeable.
    // 12% is wide enough to absorb layout rounding and the odd bucket, and far
    // tighter than any distortion the eye would catch in motion.
    const imageAspect = image.width() / image.height();
    if (Math.abs(imageAspect - aspect) / aspect > 0.12) continue;

    const pixels = image.width() * image.height();
    if (pixels > bestPixels) {
      best = image;
      bestPixels = pixels;
    }
  }
  return best;
}

/** Testing and memory-pressure hook. Not called in normal operation. */
export function clearDisposableCaches(): void {
  sourceImages.clear();
  renderedImages.clear();
  pendingSources.clear();
  offscreenSupport = null;
}
