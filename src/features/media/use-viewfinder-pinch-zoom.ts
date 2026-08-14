import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Pinch-to-zoom inside the web viewfinder, without the page zooming with it.
 *
 * Native gets this from the viewfinder's `PanResponder`, which sees every touch
 * and owns the gesture outright. A browser does not work that way: pinch is a
 * *browser* gesture first, handled above the page, and JS only gets a say if
 * the element opts out of it on every front the browser offers.
 *
 * The viewfinder already carries `touch-action: none` (see
 * `webViewfinderGestureLock`), which is enough on Chrome and Android. It is
 * NOT enough on iOS Safari, which is where most guests actually are: WebKit
 * honours `touch-action` for scrolling but still zooms the *page* on a pinch,
 * driven by its own `gesturestart`/`gesturechange` events that sit outside the
 * touch stream entirely. Those have to be cancelled by name. They are
 * WebKit-only and absent from the DOM lib types, hence the plain `Event`
 * handler.
 *
 * The listeners are also registered `{ passive: false }` deliberately. React
 * Native Web attaches its own touch handling passively, so a `preventDefault`
 * issued from inside a `PanResponder` is silently discarded on web — which is
 * why the page kept zooming even though pinch code appeared to be running.
 *
 * Owning the gesture here rather than leaving it to the `PanResponder` also
 * removes a dependency on how faithfully React Native Web reproduces
 * multi-touch in its synthetic events: this reads `event.touches` from the DOM
 * directly, which is unambiguous.
 *
 * Zoom is read through a ref rather than a prop so the listeners can stay
 * attached across renders — re-registering non-passive listeners on every zoom
 * change would drop frames mid-pinch, which is exactly when it matters.
 */

function distanceBetween(touches: TouchList): number | null {
  if (touches.length < 2) return null;
  const [first, second] = [touches[0], touches[1]];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

export function useViewfinderPinchZoom({
  containerRef,
  enabled,
  zoom,
  onZoomChange,
  clamp,
  sensitivity,
}: {
  /** The element wrapping the camera preview. */
  containerRef: React.RefObject<any>;
  /** False while there is no camera to zoom — audio mode, say. */
  enabled: boolean;
  /** Current zoom, mirrored into a ref so listeners never go stale. */
  zoom: number;
  onZoomChange: (next: number) => void;
  clamp: (value: number) => number;
  sensitivity: number;
}) {
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Held in refs, not state: these change many times per second during a
  // pinch and nothing renders from them.
  const startDistanceRef = useRef<number | null>(null);
  const startZoomRef = useRef(zoom);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const node = containerRef.current as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const handleTouchStart = (event: TouchEvent) => {
      const distance = distanceBetween(event.touches);
      if (distance === null) return;
      event.preventDefault();
      startDistanceRef.current = distance;
      startZoomRef.current = zoomRef.current;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const start = startDistanceRef.current;
      const distance = distanceBetween(event.touches);
      if (start === null || distance === null) return;
      // The call that actually stops the page zooming.
      event.preventDefault();
      // Logarithmic so a given finger spread moves the zoom by the same
      // proportion wherever the pinch starts, matching the native path.
      onZoomChange(clamp(startZoomRef.current + Math.log(distance / start) * sensitivity));
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) startDistanceRef.current = null;
    };

    // WebKit-only, and not in the DOM lib types.
    const preventSafariGesture = (event: Event) => event.preventDefault();

    node.addEventListener('touchstart', handleTouchStart, { passive: false });
    node.addEventListener('touchmove', handleTouchMove, { passive: false });
    node.addEventListener('touchend', handleTouchEnd);
    node.addEventListener('touchcancel', handleTouchEnd);
    node.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    node.addEventListener('gesturechange', preventSafariGesture, { passive: false });
    node.addEventListener('gestureend', preventSafariGesture, { passive: false });

    return () => {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
      node.removeEventListener('touchcancel', handleTouchEnd);
      node.removeEventListener('gesturestart', preventSafariGesture);
      node.removeEventListener('gesturechange', preventSafariGesture);
      node.removeEventListener('gestureend', preventSafariGesture);
      startDistanceRef.current = null;
    };
  }, [containerRef, enabled, onZoomChange, clamp, sensitivity]);
}
