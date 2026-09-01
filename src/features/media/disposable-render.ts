import { File, Paths } from 'expo-file-system';
import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { formatDisposableDateStamp } from './disposable-date-stamp';
import { buildDisposablePaint, drawDisposable } from './disposable-paint';
import { DISPOSABLE_PRESET } from './disposable-preset';
import { buildDisposableRecipe } from './disposable-recipe';
import { drawDisposableDateStamp } from './disposable-stamp';
import {
  needsOrientationFix,
  needsTranscodeForSkia,
  readExifOrientation,
} from './image-orientation';
import { readLocalMediaBytes } from './read-local-image';

/**
 * Renders the Disposable look to a real file, at the photo's own resolution.
 *
 * This replaces screenshotting an on-screen preview, which is what the save
 * flow used to do. That approach caps quality at whatever the render surface
 * happened to be, ties the export to a view that must be mounted and laid out
 * first, and puts the result at the mercy of the display pipeline. Here the
 * photo is decoded, drawn once into an offscreen Skia surface at full size
 * with the *same paint the preview uses*, and encoded — no view, no
 * screenshot, no resolution ceiling beyond the memory cap.
 *
 * Native-only; `disposable-render.web.ts` stands in on web.
 */

export interface RenderDisposableParams {
  /** A local file URI. Remote sources must be downloaded by the caller first. */
  uri: string;
  /** Must match the seed the preview used, or the export will not match it. */
  seedKey: string;
  dateStampEnabled?: boolean;
  capturedAt?: string | null;
  /** Defaults to the preset's cap. Aspect ratio is always preserved. */
  maxLongEdge?: number;
  /** For choosing the transcode path when the URI has no useful extension. */
  mimeType?: string | null;
}

/**
 * Decodes to something Skia can actually consume, upright.
 *
 * Two reasons a source may need a pass through the platform's own image
 * pipeline first, and both fail silently otherwise: HEIC, which Skia has no
 * codec for and simply returns null on; and an EXIF orientation tag, which
 * Skia does not apply, so a portrait photo would be exported on its side.
 * Anything already upright and in a format Skia reads is passed through
 * untouched — the common case, and it skips a decode/re-encode cycle.
 */
async function decodeUpright(uri: string, mimeType?: string | null) {
  const { bytes } = await readLocalMediaBytes(uri);

  const mustTranscode =
    needsTranscodeForSkia(uri) || (mimeType ? needsTranscodeForSkia(mimeType) : false);
  const orientation = mustTranscode ? 1 : readExifOrientation(bytes);

  if (!mustTranscode && !needsOrientationFix(orientation)) {
    const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(bytes)));
    if (image) return image;
    // Fall through: an unreadable-but-not-HEIC source is still worth one
    // attempt through the platform decoder before giving up.
  }

  // `expo-image-manipulator` decodes with the platform's own codecs (so HEIC
  // works) and writes the pixels out in reading order (so the orientation tag
  // is baked in and no longer needed). Quality 1 because this intermediate
  // exists only to be filtered — the visible compression happens once, at the
  // end, on the finished frame.
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const normalised = await manipulateAsync(uri, [], { compress: 1, format: SaveFormat.JPEG });

  const { bytes: uprightBytes } = await readLocalMediaBytes(normalised.uri);
  const image = Skia.Image.MakeImageFromEncoded(
    Skia.Data.fromBytes(new Uint8Array(uprightBytes)),
  );
  if (!image) {
    throw new Error(`Disposable filter: could not decode image at ${uri}.`);
  }
  return image;
}

function makeSurface(width: number, height: number) {
  const gpu = Skia.Surface.MakeOffscreen(width, height);
  if (gpu) return { surface: gpu, width, height };

  const longEdge = Math.max(width, height);
  const cap = DISPOSABLE_PRESET.render.maxCpuFallbackLongEdge;
  const scale = longEdge > cap ? cap / longEdge : 1;
  const cpuWidth = Math.max(1, Math.round(width * scale));
  const cpuHeight = Math.max(1, Math.round(height * scale));

  const cpu = Skia.Surface.Make(cpuWidth, cpuHeight);
  if (!cpu) {
    throw new Error(`Disposable filter: could not allocate a ${width}x${height} surface.`);
  }
  return { surface: cpu, width: cpuWidth, height: cpuHeight };
}

export async function renderDisposablePhotoToFile({
  uri,
  seedKey,
  dateStampEnabled = true,
  capturedAt,
  maxLongEdge = DISPOSABLE_PRESET.render.maxExportLongEdge,
  mimeType,
}: RenderDisposableParams): Promise<string> {
  const image = await decodeUpright(uri, mimeType);

  const sourceWidth = image.width();
  const sourceHeight = image.height();
  const longEdge = Math.max(sourceWidth, sourceHeight);

  // Only ever scales down, and only past the cap. A photo smaller than the cap
  // comes out at exactly its own size — the filter never resamples a source it
  // did not have to, and never changes its aspect ratio.
  const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const recipe = buildDisposableRecipe(seedKey);
  // The surface may come back smaller than asked for — see `makeSurface` — so
  // everything downstream reads its size from there rather than from the
  // request, or the shader would be told a frame size the canvas does not have
  // and the vignette and leak would land off-centre.
  const { surface, width: outputWidth, height: outputHeight } = makeSurface(width, height);

  const canvas = surface.getCanvas();
  const painted = buildDisposablePaint(image, recipe, {
    width: outputWidth,
    height: outputHeight,
    // The surface is measured in real pixels, so there is no point-to-pixel
    // conversion to account for.
    devicePixelRatio: 1,
  });
  drawDisposable(canvas, painted);

  if (dateStampEnabled) {
    // The same call the on-screen preview makes, so the imprint cannot come
    // out differently in the saved file.
    drawDisposableDateStamp(canvas, {
      width: outputWidth,
      height: outputHeight,
      text: formatDisposableDateStamp(capturedAt ? new Date(capturedAt) : new Date()),
      style: DISPOSABLE_PRESET.dateStamp,
      seed: recipe.grain.seed,
    });
  }

  const snapshot = surface.makeImageSnapshot();
  const encoded = snapshot.encodeToBytes(
    ImageFormat.JPEG,
    DISPOSABLE_PRESET.render.exportQuality,
  );
  if (!encoded) {
    throw new Error('Disposable filter: encoding the rendered image failed.');
  }

  const file = new File(
    Paths.cache,
    `disposable-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
  );
  file.create({ overwrite: true });
  file.write(encoded);
  return file.uri;
}
