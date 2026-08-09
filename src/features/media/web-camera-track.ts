import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Direct control of the browser's live camera track (torch and zoom).
 *
 * `expo-camera`'s web layer cannot drive either of these reliably, for two
 * structural reasons in `web/useWebCameraStream` + `web/WebCameraUtils`:
 *
 *  1. `onCapabilitiesReady` ends with
 *     `track.applyConstraints({ advanced: [constraints] })`, and every call
 *     REPLACES the track's whole constraint set. `syncTrackCapabilities` is
 *     only ever handed the keys that changed, so turning the torch on drops
 *     the zoom constraint, and changing zoom drops the torch. The two
 *     controls silently cancel each other out.
 *
 *  2. The first sync never reaches a track at all. On the initial render
 *     `stream` is still `null`, so `syncTrackCapabilities` no-ops — but the
 *     `capabilities.current` cache is updated as though it had succeeded, so
 *     the effect never retries. The `loadedmetadata` fallback that exists to
 *     cover this closes over that same stale `null` stream, so it no-ops too.
 *
 * Rather than work around both, this owns the track outright: it reads the
 * real `MediaStreamTrack` off the `<video>` element `expo-camera` renders and
 * applies torch and zoom TOGETHER, in a single `applyConstraints` call, so
 * neither can clobber the other. For that to be stable, the `CameraView` must
 * be given constant `enableTorch`/`flash`/`zoom` props on web — see the call
 * site — so the library's own settings effect never fires and never competes.
 *
 * It also reports what the current camera can actually do. Torch is a
 * property of one physical camera, not of the device: nearly every front
 * camera lacks one. Surfacing that lets the UI hide the control instead of
 * offering a button that cannot work.
 */

export interface WebCameraCapabilities {
  /** The live camera has a torch that can be switched on. */
  torch: boolean;
  /** The live camera's native zoom range, when it is zoomable at all. */
  zoom: { min: number; max: number } | null;
  /** Browser-supported focus modes, when exposed by the camera track. */
  focusMode: string[];
}

const NO_CAPABILITIES: WebCameraCapabilities = { torch: false, zoom: null, focusMode: [] };

/** How often to look for the track while the stream is still being opened. */
const TRACK_POLL_INTERVAL_MS = 120;
/** Giving up beats polling forever behind a denied permission prompt. */
const TRACK_POLL_TIMEOUT_MS = 6_000;

/** The live video track behind a `<video>` element inside `container`. */
function findVideoTrack(container: unknown): MediaStreamTrack | null {
  if (!container || typeof (container as Element).querySelector !== 'function') return null;
  const video = (container as Element).querySelector('video');
  const source = (video as HTMLVideoElement | null)?.srcObject;
  if (!(source instanceof MediaStream)) return null;
  return source.getVideoTracks().find((track) => track.readyState === 'live') ?? null;
}

export function readTrackCapabilities(track: MediaStreamTrack): WebCameraCapabilities {
  // Firefox ships MediaStreamTrack without getCapabilities entirely.
  if (typeof track.getCapabilities !== 'function') return NO_CAPABILITIES;

  const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
    torch?: boolean | boolean[];
    zoom?: { min: number; max: number };
    focusMode?: string[];
  };

  // Chrome reports `torch: true`; the spec allows a `[false, true]` sequence.
  const torchCapability = capabilities.torch;
  const torch = Array.isArray(torchCapability)
    ? torchCapability.includes(true)
    : Boolean(torchCapability);

  const zoomCapability = capabilities.zoom;
  const zoom =
    zoomCapability &&
    typeof zoomCapability.min === 'number' &&
    typeof zoomCapability.max === 'number' &&
    zoomCapability.max > zoomCapability.min
      ? { min: zoomCapability.min, max: zoomCapability.max }
      : null;

  return { torch, zoom, focusMode: Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [] };
}

/** Maps this app's normalised 0–1 zoom onto the camera's own range. */
export function toNativeZoom(normalised: number, range: { min: number; max: number }): number {
  const scaled = range.min + normalised * (range.max - range.min);
  return Math.min(range.max, Math.max(range.min, scaled));
}

/**
 * Applies torch and zoom in ONE call.
 *
 * Both keys go into a single `advanced` entry precisely because
 * `applyConstraints` replaces everything each time: sending them separately
 * is what makes the two controls cancel each other out in the library.
 */
export async function applyCameraSettings(
  track: MediaStreamTrack,
  capabilities: WebCameraCapabilities,
  settings: { facing: 'front' | 'back'; torchOn: boolean; zoom: number },
): Promise<void> {
  const advanced: Record<string, unknown> = {};
  if (capabilities.torch) advanced.torch = settings.torchOn;
  if (capabilities.zoom) advanced.zoom = toNativeZoom(settings.zoom, capabilities.zoom);
  if (settings.facing === 'front') {
    if (capabilities.focusMode.includes('continuous')) {
      advanced.focusMode = 'continuous';
    } else if (capabilities.focusMode.includes('manual')) {
      advanced.focusMode = 'manual';
    }
  }

  try {
    await track.applyConstraints({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
      ...(Object.keys(advanced).length > 0 ? { advanced: [advanced] } : {}),
    } as MediaTrackConstraints);
  } catch (error) {
    // A camera that advertises a capability can still refuse a given value.
    // That is not fatal — the viewfinder keeps working at its current
    // settings — so it is logged rather than surfaced.
    console.warn('Could not apply camera settings', error);
  }
}

/**
 * Drives torch and zoom on web, and reports what the live camera supports.
 *
 * Returns a ref to attach to the element WRAPPING `<CameraView>`, plus the
 * capabilities of whichever camera is currently open — which change when the
 * camera is flipped, since torch belongs to the individual camera.
 *
 * A no-op on native, where `expo-camera` drives both props directly.
 */
export function useWebCameraTrack(settings: {
  /** Re-resolves the track when the camera is flipped. */
  facing: 'front' | 'back';
  torchOn: boolean;
  /** Normalised 0–1, matching the `CameraView.zoom` scale. */
  zoom: number;
}): {
  containerRef: React.RefObject<any>;
  capabilities: WebCameraCapabilities;
} {
  const containerRef = useRef<any>(null);
  const [capabilities, setCapabilities] = useState<WebCameraCapabilities>(NO_CAPABILITIES);
  const { facing, torchOn, zoom } = settings;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    // The track does not exist until getUserMedia resolves and the element is
    // wired up, which happens after this effect first runs — and again after
    // every flip, which tears the old stream down completely.
    const attempt = () => {
      if (cancelled) return;

      const track = findVideoTrack(containerRef.current);
      if (!track) {
        if (Date.now() - startedAt > TRACK_POLL_TIMEOUT_MS) return;
        timer = setTimeout(attempt, TRACK_POLL_INTERVAL_MS);
        return;
      }

      const nextCapabilities = readTrackCapabilities(track);
      setCapabilities((previous) =>
        previous.torch === nextCapabilities.torch &&
        previous.zoom?.min === nextCapabilities.zoom?.min &&
        previous.zoom?.max === nextCapabilities.zoom?.max
          ? previous
          : nextCapabilities,
      );

      void applyCameraSettings(track, nextCapabilities, { facing, torchOn, zoom });
    };

    attempt();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [facing, torchOn, zoom]);

  return { containerRef, capabilities };
}
