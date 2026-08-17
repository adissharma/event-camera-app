/**
 * Tracks `window.visualViewport`'s `offsetTop`/`offsetLeft` — the piece of
 * iOS Safari's keyboard behaviour that `useWindowDimensions` does not cover.
 *
 * When the on-screen keyboard opens, iOS Safari pans the *visual* viewport up
 * over the *layout* viewport to keep the focused input visible above the
 * keyboard. This is not page scrolling — `body` already has `overflow:
 * hidden` (Expo's web default) and never moves — it is a lower-level
 * compositor behaviour, and it is the actual cause of a `position: fixed`
 * element appearing to shift or leave blank space during focus: `fixed` is
 * anchored to the *layout* viewport's origin, which the pan does not move,
 * while the *visible* area the guest is actually looking at slides
 * underneath it.
 *
 * `react-native-web`'s own `Dimensions` module (which backs
 * `useWindowDimensions`, already used for this app's full-screen preview
 * sizing) only listens for `visualViewport`'s `resize` event — the width/
 * height changing. It does not listen for `scroll`, which is the event that
 * actually fires when only `offsetTop`/`offsetLeft` change, e.g. exactly
 * this pan. So a screen sized purely from `useWindowDimensions` already
 * reacts correctly to the keyboard's height (see `fullScreenPreviewStyle` in
 * `camera.tsx`), but has no way to react to this offset — which is the gap
 * this hook exists to close.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type VisualViewportOffset = { top: number; left: number };

const ZERO_OFFSET: VisualViewportOffset = { top: 0, left: 0 };

function useWebVisualViewportOffset(): VisualViewportOffset {
  const [offset, setOffset] = useState<VisualViewportOffset>(ZERO_OFFSET);

  useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : undefined;
    if (!viewport) return;

    // `resize` covers the keyboard's own height (already handled elsewhere
    // via `useWindowDimensions`, but the offset can shift on the same event
    // too); `scroll` is what fires for an offset-only pan.
    function apply() {
      if (!viewport) return;
      setOffset({ top: Math.round(viewport.offsetTop), left: Math.round(viewport.offsetLeft) });
    }

    apply();
    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    return () => {
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
    };
  }, []);

  return offset;
}

function useNativeVisualViewportOffset(): VisualViewportOffset {
  // Native has no equivalent concept — `visualViewport` is a web-only API,
  // and the native keyboard is handled by the platform's own accessory
  // view/`KeyboardAvoidingView` machinery, which this app's native preview
  // screens already rely on unchanged.
  return ZERO_OFFSET;
}

const useVisualViewportOffsetImpl =
  Platform.OS === 'web' ? useWebVisualViewportOffset : useNativeVisualViewportOffset;

export function useVisualViewportOffset(): VisualViewportOffset {
  return useVisualViewportOffsetImpl();
}
