import { decideRenderSize, resizeTransformScale } from './disposable-resize';

describe('decideRenderSize', () => {
  it('builds immediately on a cold start', () => {
    expect(decideRenderSize(null, { width: 100, height: 100 })).toEqual({
      kind: 'immediate',
      size: { width: 100, height: 100 },
    });
  });

  it('does nothing when the size has not actually changed', () => {
    expect(decideRenderSize({ width: 100, height: 100 }, { width: 100, height: 100 })).toEqual({
      kind: 'unchanged',
    });
  });

  it('defers when something is already built and the size differs', () => {
    expect(decideRenderSize({ width: 100, height: 100 }, { width: 120, height: 140 })).toEqual({
      kind: 'debounce',
      size: { width: 120, height: 140 },
    });
  });

  it('treats a change on only one axis as a real change', () => {
    expect(decideRenderSize({ width: 100, height: 100 }, { width: 100, height: 101 }).kind).toBe(
      'debounce',
    );
  });

  /*
   * The actual bug this whole module exists to fix: a hero-viewer open
   * animates the container's width and height directly (not via a
   * transform), so `onLayout` fires on every frame of a ~200–400ms
   * transition. Without debouncing, each of those frames rebuilds the whole
   * Skia picture — grain, dust, vignette, and 21 blurred path draws for the
   * date stamp — which is the dropped-frames lag reported against the
   * disposable filter specifically (`original` and `black_and_white` are
   * cheap native views the platform just resizes, so they never hit this).
   */
  it('collapses a burst of animation-frame layout events into one deferred rebuild', () => {
    const frames = [
      { width: 108, height: 108 }, // cold start — thumbnail bounds
      { width: 142, height: 190 },
      { width: 210, height: 340 },
      { width: 305, height: 512 },
      { width: 361, height: 640 }, // settled — full screen
    ];

    let committed: { width: number; height: number } | null = null;
    let rebuildCount = 0;
    let pendingSize: { width: number; height: number } | null = null;

    for (const frame of frames) {
      const decision = decideRenderSize(committed, frame);
      if (decision.kind === 'immediate') {
        committed = decision.size;
        rebuildCount += 1;
      } else if (decision.kind === 'debounce') {
        pendingSize = decision.size;
      }
    }
    // The debounce timer never actually fired mid-burst in this simulation —
    // exactly the point: only the cold-start frame ever counted as a real
    // rebuild while frames kept arriving.
    expect(rebuildCount).toBe(1);
    expect(committed).toEqual(frames[0]);

    // Once the burst goes quiet, the timer fires with whatever the latest
    // frame was — the settled size, not a stale intermediate one.
    committed = pendingSize;
    expect(committed).toEqual(frames[frames.length - 1]);
  });
});

describe('resizeTransformScale', () => {
  it('is undefined once render size and live size agree', () => {
    expect(resizeTransformScale({ width: 300, height: 300 }, { width: 300, height: 300 })).toBeUndefined();
  });

  it('is undefined before either size is known', () => {
    expect(resizeTransformScale(null, { width: 300, height: 300 })).toBeUndefined();
    expect(resizeTransformScale({ width: 300, height: 300 }, null)).toBeUndefined();
  });

  it('scales up when the live container has grown past the built picture', () => {
    // The mid-transition case: picture built small (thumbnail), container now
    // large (mid-zoom toward full screen).
    expect(resizeTransformScale({ width: 100, height: 100 }, { width: 400, height: 250 })).toEqual({
      scaleX: 4,
      scaleY: 2.5,
    });
  });

  it('scales down when closing', () => {
    expect(resizeTransformScale({ width: 400, height: 800 }, { width: 100, height: 200 })).toEqual({
      scaleX: 0.25,
      scaleY: 0.25,
    });
  });

  it('tolerates sub-pixel float noise from layout as unchanged', () => {
    // RN layout events report float dimensions; two of them describing "the
    // same" size are rarely bit-identical. A transform that's `{ scaleX:
    // 1.0004 }` on every settled frame would be pure wasted GPU work.
    expect(
      resizeTransformScale({ width: 300, height: 300 }, { width: 300.05, height: 299.97 }),
    ).toBeUndefined();
  });
});
