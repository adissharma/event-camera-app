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

export type CameraAccessStatus = 'checking' | 'granted' | 'denied' | 'unavailable';

export type CameraAccess = {
  status: CameraAccessStatus;
  /** Call directly from a tap handler — see the module doc above. */
  requestAccess: () => void;
  /** Best-effort recovery once denied: opens Settings on native, retries on web. */
  openSettings: () => void;
};

function useNativeCameraAccess(): CameraAccess {
  const [permission, requestPermission] = useNativeCameraPermissions();

  const status: CameraAccessStatus = !permission ? 'checking' : permission.granted ? 'granted' : 'denied';

  const requestAccess = useCallback(() => {
    void requestPermission();
  }, [requestPermission]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { status, requestAccess, openSettings };
}

function useWebCameraAccess(): CameraAccess {
  const [status, setStatus] = useState<CameraAccessStatus>('checking');
  const permissionHandleRef = useRef<PermissionStatus | null>(null);

  // A quiet, non-prompting look at the current state — this is the same
  // `navigator.permissions.query` expo-camera's own web layer uses, kept
  // only for the initial screen (spinner vs. the Enable button), never as
  // part of the actual request path.
  useEffect(() => {
    let cancelled = false;

    async function check() {
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
    navigator.mediaDevices.getUserMedia({ video: true }).then(
      (stream) => {
        stream.getTracks().forEach((track) => track.stop());
        setStatus('granted');
      },
      (error: unknown) => {
        const name = error instanceof Error ? error.name : '';
        setStatus(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied');
      },
    );
  }, []);

  return { status, requestAccess, openSettings: requestAccess };
}

const useCameraAccessImpl = Platform.OS === 'web' ? useWebCameraAccess : useNativeCameraAccess;

export function useCameraAccess(): CameraAccess {
  return useCameraAccessImpl();
}
