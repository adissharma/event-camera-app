/**
 * Guards the two calls whose absence made the disposable filter disappear.
 *
 * The regression they caused was invisible to ordinary checks: nothing threw,
 * nothing returned null, and every object looked valid — the canvas simply
 * drew no pixels, so the untreated image mounted underneath showed through and
 * photos looked unfiltered. Type checking cannot catch that, and neither can a
 * null check, so the contract is asserted directly here instead.
 */

// `mock`-prefixed so jest's hoisted mock factories may reference them.
const mockCalls: string[] = [];
let mockOffscreenNull = false;
let mockProbePixels: Uint8Array = new Uint8Array([255, 0, 0, 255]);
let mockTextureOnly = false;
const mockSurfaceSizes: [number, number][] = [];
const mockStampFrames: [number, number][] = [];
const mockTranslations: [number, number][] = [];

// Sized from the surface it came from, so aspect-sensitive behaviour is real.
const mockMakeImage = (w = 4, h = 4): unknown => ({
  width: () => w,
  height: () => h,
  makeNonTextureImage: () => {
    mockCalls.push('makeNonTextureImage');
    return mockTextureOnly ? null : mockMakeImage(w, h);
  },
  readPixels: () => mockProbePixels,
});

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Surface: {
      MakeOffscreen: (w: number, h: number) => {
        mockCalls.push('MakeOffscreen');
        mockSurfaceSizes.push([w, h]);
        if (mockOffscreenNull) return null;
        return {
          getCanvas: () => ({
            drawRect: () => {}, drawPaint: () => {}, save: () => {}, restore: () => {},
            concat: () => {}, clipRect: () => {}, drawPath: () => {}, drawImageRect: () => {},
            translate: (x: number, y: number) => mockTranslations.push([x, y]),
          }),
          flush: () => mockCalls.push('flush'),
          makeImageSnapshot: () => {
            mockCalls.push('makeImageSnapshot');
            return mockMakeImage(w, h);
          },
        };
      },
    },
    Paint: () => ({ setColor: () => {}, setShader: () => {}, setImageFilter: () => {}, setBlendMode: () => {}, setAlphaf: () => {} }),
    Color: () => 0,
    XYWHRect: () => ({}),
    Data: { fromURI: jest.fn(() => Promise.resolve(null)) },
    Image: { MakeImageFromEncoded: jest.fn(() => null) },
  },
}));

jest.mock('react-native', () => ({
  Image: { resolveAssetSource: jest.fn((id: number) => ({ uri: `bundled://${id}` })) },
}));

jest.mock('./disposable-paint', () => ({
  buildDisposablePaint: () => ({ paint: {}, width: 4, height: 4 }),
  drawDisposable: () => {},
}));
jest.mock('./disposable-stamp', () => ({
  drawDisposableDateStamp: (_c: unknown, o: { width: number; height: number }) => {
    mockStampFrames.push([o.width, o.height]);
  },
}));

/* eslint-disable import/first -- the mocks above must be hoisted before these. */
import { Skia } from '@shopify/react-native-skia';
import { Image as RNImage } from 'react-native';

import {
  clearDisposableCaches,
  getDisposableRender,
  loadSourceImage,
  peekAnyRenderFor,
} from './disposable-cache';
import { buildDisposableRecipe } from './disposable-recipe';
/* eslint-enable import/first */

const request = () => ({
  image: { width: () => 100, height: () => 100 } as never,
  recipe: buildDisposableRecipe('test'),
  seedKey: 'test',
  width: 40,
  height: 50,
  devicePixelRatio: 2,
  fit: 'cover' as const,
  compact: false,
});

beforeEach(() => {
  clearDisposableCaches();
  mockCalls.length = 0;
  mockSurfaceSizes.length = 0;
  mockStampFrames.length = 0;
  mockTranslations.length = 0;
  mockOffscreenNull = false;
  mockTextureOnly = false;
  mockProbePixels = new Uint8Array([255, 0, 0, 255]);
  jest.clearAllMocks();
});

describe('getDisposableRender', () => {
  it('flushes the surface before snapshotting it', () => {
    // Drawing into a GPU surface only queues work. Snapshotting without
    // flushing can capture the surface before the shader has run.
    getDisposableRender(request());
    const flushed = mockCalls.indexOf('flush');
    const snapped = mockCalls.indexOf('makeImageSnapshot');
    expect(flushed).toBeGreaterThan(-1);
    expect(snapped).toBeGreaterThan(flushed);
  });

  it('converts the snapshot off the GPU texture before returning it', () => {
    // A snapshot is backed by a texture owned by its own surface's context.
    // The <Canvas> view draws in a different context, where that texture
    // resolves to nothing — which is exactly how the filter vanished.
    getDisposableRender(request());
    expect(mockCalls).toContain('makeNonTextureImage');
  });

  it('returns null rather than a texture-only image the canvas cannot draw', () => {
    mockTextureOnly = true;
    expect(getDisposableRender(request())).toBeNull();
  });

  it('falls back rather than rendering when the device fails the self-test', () => {
    // Transparent black is what an unrendered surface reads back as.
    mockProbePixels = new Uint8Array([0, 0, 0, 0]);
    expect(getDisposableRender(request())).toBeNull();
  });

  it('falls back when no offscreen surface can be allocated', () => {
    mockOffscreenNull = true;
    expect(getDisposableRender(request())).toBeNull();
  });

  it('caps preview density so a 3x screen does not render 3x pixels', () => {
    // Export is unaffected — it never calls this. Only what is drawn on
    // screen is capped.
    mockSurfaceSizes.length = 0;
    getDisposableRender({ ...request(), width: 100, height: 100, devicePixelRatio: 3 });
    // The 2x2 self-test probe is first; the real render follows.
    expect(mockSurfaceSizes).toContainEqual([200, 200]);
    expect(mockSurfaceSizes).not.toContainEqual([300, 300]);
  });

  /*
   * The image shader tiles with TileMode.Clamp, so any part of the surface the
   * photo does not cover gets the edge row repeated across it — which showed
   * up as vertical smearing above and below fitted photos. Sizing the surface
   * to the photo removes the uncovered area entirely.
   */
  it('sizes the surface to the photo when fitting, leaving no margin to smear', () => {
    getDisposableRender({
      ...request(),
      // A square photo in a 2:1 box would otherwise leave bars left and right.
      image: { width: () => 100, height: () => 100 } as never,
      width: 200, height: 100, devicePixelRatio: 1, fit: 'contain',
    });
    expect(mockSurfaceSizes).toContainEqual([100, 100]);
    expect(mockSurfaceSizes).not.toContainEqual([200, 100]);
  });

  it('uses the whole box when covering, since the photo fills it', () => {
    getDisposableRender({
      ...request(),
      image: { width: () => 100, height: () => 100 } as never,
      width: 200, height: 100, devicePixelRatio: 1, fit: 'cover',
    });
    expect(mockSurfaceSizes).toContainEqual([200, 100]);
  });

  it('stamps onto the photo, never into an empty margin', () => {
    getDisposableRender({
      ...request(),
      image: { width: () => 100, height: () => 100 } as never,
      width: 200, height: 100, devicePixelRatio: 1, fit: 'contain',
      dateStamp: "'26 08 25",
    });
    // The stamp's frame is the photo-shaped surface, not the 2:1 box.
    expect(mockStampFrames).toContainEqual([100, 100]);
  });

  it('runs the self-test once, not per render', () => {
    getDisposableRender(request());
    const first = mockCalls.filter((c) => c === 'MakeOffscreen').length;
    getDisposableRender({ ...request(), seedKey: 'other' });
    const second = mockCalls.filter((c) => c === 'MakeOffscreen').length;
    // Two renders, but only one extra surface: the probe is not repeated.
    expect(second - first).toBe(1);
  });

  it('reuses a cached render instead of rendering again', () => {
    const a = getDisposableRender(request());
    const before = mockCalls.length;
    const b = getDisposableRender(request());
    expect(b).toBe(a);
    expect(mockCalls.length).toBe(before);
  });
});

describe('render keys', () => {
  /*
   * Guards the mismatch that made two photos appear at once: the viewer
   * rendered the previous photo's image under the next photo's seed key, so
   * the wrong pixels were cached against that key and kept coming back.
   * `useSharedSourceImage` prevents the mismatch reaching here by pairing an
   * image with the source it came from; this pins the other half — that a key
   * identifies a photo, so two photos can never share an entry.
   */
  it('never returns one photo\'s render for another photo', () => {
    const a = getDisposableRender({ ...request(), seedKey: 'photo-a' });
    const b = getDisposableRender({ ...request(), seedKey: 'photo-b' });
    expect(a).not.toBe(b);
  });

  it('keeps entries separate when only the photo differs', () => {
    getDisposableRender({ ...request(), seedKey: 'photo-a' });
    const before = mockCalls.filter((c) => c === 'makeImageSnapshot').length;
    getDisposableRender({ ...request(), seedKey: 'photo-b' });
    const after = mockCalls.filter((c) => c === 'makeImageSnapshot').length;
    // A second photo renders rather than silently reusing the first's entry.
    expect(after).toBe(before + 1);
  });
});

describe('peekAnyRenderFor', () => {
  it('finds a render of the same photo made at a different size', () => {
    // This is what keeps the open animation free of shader work: the grid
    // cell already rendered this photo small, and the viewer draws that
    // scaled rather than rendering afresh mid-transition.
    getDisposableRender({ ...request(), width: 40, height: 50 });
    expect(peekAnyRenderFor('test', 40 / 50)).not.toBeNull();
  });

  it('refuses a render shaped for a different box', () => {
    // Drawn stretched to fill, so a mismatched shape would distort the photo
    // — the very fault being fixed elsewhere in this change.
    getDisposableRender({ ...request(), width: 40, height: 50 });
    expect(peekAnyRenderFor('test', 16 / 9)).toBeNull();
  });

  it('does not offer another photo\'s render', () => {
    getDisposableRender({ ...request(), seedKey: 'photo-a' });
    expect(peekAnyRenderFor('photo-b', 40 / 50)).toBeNull();
  });

  it('returns nothing before anything has been rendered', () => {
    expect(peekAnyRenderFor('test', 1)).toBeNull();
  });
});

describe('loadSourceImage', () => {
  it('resolves a bundled asset id to a URI before loading it', async () => {
    // `require('./photo.png')` is a module id, not a URL. Passing it straight
    // to Skia yields nothing, which left every preset photo unfiltered.
    await loadSourceImage(42);
    expect(RNImage.resolveAssetSource).toHaveBeenCalledWith(42);
    expect(Skia.Data.fromURI).toHaveBeenCalledWith('bundled://42');
  });

  it('passes a plain URI through untouched', async () => {
    await loadSourceImage('https://example.test/photo.jpg');
    expect(RNImage.resolveAssetSource).not.toHaveBeenCalled();
    expect(Skia.Data.fromURI).toHaveBeenCalledWith('https://example.test/photo.jpg');
  });

  /*
   * Skia has no HEIC decoder, and every photo an iPhone takes is HEIC by
   * default. `MakeImageFromEncoded` returns null for one — silently — so the
   * shader got no image and the untreated <Image> fallback showed through:
   * the photo looked completely normal, just never filtered.
   *
   * These assert on the Skia seam rather than on the transcoder itself: the
   * transcode is reached through a dynamic import, which resolves outside
   * jest's module registry. What matters here is the branch — that a HEIC is
   * never handed to Skia raw, and that a format Skia can read is never sent
   * through a needless decode-and-re-encode.
   */
  it('never hands a HEIC to Skia directly', async () => {
    await loadSourceImage('file:///photos/IMG_0001.HEIC');
    expect(Skia.Data.fromURI).not.toHaveBeenCalledWith('file:///photos/IMG_0001.HEIC');
  });

  it('recognises heif as well as heic', async () => {
    await loadSourceImage('file:///photos/IMG_0002.heif');
    expect(Skia.Data.fromURI).not.toHaveBeenCalledWith('file:///photos/IMG_0002.heif');
  });

  it('tries a format Skia can read directly before any transcode', async () => {
    // The transcode costs a decode and a re-encode; JPEG and PNG must not pay
    // it. A successful direct decode has to end the work there.
    (Skia.Data.fromURI as jest.Mock).mockResolvedValueOnce({} as never);
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValueOnce({
      width: () => 10, height: () => 10,
    } as never);
    const img = await loadSourceImage('https://store.test/photo.jpg');
    expect(Skia.Data.fromURI).toHaveBeenCalledWith('https://store.test/photo.jpg');
    expect(Skia.Data.fromURI).toHaveBeenCalledTimes(1);
    expect(img).not.toBeNull();
  });

  it('shares one in-flight decode between concurrent callers', async () => {
    const [a, b] = await Promise.all([
      loadSourceImage('https://example.test/same.jpg'),
      loadSourceImage('https://example.test/same.jpg'),
    ]);
    expect(a).toBe(b);
    expect(Skia.Data.fromURI).toHaveBeenCalledTimes(1);
  });
});
