/**
 * Shared microphone pre-flight check, used by every recording surface in the
 * app (main gallery video, Challenge video, Guestbook video, Guestbook
 * audio) so they all check and report microphone state the same way instead
 * of drifting into slightly different behaviour per screen.
 *
 * Two concerns, kept distinct on purpose:
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
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

let useNativeMicPermissions: any = () => [null, async () => ({ granted: false })];
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
};

export type UseMicrophoneStatusOptions = {
  /** Whether the current screen wants a mic check/tap right now. */
  active: boolean;
};

function useNativeMicrophoneStatus({ active }: UseMicrophoneStatusOptions): MicrophoneStatus {
  const [permission, requestPermission] = useNativeMicPermissions();
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!active || !permission || permission.granted || requestedRef.current) return;
    if (permission.canAskAgain === false) return;
    requestedRef.current = true;
    void requestPermission();
  }, [active, permission, requestPermission]);

  const status: MicrophonePermissionStatus = !permission
    ? 'unknown'
    : permission.granted
      ? 'granted'
      : 'denied';

  return { permission: status, level: 0, isLive: false };
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

  useEffect(() => {
    if (!active) {
      releaseTap();
      setIsLive(false);
      setLevel(0);
      return;
    }

    let cancelled = false;

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

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
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
        if (cancelled) return;
        const name = error instanceof Error ? error.name : '';
        setPermission(name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'unavailable' : 'denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => () => releaseTap(), []);

  return { permission, level, isLive };
}

const useMicrophoneStatusImpl =
  Platform.OS === 'web' ? useWebMicrophoneStatus : useNativeMicrophoneStatus;

export function useMicrophoneStatus(options: UseMicrophoneStatusOptions): MicrophoneStatus {
  return useMicrophoneStatusImpl(options);
}
