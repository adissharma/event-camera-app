/**
 * The portal's gallery logic, free of React and of Supabase so it can be tested
 * on its own.
 */

export interface HostMediaItem {
  id: string;
  storagePath: string;
  thumbnailStoragePath: string | null;
  capturedAt: string | null;
  /** The guest's name, or "Host" for the host's own uploads. */
  displayName: string;
  mediaType: 'photo' | 'video';
  durationMs: number | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  isPinned: boolean;
  caption: string | null;
  challengeId: string | null;
  guestSessionId: string | null;
}

export type GalleryKind = 'all' | 'photos' | 'videos' | 'pinned' | 'challenges';

export interface GalleryFilter {
  kind: GalleryKind;
  /** A key from `galleryContributors`, or null for everyone. */
  contributor: string | null;
}

const HOST_CONTRIBUTOR = 'host';

function contributorKey(item: HostMediaItem): string {
  return item.guestSessionId ?? HOST_CONTRIBUTOR;
}

export function filterGallery(items: readonly HostMediaItem[], filter: GalleryFilter): HostMediaItem[] {
  return items.filter((item) => {
    if (filter.contributor && contributorKey(item) !== filter.contributor) return false;
    switch (filter.kind) {
      case 'photos':
        return item.mediaType === 'photo';
      case 'videos':
        return item.mediaType === 'video';
      case 'pinned':
        return item.isPinned;
      case 'challenges':
        return item.challengeId !== null;
      default:
        return true;
    }
  });
}

export interface GalleryContributor {
  key: string;
  name: string;
  count: number;
}

/** Everyone who has contributed, most prolific first. */
export function galleryContributors(items: readonly HostMediaItem[]): GalleryContributor[] {
  const byKey = new Map<string, GalleryContributor>();
  for (const item of items) {
    const key = contributorKey(item);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { key, name: item.displayName, count: 1 });
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

/**
 * Reads a table one page at a time until a page comes back empty.
 *
 * PostgREST silently caps a response at `max_rows` (1000 by default), and a
 * large event passes that. Stopping on an empty page rather than a short one
 * means a server configured with a smaller cap than `pageSize` still returns
 * every row: it costs one extra request, and a truncated gallery looks exactly
 * like a complete one.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const page = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

export function extensionForMime(mimeType: string | null, fallback = 'jpg'): string {
  return EXTENSION_BY_MIME[mimeType?.toLowerCase() ?? ''] ?? fallback;
}

/** Guest names and event titles become file names, so nothing path-like survives. */
export function safeFileSegment(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'Untitled';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A readable name for a download, e.g. `Sam Lee 2026-09-29 18.04.12.jpg`.
 *
 * `taken` tracks names already used in an archive: two guests can share a name
 * and a second, and a zip entry written twice loses one of the photos.
 */
export function mediaFileName(item: HostMediaItem, taken?: Set<string>): string {
  const extension = extensionForMime(item.mimeType, item.mediaType === 'video' ? 'mp4' : 'jpg');
  const date = item.capturedAt ? new Date(item.capturedAt) : null;
  const stamp =
    date && !Number.isNaN(date.getTime())
      ? ` ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`
      : '';
  const base = `${safeFileSegment(item.displayName)}${stamp}`;

  let name = `${base}.${extension}`;
  for (let copy = 2; taken?.has(name); copy += 1) {
    name = `${base} (${copy}).${extension}`;
  }
  taken?.add(name);
  return name;
}

/**
 * Splits a download into archives the zip format and the browser can hold.
 *
 * The zip writer has no zip64 support, so one archive must stay under 4 GB; 2 GB
 * leaves margin and keeps a failed download cheap to repeat. An item of unknown
 * size counts as `unknownSize`. A single item larger than the limit still gets
 * an archive of its own.
 */
export function splitIntoArchives<T extends { fileSizeBytes: number | null }>(
  items: readonly T[],
  maxBytes = 2 * 1024 * 1024 * 1024,
  unknownSize = 25 * 1024 * 1024,
): T[][] {
  const archives: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;
  for (const item of items) {
    const size = item.fileSizeBytes ?? unknownSize;
    if (current.length > 0 && currentBytes + size > maxBytes) {
      archives.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += size;
  }
  if (current.length > 0) archives.push(current);
  return archives;
}
