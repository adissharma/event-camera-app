/**
 * Shared microphone pre-flight check, used by every recording surface in the
 * app (main gallery video, Challenge video, Guestbook video, Guestbook
 * audio) so they all check and report microphone state the same way instead
 * of drifting into slightly different behaviour per screen.
 *
 * Three concerns, kept distinct on purpose:
 *  - `permission`: can this device record audio at all right now. Checked
 *    (and requested, if never asked) as soon as a recording surface that
 *    needs audio becomes active — never on entry to the app, so a guest who
 *    only ever takes photos is never asked for their microphone.
 *  - `level` / `isLive`: whether we can actually SHOW the guest we're
 *    hearing them. This is best-effort. Web gets a real analyser on a live
 *    mic tap for every mode. Native gets one too for audio (the existing
 *    Guestbook recorder already meters while it records). Native video does
 *    not: `expo-camera`'s `recordAsync` owns the only audio capture session
 *    during a video recording, and opening a second one alongside it risks
 *    exactly the kind of audio-session conflict that produces silent or
 *    corrupted recordings — the thing this whole feature exists to prevent.
 *    `isLive` being false there is deliberate, not a bug: the UI shows a
 *    plain "microphone on" confirmation instead of a fake animated one.
 *  - `openSettings`: once a guest has actively said no, the OS will not
 *    re-prompt them — the only way back in is the device's own settings.
 *    Native has a real place to send them (`Linking.openSettings()`, the
 *    same call already used for the photo-library permission elsewhere in
 *    this app). The web has no equivalent API — a page cannot open the
 *    browser's own site-permission UI — so this instead retries the mic
 *    tap, which is enough to recover a merely-dismissed prompt and is the
 *    most useful thing available for a hard block too.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

let useNativeMicPermissions: any = () => [null, async () => ({ granted: false }), async () => ({ granted: false })];
try {
  useNativeMicPermissions = require('expo-camera').useMicrophonePermissions;
} catch {
  // Native camera module unavailable in this build — permission always reads 'unknown'.
}

export type MicrophonePermissionStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

export type MicrophoneStatus = {
  permission: MicrophonePermissionStatus;
  /** Amplitude 0..1. Only meaningful when `isLive` is true. */
  level: number;
  /** True when `level` reflects a real, currently-open microphone tap. */
  isLive: boolean;
  /** Sends the guest to fix this themselves — see the module doc above. */
  openSettings: () => void;
};

export type UseMicrophoneStatusOptions = {
  /** Whether the current screen wants a mic check/tap right now. */
  active: boolean;
};

function useNativeMicrophoneStatus({ active }: UseMicrophoneStatusOptions): MicrophoneStatus {
  const [permission, requestPermission, getPermission] = useNativeMicPermissions();
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!active || !permission || permission.granted || requestedRef.current) return;
    if (permission.canAskAgain === false) return;
    requestedRef.current = true;
    void requestPermission();
  }, [active, permission, requestPermission]);

  // A guest who leaves for Settings and comes back needs the answer
  // refreshed without touching the record button again — `permission`
  // itself only updates on mount or after `requestPermission`, neither of
  // which fires just from returning to the app.
  useEffect(() => {
    if (!active) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => subscription.remove();
  }, [active, getPermission]);

  const status: MicrophonePermissionStatus = !permission
    ? 'unknown'
    : permission.granted
      ? 'granted'
      : 'denied';

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { permission: status, level: 0, isLive: false, openSettings };
}

function useWebMicrophoneStatus({ active }: UseMicrophoneStatusOptions): MicrophoneStatus {
  const [permission, setPermission] = useState<MicrophonePermissionStatus>('unknown');
  const [level, setLevel] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function releaseTap() {
    if (tickIntervalRef.current !== null) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    analyserRef.current = null;
  }

  // Matches `AudioCapture`'s own web level tick: a full-screen re-render on
  // every animation frame (60Hz) is the exact perf regression the waveform
  // work in an earlier pass had to fix, and this badge doesn't need more
  // resolution than that meter did.
  function tick() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const deviation = (buffer[i] - 128) / 128;
      sum += deviation * deviation;
    }
    const rms = Math.sqrt(sum / buffer.length);
    setLevel(Math.max(0, Math.min(1, rms * 3)));
  }

  const acquire = useCallback(async () => {
    releaseTap();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission('granted');

      const AudioContextCtor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        const context = new AudioContextCtor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        contextRef.current = context;
        analyserRef.current = analyser;
        setIsLive(true);
        tickIntervalRef.current = setInterval(tick, 90);
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      setPermission(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied');
    }
  }, []);

  useEffect(() => {
    if (!active) {
      releaseTap();
      setIsLive(false);
      setLevel(0);
      return;
    }
    void acquire();
    return () => releaseTap();
  }, [active, acquire]);

  useEffect(() => () => releaseTap(), []);

  // A previously-denied `getUserMedia` won't re-prompt on its own — trying
  // again is a genuine retry (recovers a merely-dismissed prompt, and picks
  // up a permission the guest just changed in the browser's own site
  // settings), not a formality.
  const openSettings = useCallback(() => {
    void acquire();
  }, [acquire]);

  return { permission, level, isLive, openSettings };
}

const useMicrophoneStatusImpl =
  Platform.OS === 'web' ? useWebMicrophoneStatus : useNativeMicrophoneStatus;

export function useMicrophoneStatus(options: UseMicrophoneStatusOptions): MicrophoneStatus {
  return useMicrophoneStatusImpl(options);
}
