import {
  needsOrientationFix,
  needsTranscodeForSkia,
  readExifOrientation,
  type ExifOrientation,
} from './image-orientation';

/**
 * Builds the smallest JPEG-shaped byte stream that carries an EXIF
 * orientation: SOI, an APP1 segment holding a TIFF header and a one-entry
 * IFD0, then EOI. Real files have far more in them, but this is exactly the
 * structure the reader walks.
 */
function jpegWithOrientation(
  orientation: number,
  { littleEndian = true, includeExif = true } = {},
): Uint8Array {
  const exifBody: number[] = [];
  const push16 = (value: number) => {
    if (littleEndian) exifBody.push(value & 0xff, (value >> 8) & 0xff);
    else exifBody.push((value >> 8) & 0xff, value & 0xff);
  };
  const push32 = (value: number) => {
    if (littleEndian) {
      exifBody.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
    } else {
      exifBody.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
    }
  };

  exifBody.push(0x45, 0x78, 0x69, 0x66, 0x00, 0x00); // "Exif\0\0"
  exifBody.push(...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d])); // "II" / "MM"
  push16(0x002a);
  push32(8); // IFD0 immediately after the 8-byte TIFF header
  push16(1); // one entry
  push16(0x0112); // Orientation
  push16(3); // SHORT
  push32(1); // count
  push16(orientation);
  push16(0); // padding of the 4-byte value field
  push32(0); // no next IFD

  const segmentLength = exifBody.length + 2;
  const bytes = [0xff, 0xd8];
  if (includeExif) {
    bytes.push(0xff, 0xe1, (segmentLength >> 8) & 0xff, segmentLength & 0xff, ...exifBody);
  }
  bytes.push(0xff, 0xd9);
  return Uint8Array.from(bytes);
}

describe('readExifOrientation', () => {
  it('reads a little-endian orientation tag', () => {
    expect(readExifOrientation(jpegWithOrientation(6))).toBe(6);
  });

  it('reads a big-endian orientation tag', () => {
    expect(readExifOrientation(jpegWithOrientation(8, { littleEndian: false }))).toBe(8);
  });

  it('reads every defined orientation', () => {
    ([1, 2, 3, 4, 5, 6, 7, 8] as ExifOrientation[]).forEach((value) => {
      expect(readExifOrientation(jpegWithOrientation(value))).toBe(value);
    });
  });

  it('reports upright when there is no EXIF segment', () => {
    expect(readExifOrientation(jpegWithOrientation(6, { includeExif: false }))).toBe(1);
  });

  /*
   * The three below all mean "this is not a file I can read an orientation
   * from". Reporting upright is the safe answer: the photo goes down the fast
   * path unrotated, which is exactly what happens today for every photo. The
   * failure to avoid is throwing, which would take a save down with it.
   */
  it('reports upright for bytes that are not a JPEG', () => {
    expect(readExifOrientation(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe(1);
  });

  it('reports upright for an empty buffer', () => {
    expect(readExifOrientation(new Uint8Array(0))).toBe(1);
  });

  it('reports upright for a truncated EXIF segment', () => {
    const full = jpegWithOrientation(6);
    expect(readExifOrientation(full.slice(0, full.length - 14))).toBe(1);
  });

  it('reports upright for an out-of-range tag value', () => {
    expect(readExifOrientation(jpegWithOrientation(42))).toBe(1);
  });

  it('accepts an ArrayBuffer as well as a view', () => {
    const view = jpegWithOrientation(3);
    const copy = view.slice().buffer;
    expect(readExifOrientation(copy)).toBe(3);
  });
});

describe('needsOrientationFix', () => {
  it('is false only for upright', () => {
    expect(needsOrientationFix(1)).toBe(false);
    ([2, 3, 4, 5, 6, 7, 8] as ExifOrientation[]).forEach((value) => {
      expect(needsOrientationFix(value)).toBe(true);
    });
  });
});

describe('needsTranscodeForSkia', () => {
  it('flags HEIC and HEIF by URI or MIME type, in any case', () => {
    expect(needsTranscodeForSkia('file:///var/mobile/IMG_0001.HEIC')).toBe(true);
    expect(needsTranscodeForSkia('file:///tmp/photo.heif')).toBe(true);
    expect(needsTranscodeForSkia('image/heic')).toBe(true);
    expect(needsTranscodeForSkia('image/heif')).toBe(true);
  });

  it('leaves the formats Skia decodes alone', () => {
    expect(needsTranscodeForSkia('file:///tmp/photo.jpg')).toBe(false);
    expect(needsTranscodeForSkia('image/jpeg')).toBe(false);
    expect(needsTranscodeForSkia('image/png')).toBe(false);
    expect(needsTranscodeForSkia('image/webp')).toBe(false);
  });
});
