/**
 * Reads the EXIF orientation tag out of encoded JPEG bytes.
 *
 * Skia decodes pixels; it does not rotate them. `MakeImageFromEncoded` hands
 * back the sensor's raw grid, so a photo taken in portrait — which on most
 * phones is a landscape grid plus an EXIF tag saying "turn this" — renders
 * lying on its side. Every viewer the user has ever seen that file in applied
 * the tag silently, so the first time it appears rotated is in our export.
 *
 * Detecting it rather than unconditionally re-encoding every photo through a
 * normaliser is the point: a straightened file has to be decoded and
 * re-compressed before it reaches the filter, and doing that to the large
 * majority of photos that are already upright is exactly the "unnecessary
 * recompression before the final filter pass" worth avoiding.
 *
 * Pure and byte-level so it can be tested without a device.
 */

/** The subset of EXIF orientations that mean "these pixels need moving". */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const SOI = 0xffd8;
const APP1 = 0xffe1;
const ORIENTATION_TAG = 0x0112;

/**
 * Returns the orientation tag, or `1` ("upright") when there is no readable
 * one — a missing, truncated or non-JPEG file is not an error here, it just
 * means there is nothing to correct.
 */
export function readExifOrientation(bytes: ArrayBuffer | Uint8Array): ExifOrientation {
  const view = new DataView(
    bytes instanceof Uint8Array ? bytes.buffer : bytes,
    bytes instanceof Uint8Array ? bytes.byteOffset : 0,
    bytes instanceof Uint8Array ? bytes.byteLength : bytes.byteLength,
  );

  if (view.byteLength < 4 || view.getUint16(0) !== SOI) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    // Every segment marker starts 0xFF. Anything else means the stream is not
    // where we think it is, and guessing further would read noise as tags.
    if ((marker & 0xff00) !== 0xff00) return 1;

    const length = view.getUint16(offset + 2);
    if (length < 2) return 1;

    if (marker === APP1) {
      const found = readOrientationFromApp1(view, offset + 4, length - 2);
      if (found) return found;
    }

    offset += 2 + length;
  }

  return 1;
}

function readOrientationFromApp1(
  view: DataView,
  start: number,
  length: number,
): ExifOrientation | null {
  // "Exif\0\0"
  if (start + 6 > view.byteLength) return null;
  if (
    view.getUint8(start) !== 0x45 ||
    view.getUint8(start + 1) !== 0x78 ||
    view.getUint8(start + 2) !== 0x69 ||
    view.getUint8(start + 3) !== 0x66
  ) {
    return null;
  }

  const tiff = start + 6;
  if (tiff + 8 > view.byteLength || tiff + 8 > start + length) return null;

  const endian = view.getUint16(tiff);
  const little = endian === 0x4949; // "II"
  if (!little && endian !== 0x4d4d) return null; // neither "II" nor "MM"
  if (view.getUint16(tiff + 2, little) !== 0x002a) return null;

  const ifdOffset = view.getUint32(tiff + 4, little);
  const ifd = tiff + ifdOffset;
  if (ifd + 2 > view.byteLength) return null;

  const entries = view.getUint16(ifd, little);
  for (let i = 0; i < entries; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, little) === ORIENTATION_TAG) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? (value as ExifOrientation) : 1;
    }
  }

  return null;
}

/** Whether the tag calls for the pixels to be rotated or flipped at all. */
export function needsOrientationFix(orientation: ExifOrientation): boolean {
  return orientation !== 1;
}

/**
 * Whether a MIME type or URI names a format Skia's own codecs cannot decode.
 *
 * HEIC/HEIF is the one that matters: it is the iPhone default, and Skia is
 * built without a HEIF codec on both platforms, so `MakeImageFromEncoded`
 * returns null rather than failing loudly.
 */
export function needsTranscodeForSkia(uriOrMimeType: string): boolean {
  return /heic|heif/i.test(uriOrMimeType);
}
