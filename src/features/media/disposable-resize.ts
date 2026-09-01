/**
 * The decision behind `DisposablePhoto`'s size-debouncing, as a pure function.
 *
 * `DisposablePhoto` rebuilds an expensive Skia picture whenever its render
 * size changes, but its container's layout can fire dozens of times a second
 * during an animated resize — the hero viewer's open/close transition
 * interpolates width and height directly, which is not something a transform
 * can express, so `onLayout` runs on every frame for the transition's whole
 * duration. Rebuilding on every one of those frames is what caused the lag
 * this exists to fix; this function is what decides which of those layout
 * events actually earn a rebuild.
 *
 * Kept separate from the component and the `setTimeout` that drives it so the
 * decision itself — cold start builds immediately, a no-op change does
 * nothing, anything else waits — can be tested without mounting a component
 * or a fake clock.
 */

export interface Size {
  width: number;
  height: number;
}

export type SizeDecision =
  /** The incoming size matches what has already been committed. Nothing to do. */
  | { kind: 'unchanged' }
  /**
   * Nothing has been built yet for this instance — a cold mount, or a fresh
   * photo swapped into an already-sized container. Committing immediately
   * means the first frame the user sees is already filtered, not a
   * momentary flash of the untreated fallback image.
   */
  | { kind: 'immediate'; size: Size }
  /**
   * Something is already on screen and this size differs from it. The caller
   * should wait rather than rebuild — see `DisposablePhoto`'s
   * `RESIZE_SETTLE_MS` — so a burst of these during an animated resize
   * collapses into a single rebuild once the burst ends.
   */
  | { kind: 'debounce'; size: Size };

export function decideRenderSize(committed: Size | null, incoming: Size): SizeDecision {
  if (committed && committed.width === incoming.width && committed.height === incoming.height) {
    return { kind: 'unchanged' };
  }
  if (!committed) {
    return { kind: 'immediate', size: incoming };
  }
  return { kind: 'debounce', size: incoming };
}

/**
 * The scale that stretches a picture built at `renderSize` to visually fill
 * `liveSize`, or `undefined` when they already agree closely enough that a
 * transform would be a no-op.
 *
 * Kept to two independent axes rather than one uniform factor: the hero
 * transition's start and end boxes are not the same aspect ratio (a square
 * grid cell zooming into a full-screen photo), so the container's shape
 * itself changes over the animation, not just its size.
 */
export function resizeTransformScale(
  renderSize: Size | null,
  liveSize: Size | null,
): { scaleX: number; scaleY: number } | undefined {
  if (!renderSize || !liveSize || renderSize.width <= 0 || renderSize.height <= 0) {
    return undefined;
  }
  const scaleX = liveSize.width / renderSize.width;
  const scaleY = liveSize.height / renderSize.height;
  if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) return undefined;
  return { scaleX, scaleY };
}
