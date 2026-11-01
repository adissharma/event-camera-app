import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

import { STORAGE_BUCKETS } from '@/config/app-config';
import { resolveSignedUrls } from '@/features/media/signed-url-cache';

/** Long edge of a rasterised PDF page: sharp at full zoom, still a few MB. */
const PDF_RASTER_EDGE = 4096;
/** The covers bucket refuses anything larger. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type FloorplanFile = { uri: string; mimeType: 'image/png' | 'image/jpeg' };

export class FloorplanFileError extends Error {}

/**
 * Lets the host pick a PNG, JPEG or PDF of the floor plan from Files.
 *
 * Guests only ever receive an image — in the app, the App Clip and on the
 * web — so a PDF's first page is rasterised here, on the host's device,
 * before upload. iOS can draw a PDF page through the image loader expo-image
 * already ships; Android's cannot, so a PDF there asks for an image instead.
 *
 * The pickers are loaded on demand for the same reason as the CSV import: a
 * build without them should lose this button, not the whole screen.
 */
export async function pickFloorplanFile(): Promise<FloorplanFile | null> {
  if (!requireOptionalNativeModule('ExpoDocumentPicker')) {
    throw new FloorplanFileError('Update the app to upload a floor plan.');
  }
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/png', 'image/jpeg', 'application/pdf'],
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const isPdf = asset.mimeType === 'application/pdf' || /\.pdf$/i.test(asset.name);
  if (isPdf) return rasterisePdf(asset.uri);

  if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
    throw new FloorplanFileError('That image is over 20 MB. Export a smaller version and try again.');
  }
  const isPng = asset.mimeType === 'image/png' || /\.png$/i.test(asset.name);
  return { uri: asset.uri, mimeType: isPng ? 'image/png' : 'image/jpeg' };
}

async function rasterisePdf(uri: string): Promise<FloorplanFile> {
  if (Platform.OS !== 'ios') {
    throw new FloorplanFileError('PDFs can be uploaded from an iPhone. Here, choose a PNG or JPEG of the plan.');
  }
  if (!requireOptionalNativeModule('ExpoImageManipulator')) {
    throw new FloorplanFileError('Update the app to upload a PDF, or choose a PNG of the plan.');
  }
  const [{ Image }, { ImageManipulator, SaveFormat }] = await Promise.all([
    import('expo-image'),
    import('expo-image-manipulator'),
  ]);
  try {
    // The size given to the loader is the canvas the page is drawn onto, not
    // just a cap: a square target letterboxes a landscape page with empty
    // bars. So read the page's own proportions first, then ask for a canvas
    // of exactly that shape, large enough to stay sharp at full zoom.
    const natural = await Image.loadAsync(uri);
    const aspect = natural.width / natural.height;
    const width = Math.round(aspect >= 1 ? PDF_RASTER_EDGE : PDF_RASTER_EDGE * aspect);
    const height = Math.round(aspect >= 1 ? PDF_RASTER_EDGE / aspect : PDF_RASTER_EDGE);
    const page = await Image.loadAsync(uri, { maxWidth: width, maxHeight: height });
    const rendered = await ImageManipulator.manipulate(page).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.PNG });
    return { uri: saved.uri, mimeType: 'image/png' };
  } catch (error) {
    console.warn('[seating] could not read the PDF', error);
    throw new FloorplanFileError('We couldn’t read that PDF. Try exporting the plan as a PNG.');
  }
}

/** A signed URL for the floor plan, or null while it resolves or when there is none. */
export function useFloorplanUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    void resolveSignedUrls(STORAGE_BUCKETS.covers, [path])
      .then((resolved) => {
        const signed = resolved.get(path);
        if (active && signed) setUrl({ path, url: signed });
      })
      .catch((error) => console.warn('[seating] could not sign the floor plan', error));
    return () => {
      active = false;
    };
  }, [path]);
  return path && url?.path === path ? url.url : null;
}
