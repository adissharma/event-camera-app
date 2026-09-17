/* eslint-disable import/first -- the mock must be hoisted before the module import. */
// `mock` prefix is required because Jest hoists mock factories.
const mockCreateSignedUrls = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  requireSupabase: () => ({
    storage: {
      from: () => ({ createSignedUrls: mockCreateSignedUrls }),
    },
  }),
}));

import { clearSignedUrlCache, resolveSignedUrls } from './signed-url-cache';
/* eslint-enable import/first */

describe('signed URL cache', () => {
  beforeEach(() => {
    clearSignedUrlCache();
    jest.clearAllMocks();
    mockCreateSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })),
      error: null,
    }));
  });

  it('reuses a private object URL instead of minting another token on a revisit', async () => {
    await expect(resolveSignedUrls('event-media', ['a.jpg', 'b.jpg'])).resolves.toEqual(
      new Map([
        ['a.jpg', 'https://signed.example/a.jpg'],
        ['b.jpg', 'https://signed.example/b.jpg'],
      ]),
    );

    await resolveSignedUrls('event-media', ['b.jpg', 'a.jpg']);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['a.jpg', 'b.jpg'], 3600);
  });

  it('shares one signing request between overlapping mounts', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    mockCreateSignedUrls.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const first = resolveSignedUrls('event-media', ['a.jpg']);
    const second = resolveSignedUrls('event-media', ['a.jpg']);
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);

    resolveRequest?.({ data: [{ path: 'a.jpg', signedUrl: 'https://signed.example/a.jpg' }], error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([
      new Map([['a.jpg', 'https://signed.example/a.jpg']]),
      new Map([['a.jpg', 'https://signed.example/a.jpg']]),
    ]);
  });

  it('re-signs before a token reaches expiry', async () => {
    jest.useFakeTimers();
    const now = Date.now();
    jest.setSystemTime(now);

    await resolveSignedUrls('event-media', ['a.jpg']);
    jest.setSystemTime(now + 58 * 60_000 + 1);
    await resolveSignedUrls('event-media', ['a.jpg']);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
