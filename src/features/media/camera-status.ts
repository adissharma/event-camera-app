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
    detail: status === 'denied' ? 'You can turn this on for Stories. in Settings.' : null,
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
        // Safari has historically not supported querying 'camera' at all —
        // there is no way to know without prompting, so go straight to the
        // Enable button rather than spinning forever.
        if (!cancelled) setStatus('denied');
        return;
      }
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (cancelled) return;
        permissionHandleRef.current = result;
        const apply = () => setStatus(result.state === 'granted' ? 'granted' : 'denied');
        apply();
        result.onchange = apply;
      } catch {
        if (!cancelled) setStatus('denied');
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
