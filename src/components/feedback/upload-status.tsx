import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { spacing, useMotion } from '@/design';

export type UploadPhase = 'processing' | 'uploading' | 'complete';
export type UploadMediaType = 'photo' | 'video' | 'audio';

export interface UploadStatusProps {
  phase: UploadPhase;
  mediaType: UploadMediaType;
}

const RING_SIZE = 56;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SPIN_MS = 900;
/** Long enough that a normal upload never shows it. */
const SLOW_UPLOAD_MS = 5000;

const nounFor = (mediaType: UploadMediaType) => (mediaType === 'audio' ? 'message' : mediaType);

/**
 * Covers the screen while something posts, so a guest can't tap away from it.
 *
 * One message throughout: the upload's stages are ours, and naming each one
 * only makes a two-second wait flicker. The store reports no progress, so this
 * is a spinner rather than a bar that would have to invent its numbers.
 */
export function UploadStatus({ phase, mediaType }: UploadStatusProps) {
  const { reduceMotion } = useMotion();
  const isDone = phase === 'complete';
  const label = isDone ? 'Posted' : `Posting your ${nounFor(mediaType)}`;

  const [fade] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [spin] = useState(() => new Animated.Value(0));
  const [tick] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.7));

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [fade, reduceMotion]);

  useEffect(() => {
    if (isDone || reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isDone, reduceMotion, spin]);

  useEffect(() => {
    if (!isDone || reduceMotion) return;
    Animated.spring(tick, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [isDone, reduceMotion, tick]);

  // Only said once it is worth saying, and only while still uploading.
  const [isSlow, setIsSlow] = useState(false);
  const startedAt = useRef(Date.now());
  useEffect(() => {
    if (isDone) return;
    const timer = setTimeout(
      () => setIsSlow(true),
      Math.max(0, SLOW_UPLOAD_MS - (Date.now() - startedAt.current)),
    );
    return () => clearTimeout(timer);
  }, [isDone]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      accessible
      accessibilityViewIsModal
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={[S.root, { opacity: fade }]}
    >
      <View style={S.ring}>
        {isDone ? (
          <Animated.View style={{ transform: [{ scale: tick }] }}>
            <Svg width={RING_SIZE} height={RING_SIZE} viewBox="0 0 56 56" fill="none">
              <Circle cx={28} cy={28} r={RING_RADIUS} fill="#FFFFFF" />
              <Path
                d="M19 28.5l6.5 6.5L37.5 22"
                stroke="#0B0B0C"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        ) : (
          <>
            <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill} fill="none">
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="rgba(255, 255, 255, 0.16)"
                strokeWidth={RING_STROKE}
              />
            </Svg>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Svg width={RING_SIZE} height={RING_SIZE} fill="none">
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="#FFFFFF"
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${RING_CIRCUMFERENCE * 0.26} ${RING_CIRCUMFERENCE}`}
                />
              </Svg>
            </Animated.View>
          </>
        )}
      </View>

      <AppText variant="titleMedium" align="center" style={S.label}>
        {label}
      </AppText>
      {/* Space kept for it, so the label doesn't jump when it appears. */}
      <AppText variant="bodySmall" align="center" style={[S.hint, !(isSlow && !isDone) && S.hintHidden]}>
        Keep this screen open
      </AppText>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    // Above the page even when rendered from inside a scrolling web layout.
    ...(Platform.OS === 'web' ? ({ position: 'fixed' } as unknown as ViewStyle) : null),
    zIndex: 500,
    elevation: 500,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(8, 8, 9, 0.78)',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: spacing.base,
  },
  label: { color: '#FFFFFF' },
  hint: { color: 'rgba(255, 255, 255, 0.64)' },
  hintHidden: { opacity: 0 },
});
