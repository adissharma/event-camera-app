/**
 * Camera permission, owned directly on web rather than through
 * `expo-camera`'s own hook.
 *
 * Native keeps using `expo-camera`'s `useCameraPermissions` unchanged — that
 * flow works and this file must not touch it (`Linking.openSettings()` is
 * the only recovery available there, same as everywhere else in the app).
 *
 * Web gets its own direct path: `requestAccess` calls
 * `navigator.mediaDevices.getUserMedia({ video: true })` itself, with
 * nothing awaited beforehand. That matters because a tap's "transient user
 * activation" is what lets a strict mobile browser — iOS Safari especially —
 * show the native camera prompt at all; any `await` (or an extra hook layer
 * with its own internal state updates) between the tap and the actual API
 * call risks that activation expiring first, which some browsers handle by
 * silently declining to prompt rather than by erroring visibly. Calling the
 * browser API directly from the `onPress` removes that gap entirely, and
 * lets this module own a real granted/denied/unavailable state instead of
 * leaving a permanently-unresolved permission stuck behind it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { BRAND_CONFIG } from '@/config/brand';

let useNativeCameraPermissions: any = () => [null, () => {}];
try {
  useNativeCameraPermissions = require('expo-camera').useCameraPermissions;
} catch {
  // Native camera module unavailable in this build — status always reads 'checking'.
}

export type CameraAccessStatus = 'checking' | 'granted' | 'denied' | 'unavailable' | 'insecure';

export type CameraAccess = {
  status: CameraAccessStatus;
  /**
   * Why the last request failed, in the guest's words. Never null once a
   * request has failed — a permission button that does nothing and explains
   * nothing is the bug this whole module exists to stop repeating.
   */
  detail: string | null;
  /** Call directly from a tap handler — see the module doc above. */
  requestAccess: () => void;
  /** Best-effort recovery once denied: opens Settings on native, retries on web. */
  openSettings: () => void;
};

/** True when the browser exposes no camera API at all to this page. */
function mediaDevicesMissing(): boolean {
  return typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia;
}

/**
 * Why the camera API is absent. Almost always an insecure origin: browsers
 * expose `navigator.mediaDevices` only on a secure context, which means
 * `https://` or localhost and nothing else.
 */
function describeMissingMediaDevices(): string {
  const location = typeof window !== 'undefined' ? window.location : undefined;
  const isHttp =
    location?.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(location.hostname);
  if (!isHttp) return 'This browser does not support camera access.';
  return `Browsers only allow camera access over a secure (https://) connection, and this page was opened over http:// — so the camera cannot be requested here. Open ${location.host.replace(/:\d+$/, '')} over https:// and try again.`;
}

/**
 * Turns a `getUserMedia` rejection into something a guest at a wedding can
 * act on. The names are the standard `MediaError` set every browser uses.
 */
function describeGetUserMediaError(error: unknown): { status: CameraAccessStatus; detail: string } {
  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { status: 'unavailable', detail: 'No camera was found on this device.' };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        status: 'denied',
        detail: 'Another app is already using the camera. Close it and try again.',
      };
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        status: 'denied',
        detail:
          'Camera access was blocked. Tap the settings icon next to the address bar, allow the camera for this site, then try again.',
      };
    default:
      return {
        status: 'denied',
        detail: `The camera could not be started${name ? ` (${name})` : ''}. Please try again.`,
      };
  }
}

/**
 * Detects an already-granted permission without ever showing a dialog —
 * Safari's substitute for a working `navigator.permissions.query('camera')`.
 * This is what makes access persist across reloads there instead of forcing
 * the Enable button every single time: a stream request with no user
 * gesture behind it resolves instantly and silently when permission was
 * already granted in an earlier visit, and WebKit's own anti-abuse policy
 * is what does the rest — with no gesture AND no prior grant, it declines
 * the request quietly rather than prompting, so a first-time guest never
 * sees a dialog they didn't ask for.
 *
 * A rejection here is therefore genuinely ambiguous — "never asked" and
 * "explicitly denied" look identical from this call alone — so it is never
 * treated as a failure worth explaining. It just falls back to the ordinary
 * Enable button, where a real, gesture-backed request (and a real
 * explanation if THAT one fails) belongs.
 */
async function probeSilently(
  isStale: () => boolean,
  setStatus: (status: CameraAccessStatus) => void,
  setDetail: (detail: string | null) => void,
): Promise<void> {
  if (mediaDevicesMissing()) {
    if (isStale()) return;
    setStatus('insecure');
    setDetail(describeMissingMediaDevices());
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    if (isStale()) return;
    console.log('[camera-status] silent probe resolved — access already granted');
    setStatus('granted');
  } catch (probeError) {
    if (isStale()) return;
    console.log('[camera-status] silent probe declined — treating as not yet granted', probeError);
    setStatus('denied');
  }
}

function useNativeCameraAccess(): CameraAccess {
  const [permission, requestPermission] = useNativeCameraPermissions();

  const status: CameraAccessStatus = !permission ? 'checking' : permission.granted ? 'granted' : 'denied';

  const requestAccess = useCallback(() => {
    void requestPermission();
  }, [requestPermission]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return {
    status,
    detail:
      status === 'denied'
        ? `You can turn this on for ${BRAND_CONFIG.appName} in Settings.`
        : null,
    requestAccess,
    openSettings,
  };
}

function useWebCameraAccess(): CameraAccess {
  const [status, setStatus] = useState<CameraAccessStatus>('checking');
  const [detail, setDetail] = useState<string | null>(null);
  const permissionHandleRef = useRef<PermissionStatus | null>(null);

  // A quiet, non-prompting look at the current state — this is the same
  // `navigator.permissions.query` expo-camera's own web layer uses, kept
  // only for the initial screen (spinner vs. the Enable button), never as
  // part of the actual request path.
  useEffect(() => {
    let cancelled = false;

    async function check() {
      // Surfaced up front rather than behind a tap: on an insecure origin
      // the camera can never be requested at all, so offering a button that
      // cannot possibly work is worse than saying why.
      if (mediaDevicesMissing()) {
        if (cancelled) return;
        setStatus('insecure');
        setDetail(describeMissingMediaDevices());
        return;
      }

      if (!navigator.permissions?.query) {
        // No Permissions API at all — there is no way to ask, so verify
        // directly instead of assuming.
        console.log('[camera-status] permissions.query unavailable — probing silently');
        if (!cancelled) await probeSilently(() => cancelled, setStatus, setDetail);
        return;
      }
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (cancelled) return;
        permissionHandleRef.current = result;
        result.onchange = () => setStatus(result.state === 'granted' ? 'granted' : 'denied');

        console.log(`[camera-status] permissions.query reported '${result.state}'`);

        if (result.state === 'granted') {
          setStatus('granted');
          return;
        }
        if (result.state === 'denied') {
          setStatus('denied');
          return;
        }
        // 'prompt' is trustworthy on desktop Chrome, but WebKit's support for
        // querying 'camera' this way is known to be unreliable — both iOS
        // Safari and iOS Chrome (which is WebKit under the hood; Apple
        // requires every iOS browser to use it) can report 'prompt' here
        // even when the guest already granted access in an earlier visit.
        // That mismatch is exactly why the Enable Camera screen kept
        // reappearing after a reload there, on both browsers, even though
        // this query technically succeeded rather than throwing — the
        // earlier fix only distrusted a query that failed outright, not one
        // that quietly returned the wrong answer. A silent probe costs
        // nothing extra: on a browser where 'prompt' is already accurate, it
        // simply confirms the same 'denied' outcome with no visible dialog.
        console.log("[camera-status] 'prompt' is not trusted at face value — verifying with a silent probe");
        await probeSilently(() => cancelled, setStatus, setDetail);
      } catch (queryError) {
        // Some WebKit versions throw on the 'camera' name specifically
        // rather than being absent outright — same gap as the branch above,
        // same fix.
        console.log('[camera-status] permissions.query threw — probing silently', queryError);
        if (!cancelled) await probeSilently(() => cancelled, setStatus, setDetail);
      }
    }

    void check();

    return () => {
      cancelled = true;
      if (permissionHandleRef.current) permissionHandleRef.current.onchange = null;
    };
  }, []);

  const requestAccess = useCallback(() => {
    // `navigator.mediaDevices` is UNDEFINED — not a failing call, simply
    // absent — on any origin the browser does not consider secure. That is
    // every `http://` address except localhost, so a phone opening a LAN
    // dev URL (`http://192.168.x.x:8081`) hits this on iOS Safari and
    // Android Chrome alike, while a desktop on localhost never does.
    // Dereferencing it threw a synchronous TypeError straight out of the
    // tap handler, which is precisely how this button came to do nothing
    // at all, with nothing logged and nothing shown.
    if (mediaDevicesMissing()) {
      setStatus('insecure');
      setDetail(describeMissingMediaDevices());
      return;
    }

    // Deliberately NOT awaited before the call: the `getUserMedia` must be
    // the first thing that happens on this tap.
    try {
      navigator.mediaDevices.getUserMedia({ video: true }).then(
        (stream) => {
          // Released immediately — this call only settles the permission;
          // `CameraView` opens its own stream once the viewfinder renders.
          stream.getTracks().forEach((track) => track.stop());
          setDetail(null);
          setStatus('granted');
        },
        (error: unknown) => {
          const described = describeGetUserMediaError(error);
          setStatus(described.status);
          setDetail(described.detail);
        },
      );
    } catch (error) {
      // Some browsers throw synchronously rather than rejecting.
      const described = describeGetUserMediaError(error);
      setStatus(described.status);
      setDetail(described.detail);
    }
  }, []);

  return { status, detail, requestAccess, openSettings: requestAccess };
}

const useCameraAccessImpl = Platform.OS === 'web' ? useWebCameraAccess : useNativeCameraAccess;

export function useCameraAccess(): CameraAccess {
  return useCameraAccessImpl();
}
