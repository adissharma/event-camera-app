/**
 * A cover photo picked in the browser, made small enough to keep.
 *
 * Returned as a `data:` URL rather than an object URL. An object URL dies with
 * the page, and the page does go away mid-form: signing in with Apple or Google
 * leaves for the provider and comes back. A data URL lives in the saved draft
 * and survives that round trip; `uploadCover` already reads `data:` URIs.
 *
 * Scaled to a phone-sized long edge first. A 12-megapixel original would not
 * fit in browser storage, and the guest cover never draws it larger than this.
 */

const MAX_EDGE = 1800;
const QUALITY = 0.86;

export class CoverFileError extends Error {}

export async function coverFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new CoverFileError('Choose a photo — JPEG, PNG or WebP.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Most often a HEIC straight off an iPhone, which only Safari can decode.
    throw new CoverFileError('This browser cannot open that photo. Try a JPEG or PNG.');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new CoverFileError('Could not prepare that photo. Please try another.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', QUALITY);
}
