/**
 * The waveform that stands in for a picture wherever audio has no frame.
 *
 * Audio appears in three places in the Guestbook and each needs a slightly
 * different thing from the same visual language, so this handles both shapes:
 *
 * - `levels`        — live amplitudes while recording, newest last.
 * - `progressValue` — a fixed bar pattern with the played portion lit, for
 *                     preview and story playback.
 *
 * The pattern for a finished recording is derived from a seed rather than from
 * the audio itself. Decoding a file to read its real envelope would mean
 * pulling the whole thing into memory and doing DSP on the JS thread for a
 * decorative result. A seeded pattern is stable for a given message — the same
 * message always draws the same shape, so it reads as *that* message's
 * waveform rather than as a random animation — which is the property that
 * actually matters here.
 *
 * ## How the fill stays smooth
 *
 * Progress is a Reanimated shared value, not a React prop, and it drives the
 * width of a clipping layer rather than a per-bar boolean. Two things follow
 * from that, and both are needed:
 *
 * - The fill advances on the UI thread at display rate. Playback status
 *   arrives every few hundred milliseconds at best, so anything re-rendering
 *   off it steps visibly however often it is sampled.
 * - The boundary lands mid-bar. Lighting whole bars quantises progress to
 *   1/42nd of the clip no matter how good the timing is, which on a short
 *   message is a visible click every few hundred milliseconds.
 *
 * The played and unplayed rows are the same bars drawn twice; only the width
 * of the clip that reveals the lit copy animates, so nothing re-lays out and
 * no JS runs per frame.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const DEFAULT_BAR_COUNT = 42;

/** Silence still has to look like a waveform rather than a flat line. */
const MIN_LEVEL = 0.12;

/**
 * Deterministic 0..1 sequence from a string. A plain `Math.random` would
 * redraw the bars on every render, which reads as noise rather than as a
 * property of the recording.
 */
function seededLevels(seed: string, count: number): number[] {
  // xorshift over an FNV-1a hash of the seed: cheap, no dependency, and
  // stable across platforms, which matters because the same message is drawn
  // on the recorder, the preview and the story.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let state = hash || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };

  return Array.from({ length: count }, (_, index) => {
    // Speech tapers at both ends far more often than it starts or stops at
    // full volume, so shape the noise with a gentle envelope.
    const position = index / Math.max(1, count - 1);
    const envelope = 0.55 + 0.45 * Math.sin(Math.PI * position);
    return MIN_LEVEL + (0.35 + next() * 0.65) * envelope * (1 - MIN_LEVEL);
  });
}

function BarRow({
  bars,
  height,
  color,
  width,
}: {
  bars: number[];
  height: number;
  color: string;
  /** Fixed width for the clipped copy, so it cannot reflow as the clip moves. */
  width?: number;
}) {
  return (
    <View style={[styles.row, { height }, width === undefined ? null : { width }]}>
      {bars.map((level, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            marginHorizontal: 1.5,
            height: Math.max(MIN_LEVEL, Math.min(1, level || 0)) * height,
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export type AudioWaveformProps = {
  /** Live amplitudes in 0..1, oldest first. Takes precedence over `seed`. */
  levels?: number[];
  /** Stable identity for a finished recording — its id or uri. */
  seed?: string;
  /**
   * 0..1 playback position, driven on the UI thread. Omit outside playback
   * contexts and every bar draws as active.
   */
  progressValue?: SharedValue<number>;
  barCount?: number;
  /** Peak height of a bar, in points. */
  height?: number;
  /** Played bars, and every bar while recording. */
  activeColor?: string;
  /** Bars not yet reached by the playhead. */
  inactiveColor?: string;
};

export function AudioWaveform({
  levels,
  seed = 'guestbook',
  progressValue,
  barCount = DEFAULT_BAR_COUNT,
  height = 120,
  activeColor = '#FFFFFF',
  inactiveColor = 'rgba(255, 255, 255, 0.28)',
}: AudioWaveformProps) {
  const pattern = useMemo(() => seededLevels(seed, barCount), [seed, barCount]);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  // Live levels are right-aligned so the newest sample is at the leading edge
  // and older ones scroll away, the way a level meter reads.
  const bars = useMemo(() => {
    if (!levels) return pattern;
    if (levels.length >= barCount) return levels.slice(levels.length - barCount);
    return [...Array.from({ length: barCount - levels.length }, () => 0), ...levels];
  }, [levels, pattern, barCount]);

  const clipStyle = useAnimatedStyle(() => ({
    width: (progressValue?.value ?? 1) * measuredWidth,
  }));

  // Recording, or any context without a playhead: one row, all lit.
  if (!progressValue) {
    return <BarRow bars={bars} height={height} color={activeColor} />;
  }

  return (
    <View
      style={[styles.stack, { height }]}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      pointerEvents="none"
    >
      <BarRow bars={bars} height={height} color={inactiveColor} />
      {measuredWidth > 0 ? (
        <Animated.View style={[styles.clip, clipStyle]}>
          <BarRow bars={bars} height={height} color={activeColor} width={measuredWidth} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  stack: {
    alignSelf: 'stretch',
    position: 'relative',
  },
  clip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});
