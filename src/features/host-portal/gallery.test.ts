import {
  fetchAllPages,
  filterGallery,
  galleryContributors,
  mediaFileName,
  safeFileSegment,
  splitIntoArchives,
  type HostMediaItem,
} from './gallery';

function item(overrides: Partial<HostMediaItem> = {}): HostMediaItem {
  return {
    id: 'a',
    storagePath: 'w/a.jpg',
    thumbnailStoragePath: null,
    capturedAt: null,
    displayName: 'Sam',
    mediaType: 'photo',
    durationMs: null,
    mimeType: 'image/jpeg',
    fileSizeBytes: 100,
    isPinned: false,
    caption: null,
    challengeId: null,
    guestSessionId: 'guest-1',
    ...overrides,
  };
}

describe('fetchAllPages', () => {
  it('keeps reading past a server cap smaller than the page size', async () => {
    const table = Array.from({ length: 25 }, (_, index) => index);
    const pages: [number, number][] = [];
    const rows = await fetchAllPages(async (from, to) => {
      pages.push([from, to]);
      // The server returns at most 10 rows, whatever range it was asked for.
      return table.slice(from, Math.min(to + 1, from + 10));
    }, 1000);

    expect(rows).toEqual(table);
    expect(pages.map(([from]) => from)).toEqual([0, 10, 20, 25]);
  });

  it('returns nothing for an empty table', async () => {
    await expect(fetchAllPages(async () => [])).resolves.toEqual([]);
  });
});

describe('filterGallery', () => {
  const items = [
    item({ id: 'photo' }),
    item({ id: 'video', mediaType: 'video' }),
    item({ id: 'pinned', isPinned: true, guestSessionId: 'guest-2' }),
    item({ id: 'challenge', challengeId: 'c1', guestSessionId: null, displayName: 'Host' }),
  ];
  const ids = (kind: Parameters<typeof filterGallery>[1]['kind'], contributor: string | null = null) =>
    filterGallery(items, { kind, contributor }).map((entry) => entry.id);

  it('filters by kind', () => {
    expect(ids('all')).toHaveLength(4);
    expect(ids('photos')).toEqual(['photo', 'pinned', 'challenge']);
    expect(ids('videos')).toEqual(['video']);
    expect(ids('pinned')).toEqual(['pinned']);
    expect(ids('challenges')).toEqual(['challenge']);
  });

  it('filters by contributor, including the host', () => {
    expect(ids('all', 'guest-2')).toEqual(['pinned']);
    expect(ids('all', 'host')).toEqual(['challenge']);
  });
});

describe('galleryContributors', () => {
  it('counts each contributor, most prolific first', () => {
    expect(
      galleryContributors([
        item({ guestSessionId: 'guest-2', displayName: 'Priya' }),
        item({ guestSessionId: 'guest-1' }),
        item({ guestSessionId: 'guest-2', displayName: 'Priya' }),
      ]),
    ).toEqual([
      { key: 'guest-2', name: 'Priya', count: 2 },
      { key: 'guest-1', name: 'Sam', count: 1 },
    ]);
  });
});

describe('mediaFileName', () => {
  it('never reuses a name within an archive', () => {
    const taken = new Set<string>();
    expect(mediaFileName(item(), taken)).toBe('Sam.jpg');
    expect(mediaFileName(item(), taken)).toBe('Sam (2).jpg');
    expect(mediaFileName(item(), taken)).toBe('Sam (3).jpg');
  });

  it('uses the extension of the actual file', () => {
    expect(mediaFileName(item({ mediaType: 'video', mimeType: 'video/quicktime' }))).toBe('Sam.mov');
    expect(mediaFileName(item({ mediaType: 'video', mimeType: null }))).toBe('Sam.mp4');
  });
});

describe('safeFileSegment', () => {
  it('strips anything that could escape a folder inside a zip', () => {
    expect(safeFileSegment('../../etc/passwd')).toBe('etcpasswd');
    expect(safeFileSegment('  Sam:  Lee?  ')).toBe('Sam Lee');
    expect(safeFileSegment('...')).toBe('Untitled');
  });
});

describe('splitIntoArchives', () => {
  it('starts a new archive before one would exceed the limit', () => {
    const sized = (fileSizeBytes: number | null) => ({ fileSizeBytes });
    const archives = splitIntoArchives([sized(60), sized(60), sized(30), sized(200), sized(null)], 100, 10);
    expect(archives.map((archive) => archive.map((entry) => entry.fileSizeBytes))).toEqual([
      [60],
      [60, 30],
      [200],
      [null],
    ]);
  });

  it('returns no archives for no items', () => {
    expect(splitIntoArchives([])).toEqual([]);
  });
});
