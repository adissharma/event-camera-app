/**
 * Microphone capture for Guestbook audio messages.
 *
 * Declarative rather than imperative: the parent flips `recording`, and this
 * starts or stops and reports the finished file through `onComplete`. That
 * keeps the recorder's lifecycle out of the camera screen, which already has
 * a great deal of its own.
 *
 * Two implementations, picked by platform. `expo-audio`'s recorder is the
 * native path; on web it is not a dependable recording API, and the browser
 * gives us something better anyway — `MediaRecorder` for the file and a Web
 * Audio `AnalyserNode` for real amplitude. They are separate components, not
 * branches inside one, so neither platform's hooks are ever conditional.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Matching the pattern already used for Guestbook playback: `expo-audio` is a
// native module, and pulling it into the web bundle buys nothing.
const audioModule = Platform.OS === 'web' ? null : (() => {
  try {
    return require('expo-audio');
  } catch {
    return null;
  }
})();

export type AudioCaptureResult = {
  uri: string;
  mimeType: string;
  durationMs: number;
};

export type AudioCaptureProps = {
  recording: boolean;
  /** Amplitude in 0..1, emitted roughly every 100ms while recording. */
  onLevel: (level: number) => void;
  onComplete: (result: AudioCaptureResult) => void;
  onError: (message: string) => void;
};

/** How often a level is pushed to the waveform. */
const LEVEL_INTERVAL_MS = 90;

/**
 * `expo-audio` reports metering in dBFS — roughly -160 (silence) to 0 (peak).
 * Speech at a sensible distance lives around -30, so the useful window is the
 * top ~60dB; mapping the whole range would leave the waveform almost flat.
 */
function normaliseMeteringDb(db: number | undefined | null): number {
  if (typeof db !== 'number' || Number.isNaN(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

export function AudioCapture(props: AudioCaptureProps) {
  if (Platform.OS === 'web' || !audioModule) {
    return <WebAudioCapture {...props} />;
  }
  return <NativeAudioCapture {...props} />;
}

function NativeAudioCapture({ recording, onLevel, onComplete, onError }: AudioCaptureProps) {
  const { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } =
    audioModule;

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, LEVEL_INTERVAL_MS);

  const startedAtRef = useRef<number | null>(null);
  // Read by the emit interval below without making it re-subscribe on every
  // new metering sample.
  const meteringRef = useRef(0);
  // `metering` is optional in `RecorderState` — it depends on the platform
  // honouring `isMeteringEnabled`. Where it never arrives, a waveform pinned
  // flat would read as broken rather than as quiet, so fall back to gentle
  // motion. Real levels are always preferred when they exist.
  const hasMeteringRef = useRef(false);
  const syntheticPhaseRef = useRef(0);

  useEffect(() => {
    const value = recorderState?.metering;
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    hasMeteringRef.current = true;
    meteringRef.current = normaliseMeteringDb(value);
  }, [recorderState?.metering]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          onError('Microphone access is needed to record a message.');
          return;
        }
        // `allowsRecording` routes iOS to the record category; without
        // `playsInSilentMode` the playback that follows is silent on a phone
        // with the ringer switch off, which is most of them at an event.
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        startedAtRef.current = Date.now();
        recorder.record();
      } catch (error) {
        console.error('[audio-capture] failed to start recording', error);
        onError('Could not start recording. Please try again.');
      }
    }

    async function stop() {
      const startedAt = startedAtRef.current;
      startedAtRef.current = null;
      if (startedAt === null) return;

      try {
        await recorder.stop();
        // Leaving the session in record mode makes playback quiet and routes
        // it to the earpiece on iOS, so hand it back before previewing.
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        const uri = recorder.uri;
        if (!uri) {
          onError('The recording could not be saved.');
          return;
        }
        onComplete({
          uri,
          // HIGH_QUALITY writes an MPEG-4 container (.m4a on disk). The type
          // has to be the registered `audio/mp4` rather than the informal
          // `audio/m4a` — the upload RPC checks against an explicit allow-list
          // and rejects anything outside it as an unsupported format.
          mimeType: 'audio/mp4',
          durationMs: Math.max(1, Date.now() - startedAt),
        });
      } catch (error) {
        console.error('[audio-capture] failed to stop recording', error);
        onError('Could not save the recording. Please try again.');
      }
    }

    if (recording) void start();
    else void stop();

    return () => {
      cancelled = true;
    };
    // `recorder` and the callbacks are stable enough for this to key off the
    // recording flag alone; re-running on a new callback identity would stop
    // and restart the recording mid-message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => {
    if (!recording) return;
    syntheticPhaseRef.current = 0;
    const id = setInterval(() => {
      if (hasMeteringRef.current) {
        onLevel(meteringRef.current);
        return;
      }
      // Two detuned sines so the motion does not read as a repeating loop.
      syntheticPhaseRef.current += 1;
      const phase = syntheticPhaseRef.current;
      const wave =
        Math.sin(phase * 0.55) * 0.3 + Math.sin(phase * 0.23 + 1.1) * 0.2 + 0.5;
      onLevel(Math.max(0.15, Math.min(0.85, wave)));
    }, LEVEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [recording, onLevel]);

  return null;
}

function WebAudioCapture({ recording, onLevel, onComplete, onError }: AudioCaptureProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function teardown() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        // A parallel analyser on the same stream: the recorder writes the
        // file, this only ever reads amplitude for the waveform.
        const AudioContextCtor =
          window.AudioContext ?? (window as any).webkitAudioContext;
        if (AudioContextCtor) {
          const context = new AudioContextCtor();
          const analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          context.createMediaStreamSource(stream).connect(analyser);
          audioContextRef.current = context;
          analyserRef.current = analyser;
        }

        const mimeType = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
        ].find((candidate) => MediaRecorder.isTypeSupported(candidate));

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          teardown();
          onError('Recording failed. Please try again.');
        };
        recorder.onstop = () => {
          const startedAt = startedAtRef.current;
          startedAtRef.current = null;
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          teardown();
          if (!blob.size || startedAt === null) {
            onError('The recording could not be saved.');
            return;
          }
          onComplete({
            uri: URL.createObjectURL(blob),
            mimeType: (recorder.mimeType || 'audio/webm').split(';')[0],
            durationMs: Math.max(1, Date.now() - startedAt),
          });
        };

        recorderRef.current = recorder;
        startedAtRef.current = Date.now();
        recorder.start();
        force((n) => n + 1);
      } catch (error) {
        console.error('[audio-capture] failed to start web recording', error);
        onError('Microphone access is needed to record a message.');
      }
    }

    function stop() {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    }

    if (recording) void start();
    else stop();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // Release the microphone if the screen goes away mid-recording.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close().catch(() => {});
    },
    [],
  );

  useEffect(() => {
    if (!recording) return;
    const buffer = new Uint8Array(1024);
    const id = setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      analyser.getByteTimeDomainData(buffer);
      // RMS of the waveform around its 128 midpoint, scaled so ordinary
      // speech fills a useful part of the bar height.
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const deviation = (buffer[i] - 128) / 128;
        sum += deviation * deviation;
      }
      const rms = Math.sqrt(sum / buffer.length);
      onLevel(Math.max(0, Math.min(1, rms * 3)));
    }, LEVEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [recording, onLevel]);

  return null;
}
