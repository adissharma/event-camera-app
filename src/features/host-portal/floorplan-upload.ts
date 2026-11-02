import { FloorplanFileError, type FloorplanFile } from '@/features/seating/floorplan-file';

/** Long edge of a rasterised page. Matches the iPhone path in `floorplan-file.ts`. */
const PDF_RASTER_EDGE = 4096;
/** The covers bucket refuses anything larger. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const FLOORPLAN_ACCEPT = 'image/png,image/jpeg,application/pdf';

/**
 * pdf.js is served as static files from `public/vendor/pdfjs` and loaded only
 * when a host actually picks a PDF, so nobody else pays for its 1.4 MB. It is
 * imported by URL at runtime, outside Metro, which is why this hides the call in
 * a `Function`: Metro would otherwise try to bundle the expression, and it cannot
 * bundle pdf.js's own runtime-resolved worker import.
 */
async function loadPdfJs(): Promise<any> {
  const base = `${window.location.origin}/vendor/pdfjs`;
  const importModule = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
  const pdfjs = await importModule(`${base}/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
  return pdfjs;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the page.'))), type, quality);
  });
}

/** Draws a PDF's first page to an image: guests only ever receive an image. */
async function rasterisePdf(file: File): Promise<Blob> {
  const pdfjs = await loadPdfJs();
  const document_ = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    const page = await document_.getPage(1);
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PDF_RASTER_EDGE / Math.max(natural.width, natural.height) });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas context.');
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    // A plan drawn from flat colour is smallest as a PNG; a scanned one is not.
    const png = await canvasToBlob(canvas, 'image/png');
    return png.size <= MAX_UPLOAD_BYTES ? png : canvasToBlob(canvas, 'image/jpeg', 0.9);
  } finally {
    await document_.destroy();
  }
}

/**
 * Turns a file the host chose into something `uploadSeatingFloorplan` accepts.
 * The returned `uri` is an object URL; the caller revokes it after the upload.
 */
export async function prepareFloorplanUpload(file: File): Promise<FloorplanFile> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage = file.type === 'image/png' || file.type === 'image/jpeg';
  if (!isPdf && !isImage) {
    throw new FloorplanFileError('Choose a PNG, JPEG or PDF of the floor plan.');
  }

  let blob: Blob = file;
  if (isPdf) {
    try {
      blob = await rasterisePdf(file);
    } catch (error) {
      console.warn('[host-portal] could not read the PDF', error);
      throw new FloorplanFileError('We couldn’t read that PDF. Try exporting the plan as a PNG.');
    }
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new FloorplanFileError('That file is over 20 MB. Export a smaller version and try again.');
  }
  return {
    uri: URL.createObjectURL(blob),
    mimeType: blob.type === 'image/png' ? 'image/png' : 'image/jpeg',
  };
}
