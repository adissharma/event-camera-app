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

import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';
import { AudioWaveform } from './audio-waveform';

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
  progress,
  remainingMs,
  playing,
  onToggle,
  height,
  showRemaining,
}: {
  seed: string;
  progress: number;
  remainingMs: number;
  playing: boolean;
  onToggle: () => void;
  height: number;
  showRemaining: boolean;
}) {
  return (
    <View style={styles.stage}>
      <AudioWaveform seed={seed} progress={progress} height={height} />
      {showRemaining ? (
        <AppText style={styles.time}>{formatClock(remainingMs)}</AppText>
      ) : null}
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause audio message' : 'Play audio message'}
      >
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </Pressable>
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
}: AudioWaveformPlayerProps) {
  const { useAudioPlayer, useAudioPlayerStatus } = audioModule;
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const endedRef = useRef(false);

  useEffect(() => {
    if (!autoPlay) return;
    player.play();
  }, [autoPlay, player]);

  const durationSeconds =
    status.duration && status.duration > 0 ? status.duration : (durationMs ?? 0) / 1000;
  const progress =
    durationSeconds > 0 ? Math.min(1, (status.currentTime ?? 0) / durationSeconds) : 0;

  useEffect(() => {
    if (!status.didJustFinish || endedRef.current) return;
    endedRef.current = true;
    // Park at the start so a later tap replays rather than doing nothing.
    void player.seekTo(0);
    player.pause();
    onEnded?.();
  }, [player, status.didJustFinish, onEnded]);

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
      progress={progress}
      remainingMs={Math.max(0, durationSeconds * 1000 - (status.currentTime ?? 0) * 1000)}
      playing={Boolean(status.playing)}
      height={height}
      showRemaining={showRemaining}
      onToggle={() => {
        if (status.playing) {
          player.pause();
          return;
        }
        if (progress >= 1) {
          endedRef.current = false;
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

  const progress = knownDurationMs > 0 ? Math.min(1, currentMs / knownDurationMs) : 0;

  return (
    <WaveformPlayerChrome
      seed={seed ?? uri}
      progress={progress}
      remainingMs={Math.max(0, knownDurationMs - currentMs)}
      playing={playing}
      height={height}
      showRemaining={showRemaining}
      onToggle={() => {
        const element = audioRef.current;
        if (!element) return;
        if (playing) {
          element.pause();
          setPlaying(false);
          return;
        }
        if (progress >= 1) element.currentTime = 0;
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
