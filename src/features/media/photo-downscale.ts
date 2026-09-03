import { Image } from 'react-native';

/**
 * Shrinks a photo to delivery size before upload.
 *
 * Capture only ever set `quality: 0.85` — a JPEG quality, not a size. Full
 * sensor resolution went to the server untouched: a modern phone shoots
 * 12MP or more, so stored photos reached 4.8MB each. Those pixels are never
 * seen. The gallery grid draws them at a couple of hundred points wide and
 * the full-screen viewer at the device's own width, so on the largest phone
 * a long side of 2048px is already more than the screen can resolve.
 *
 * This runs at the single upload funnel rather than at each capture site,
 * because there are several — camera, library picker, challenge, guestbook —
 * and a rule applied per call site is a rule that gets forgotten by the next
 * one. Videos and audio pass straight through; only photos are touched.
 *
 * Never throws. A photo that cannot be resized is uploaded exactly as it
 * arrived, because a large photo is enormously better than a lost one.
 */
/**
 * Longest edge, in pixels, after downscaling.
 *
 * 2048 is comfortably above any current phone's screen in points × its pixel
 * ratio, so a viewer sees no difference, while typically removing three
 * quarters of the file.
 */
export const MAX_PHOTO_LONG_SIDE = 2048;

/** JPEG quality for the re-encode. */
export const PHOTO_JPEG_QUALITY = 0.82;

export type DownscaleResult = {
  uri: string;
  /**
   * Dimensions of the file at `uri`.
   *
   * Returned because the caller records them alongside the upload, and after
   * a resize its own values describe a file that no longer exists. Null only
   * when they could not be established at all.
   */
  width: number | null;
  height: number | null;
  /** True when the original was returned untouched. */
  skipped: boolean;
  reason?: string;
};

export async function downscalePhotoForUpload(
  uri: string,
  /**
   * The capture's own dimensions, when the caller has them.
   *
   * Worth threading through rather than measuring here: reading them back
   * would mean decoding and re-encoding the whole image just to learn its
   * size, which is most of the cost of the resize itself and produces a
   * full-quality temporary file on the way. `Image.getSize` is the fallback
   * when a caller genuinely does not know.
   */
  known?: { width?: number | null; height?: number | null },
): Promise<DownscaleResult> {
  try {
    const size = await resolveDimensions(uri, known);
    if (!size) return { uri, width: null, height: null, skipped: true, reason: 'could not read dimensions' };

    const longSide = Math.max(size.width, size.height);
    if (longSide <= MAX_PHOTO_LONG_SIDE) {
      // Already small enough. Re-encoding would lose quality for no
      // meaningful saving, so the original is kept.
      return { uri, width: size.width, height: size.height, skipped: true, reason: 'already within the delivery size' };
    }

    // A resize given only one edge preserves aspect ratio. Constraining the
    // WIDTH unconditionally would push a portrait photo's long edge past the
    // cap, so the cap is applied to whichever edge is actually longer.
    const resize =
      size.width >= size.height
        ? { width: MAX_PHOTO_LONG_SIDE }
        : { height: MAX_PHOTO_LONG_SIDE };

    // `require` rather than a dynamic `import`: inside a function body it is
    // still deferred until the first resize, so the lazy-loading intent is
    // kept, and unlike `import()` it runs under Jest without needing
    // --experimental-vm-modules. Same pattern as `camera-status.ts`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const output = await manipulateAsync(uri, [{ resize }], {
      compress: PHOTO_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });

    console.log(
      `[photo-downscale] ${size.width}x${size.height} -> ${output.width}x${output.height}`,
    );
    return { uri: output.uri, width: output.width, height: output.height, skipped: false };
  } catch (error) {
    console.warn('[photo-downscale] leaving the photo at its original size', error);
    return {
      uri,
      width: known?.width ?? null,
      height: known?.height ?? null,
      skipped: true,
      reason: 'resize failed',
    };
  }
}

async function resolveDimensions(
  uri: string,
  known?: { width?: number | null; height?: number | null },
): Promise<{ width: number; height: number } | null> {
  if (known?.width && known?.height) return { width: known.width, height: known.height };
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve(width > 0 && height > 0 ? { width, height } : null),
      () => resolve(null),
    );
  });
}
