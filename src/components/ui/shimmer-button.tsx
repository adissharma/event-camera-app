import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { fontFamilies, radii, spacing, useMotion } from '@/design';

export interface ShimmerButtonProps {
  label: string;
  onPress: () => void;
}

/** One pass of the glint and the pause after it, as on the website's CTA. */
const CYCLE_MS = 3800;
/** The share of a cycle the rim spends turning. It rests for the remainder. */
const SPIN_SHARE = 0.45;
const SPIN_EASING = Easing.bezierFn(0.45, 0.05, 0.35, 1);

const RIM_WIDTH = 2;
/** Larger than the button's diagonal, so the corners never come into view. */
const SPINNER_SIZE = 360;

const INK = '#0B0B0C';

/** The website's rim, as `[degrees clockwise from the top, red, green, blue]`. */
const CONIC_STOPS = [
  [0, 0x5b, 0x35, 0xe8],
  [70, 0xa3, 0x29, 0xec],
  [130, 0xe5, 0x48, 0xcd],
  [165, 0xff, 0x8a, 0x98],
  [180, 0xff, 0xff, 0xff],
  [195, 0xff, 0x8a, 0x98],
  [230, 0xe5, 0x48, 0xcd],
  [290, 0xa3, 0x29, 0xec],
  [360, 0x5b, 0x35, 0xe8],
] as const;

function conicColourAt(degrees: number): string {
  const end = CONIC_STOPS.findIndex(([stop]) => stop >= degrees);
  const to = CONIC_STOPS[Math.max(end, 1)];
  const from = CONIC_STOPS[Math.max(end, 1) - 1];
  const mix = (degrees - from[0]) / (to[0] - from[0]);
  const channel = (index: 1 | 2 | 3) => Math.round(from[index] + (to[index] - from[index]) * mix);
  return `rgb(${channel(1)}, ${channel(2)}, ${channel(3)})`;
}

/**
 * SVG has no conic gradient, so the rim is drawn as thin solid wedges. Only a
 * sliver of it ever shows, which hides the steps. Each wedge runs slightly into
 * the next so anti-aliasing cannot open a seam between them.
 */
const CONIC_WEDGES = Array.from({ length: 120 }, (_, index) => {
  const radius = SPINNER_SIZE / 2;
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return `${radius + radius * Math.sin(radians)} ${radius - radius * Math.cos(radians)}`;
  };
  const start = index * 3;
  return {
    d: `M${radius} ${radius}L${point(start)}L${point(start + 3.6)}Z`,
    fill: conicColourAt(start + 1.5),
  };
});

/**
 * The website's "Create your event" button: a white pill whose violet-to-pink
 * rim is a square turning behind it, so the animation only moves one layer.
 */
export function ShimmerButton({ label, onPress }: ShimmerButtonProps) {
  const { reduceMotion } = useMotion();
  const clock = useSharedValue(0);

  // Only while the screen is in view: the rim is decoration, and the screen
  // stays mounted underneath everything opened from it.
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      clock.value = withRepeat(
        withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
        -1,
        false,
      );
      return () => {
        cancelAnimation(clock);
        clock.value = 0;
      };
    }, [clock, reduceMotion]),
  );

  const spinStyle = useAnimatedStyle(() => {
    // Clamped at both ends: Reanimated does not clamp elapsed time, so a frame
    // stamped just before the loop restarted reads as slightly below zero.
    const progress = Math.max(0, Math.min(clock.value / SPIN_SHARE, 1));
    return { transform: [{ rotate: `${SPIN_EASING(progress) * 360}deg` }] };
  });

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(clock.value, [0, 0.24, 0.5, 1], [0, 0.7, 0, 0], 'clamp'),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && S.pressed}
    >
      <Animated.View style={[S.glow, glowStyle]}>
        <View style={S.clip}>
          <Animated.View pointerEvents="none" style={[S.spinner, spinStyle]}>
            <Svg width={SPINNER_SIZE} height={SPINNER_SIZE}>
              {CONIC_WEDGES.map((wedge) => (
                <Path key={wedge.d} d={wedge.d} fill={wedge.fill} />
              ))}
            </Svg>
          </Animated.View>
          <View pointerEvents="none" style={S.face} />

          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 5v14M5 12h14"
              stroke={INK}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <AppText variant="button" style={S.label}>
            {label}
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const S = StyleSheet.create({
  pressed: { opacity: 0.9 },
  glow: {
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    shadowColor: '#E548CD',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 13,
    shadowOpacity: 0,
  },
  clip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 58,
    paddingLeft: 24,
    paddingRight: 28,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  spinner: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    marginLeft: -SPINNER_SIZE / 2,
    marginTop: -SPINNER_SIZE / 2,
  },
  face: {
    position: 'absolute',
    top: RIM_WIDTH,
    right: RIM_WIDTH,
    bottom: RIM_WIDTH,
    left: RIM_WIDTH,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.09,
    color: INK,
  },
});
