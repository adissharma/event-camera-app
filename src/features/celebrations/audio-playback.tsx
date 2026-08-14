/**
 * Waveform-as-player, shared by the Guestbook's audio preview and its audio
 * story slide.
 *
 * An audio message has no frame, so rather than bolting a player widget onto
 * an empty rectangle the waveform *is* the media: it fills the space a video
 * would, and the playhead running across it is the playback affordance. Both
 * places that show audio therefore want exactly this component, differing only
 * in size and whether it starts on its own.
 *
 * Two engines behind one surface. `expo-audio` is the native path; on web this
 * drives an `HTMLAudioElement` directly, which is what the rest of this
 * codebase already relies on for browser audio. They are separate components
 * rather than branches, so neither platform's hooks are ever conditional.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';
import { AudioWaveform } from './audio-waveform';

/**
 * Keeps the waveform's fill moving continuously between playback updates.
 *
 * Status arrives every few hundred milliseconds — 500ms by default on native,
 * and roughly that from the browser's `timeupdate` — so a fill driven straight
 * off it steps rather than flows. Instead, playing hands the shared value a
 * linear animation to the end of the track over exactly the time remaining,
 * which Reanimated runs on the UI thread at display rate with no JS per frame.
 *
 * Each real status update is then a correction rather than the source of
 * motion: it only intervenes when the prediction has drifted past a threshold,
 * so ordinary updates leave the running animation alone and the fill never
 * stutters from being restarted. Pausing cancels in place, which leaves the
 * value exactly where the audio stopped.
 */
function useSmoothProgress({
  playing,
  currentMs,
  durationMs,
}: {
  playing: boolean;
  currentMs: number;
  durationMs: number;
}): SharedValue<number> {
  const progress = useSharedValue(0);

  // Drift beyond this and the fill is visibly out of step with the audio;
  // below it, correcting would cost more in stutter than it buys in accuracy.
  const RESYNC_THRESHOLD = 0.015;

  const runToEnd = useCallback(
    (from: number) => {
      if (durationMs <= 0) return;
      progress.value = from;
      progress.value = withTiming(1, {
        duration: Math.max(0, durationMs * (1 - from)),
        easing: Easing.linear,
      });
    },
    [durationMs, progress],
  );

  useEffect(() => {
    if (!playing || durationMs <= 0) {
      // Freezes at the current value rather than snapping anywhere.
      cancelAnimation(progress);
      return;
    }
    runToEnd(progress.value);
  }, [playing, durationMs, progress, runToEnd]);

  useEffect(() => {
    if (durationMs <= 0) return;
    const actual = Math.max(0, Math.min(1, currentMs / durationMs));

    if (!playing) {
      progress.value = actual;
      return;
    }
    if (Math.abs(actual - progress.value) < RESYNC_THRESHOLD) return;
    runToEnd(actual);
  }, [currentMs, durationMs, playing, progress, runToEnd]);

  return progress;
}

function PlayGlyph({ size = 26, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5.5v13l11-6.5-11-6.5Z" fill={color} />
    </Svg>
  );
}

function PauseGlyph({ size = 24, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={7} y={5.5} width={3.6} height={13} rx={1.3} fill={color} />
      <Rect x={13.4} y={5.5} width={3.6} height={13} rx={1.3} fill={color} />
    </Svg>
  );
}

const audioModule = Platform.OS === 'web' ? null : (() => {
  try {
    return require('expo-audio');
  } catch {
    return null;
  }
})();

export type AudioWaveformPlayerProps = {
  uri: string;
  /** Stable identity for the bar pattern — the message id, ideally. */
  seed?: string;
  /** Known length, used until the engine reports its own. */
  durationMs?: number | null;
  autoPlay?: boolean;
  /** Fires once when playback reaches the end. */
  onEnded?: () => void;
  height?: number;
  /** Hidden where the surrounding UI already carries a timestamp. */
  showRemaining?: boolean;
  /**
   * Hidden inside a story, where the slide's full-screen tap zones sit above
   * the media and would swallow the press anyway — a control that looks
   * pressable but cannot be pressed is worse than none. A story autoplays and
   * advances on its own, exactly as a video slide does.
   */
  showPlayButton?: boolean;
};

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function AudioWaveformPlayer(props: AudioWaveformPlayerProps) {
  if (Platform.OS === 'web' || !audioModule) {
    return <WebAudioWaveformPlayer {...props} />;
  }
  return <NativeAudioWaveformPlayer {...props} />;
}

/** The visual half, identical on both platforms. */
function WaveformPlayerChrome({
  seed,
  progressValue,
  remainingMs,
  playing,
  onToggle,
  height,
  showRemaining,
  showPlayButton,
}: {
  seed: string;
  progressValue: SharedValue<number>;
  remainingMs: number;
  playing: boolean;
  onToggle: () => void;
  height: number;
  showRemaining: boolean;
  showPlayButton: boolean;
}) {
  return (
    <View style={styles.stage}>
      <AudioWaveform seed={seed} progressValue={progressValue} height={height} />
      {showRemaining ? (
        <AppText style={styles.time}>{formatClock(remainingMs)}</AppText>
      ) : null}
      {showPlayButton ? (
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause audio message' : 'Play audio message'}
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </Pressable>
      ) : null}
    </View>
  );
}

function NativeAudioWaveformPlayer({
  uri,
  seed,
  durationMs,
  autoPlay = false,
  onEnded,
  height = 150,
  showRemaining = true,
  showPlayButton = true,
}: AudioWaveformPlayerProps) {
  const { useAudioPlayer, useAudioPlayerStatus } = audioModule;
  // Defaults to 500ms. These updates only correct the animation below, but
  // at the default a seek or a stall takes half a second to show.
  const player = useAudioPlayer(uri, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const endedRef = useRef(false);
  const autoPlayedRef = useRef(false);

  /**
   * `play()` before the source has loaded is a silent no-op with no retry, and
   * a Guestbook message is always a freshly signed remote URL that is not
   * ready on mount — so firing once and hoping loses the race often enough to
   * matter.
   *
   * Waiting for `isLoaded` before the first call is not the fix either: the
   * player loads lazily, so nothing would ever ask it to start and the slide
   * would sit silent forever. Instead this asks immediately and keeps asking
   * on each status update until the player confirms it is actually playing.
   * `play()` on an already-playing player is a no-op, so the retries cost
   * nothing and stop as soon as one lands.
   */
  useEffect(() => {
    if (!autoPlay || autoPlayedRef.current) return;
    if (status.playing) {
      autoPlayedRef.current = true;
      return;
    }
    player.play();
  }, [autoPlay, status.playing, status.isLoaded, player]);

  const durationSeconds =
    status.duration && status.duration > 0 ? status.duration : (durationMs ?? 0) / 1000;
  const currentSeconds = status.currentTime ?? 0;
  const progressValue = useSmoothProgress({
    playing: Boolean(status.playing),
    currentMs: currentSeconds * 1000,
    durationMs: durationSeconds * 1000,
  });

  useEffect(() => {
    if (!status.didJustFinish || endedRef.current) return;
    endedRef.current = true;
    // Park at the start so a later tap replays rather than doing nothing. The
    // fill is reset here too rather than waiting for the seek to be reflected
    // in a later status, which would leave it sitting full in the meantime.
    progressValue.value = 0;
    void player.seekTo(0);
    player.pause();
    onEnded?.();
  }, [player, status.didJustFinish, onEnded, progressValue]);

  // Releasing is asynchronous on native, so an unmount alone can leave the
  // last moment of audio playing over whatever comes next.
  useEffect(
    () => () => {
      try {
        player.pause();
      } catch {
        // Already released.
      }
    },
    [player],
  );

  return (
    <WaveformPlayerChrome
      seed={seed ?? uri}
      progressValue={progressValue}
      remainingMs={Math.max(0, durationSeconds * 1000 - currentSeconds * 1000)}
      playing={Boolean(status.playing)}
      height={height}
      showRemaining={showRemaining}
      showPlayButton={showPlayButton}
      onToggle={() => {
        if (status.playing) {
          player.pause();
          return;
        }
        // Replaying from the end has to put the fill back to zero itself: the
        // seek is asynchronous, so the next status still reports the old
        // position for a beat and the waveform would flash full.
        if (currentSeconds >= durationSeconds - 0.05) {
          endedRef.current = false;
          progressValue.value = 0;
          void player.seekTo(0);
        }
        player.play();
      }}
    />
  );
}

function WebAudioWaveformPlayer({
  uri,
  seed,
  durationMs,
  autoPlay = false,
  onEnded,
  height = 150,
  showRemaining = true,
  showPlayButton = true,
}: AudioWaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [knownDurationMs, setKnownDurationMs] = useState(durationMs ?? 0);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const element = new Audio(uri);
    audioRef.current = element;

    const handleTime = () => setCurrentMs(element.currentTime * 1000);
    const handleMeta = () => {
      if (Number.isFinite(element.duration) && element.duration > 0) {
        setKnownDurationMs(element.duration * 1000);
      }
    };
    const handleEnded = () => {
      setPlaying(false);
      setCurrentMs(0);
      element.currentTime = 0;
      onEnded?.();
    };

    element.addEventListener('timeupdate', handleTime);
    element.addEventListener('loadedmetadata', handleMeta);
    element.addEventListener('ended', handleEnded);

    if (autoPlay) {
      // Browsers block unprompted playback outside a gesture; a refusal just
      // leaves the slide paused with its play button showing.
      void element.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }

    return () => {
      element.removeEventListener('timeupdate', handleTime);
      element.removeEventListener('loadedmetadata', handleMeta);
      element.removeEventListener('ended', handleEnded);
      element.pause();
      element.src = '';
      audioRef.current = null;
    };
  }, [uri, autoPlay, onEnded]);

  const progressValue = useSmoothProgress({
    playing,
    currentMs,
    durationMs: knownDurationMs,
  });

  return (
    <WaveformPlayerChrome
      seed={seed ?? uri}
      progressValue={progressValue}
      remainingMs={Math.max(0, knownDurationMs - currentMs)}
      playing={playing}
      height={height}
      showRemaining={showRemaining}
      showPlayButton={showPlayButton}
      onToggle={() => {
        const element = audioRef.current;
        if (!element) return;
        if (playing) {
          element.pause();
          setPlaying(false);
          return;
        }
        // Replaying from the end resets the fill directly; `timeupdate`
        // does not necessarily fire before the next paint.
        if (currentMs >= knownDurationMs - 50) {
          element.currentTime = 0;
          setCurrentMs(0);
          progressValue.value = 0;
        }
        void element.play().then(() => setPlaying(true)).catch(() => {});
      }}
    />
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  time: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 14,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
