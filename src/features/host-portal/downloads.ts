import { Zip, ZipPassThrough } from 'fflate';

import { STORAGE_BUCKETS } from '@/config/app-config';
import { resolveSignedUrls } from '@/features/media/signed-url-cache';
import { mediaFileName, safeFileSegment, splitIntoArchives, type HostMediaItem } from './gallery';

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Long enough for the browser to have started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function fetchMediaBytes(storagePath: string): Promise<Blob> {
  // Signed fresh rather than from the page: a tab left open for hours would
  // otherwise be holding an expired link.
  const signed = await resolveSignedUrls(STORAGE_BUCKETS.media, [storagePath]);
  const url = signed.get(storagePath);
  if (!url) throw new Error('Could not sign the download.');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed with status ${response.status}.`);
  return response.blob();
}

export async function downloadMediaItem(item: HostMediaItem) {
  saveBlob(await fetchMediaBytes(item.storagePath), mediaFileName(item));
}

export interface ArchiveProgress {
  done: number;
  total: number;
}

/** Past this, buffered chunks are folded into a Blob, which browsers can spill to disk. */
const FLUSH_BYTES = 128 * 1024 * 1024;

async function writeArchive(
  items: readonly HostMediaItem[],
  fileName: string,
  onItemDone: (failed: boolean) => void,
) {
  let parts: BlobPart[] = [];
  let buffered = 0;

  const finished = new Promise<void>((resolve, reject) => {
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }
      parts.push(chunk as BlobPart);
      buffered += chunk.byteLength;
      if (buffered >= FLUSH_BYTES) {
        parts = [new Blob(parts)];
        buffered = 0;
      }
      if (final) resolve();
    });

    void (async () => {
      const names = new Set<string>();
      for (const item of items) {
        try {
          // Read in full before the entry is opened, so a failed download skips
          // this photo rather than leaving a corrupt entry in the archive.
          const bytes = new Uint8Array(await (await fetchMediaBytes(item.storagePath)).arrayBuffer());
          // Stored, not deflated: photos and videos are already compressed.
          const entry = new ZipPassThrough(mediaFileName(item, names));
          zip.add(entry);
          entry.push(bytes, true);
          onItemDone(false);
        } catch (error) {
          console.warn('[host-portal] could not add to the archive', item.id, error);
          onItemDone(true);
        }
      }
      zip.end();
    })().catch(reject);
  });

  await finished;
  saveBlob(new Blob(parts, { type: 'application/zip' }), fileName);
}

/**
 * Downloads items as one or more zip files, returning how many could not be read.
 *
 * One at a time, and buffered through Blobs instead of held as one array, so an
 * event of a few thousand photos does not take the tab down.
 */
export async function downloadArchive(
  items: readonly HostMediaItem[],
  eventTitle: string,
  onProgress: (progress: ArchiveProgress) => void,
): Promise<{ failed: number }> {
  const archives = splitIntoArchives(items);
  const title = safeFileSegment(eventTitle);
  let done = 0;
  let failed = 0;

  for (const [index, archive] of archives.entries()) {
    const suffix = archives.length > 1 ? ` (part ${index + 1} of ${archives.length})` : '';
    await writeArchive(archive, `${title}${suffix}.zip`, (itemFailed) => {
      done += 1;
      if (itemFailed) failed += 1;
      onProgress({ done, total: items.length });
    });
  }
  return { failed };
}
