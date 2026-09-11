import { useEffect, useRef } from 'react';
import { Animated as NativeAnimated, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/text';
import {
  colours,
  fontFamilies,
  layout,
  spacing,
  useMotion,
  REVEAL_TRACK_GRADIENT,
  REVEAL_TRACK_GRADIENT_START,
  REVEAL_TRACK_GRADIENT_END,
} from '@/design';

export type RevealTiming = 'immediately' | 'delayed';

/** Deliberately larger than a system switch — it is the screen's only control. */
const TRACK_WIDTH = 88;
const TRACK_HEIGHT = 46;
const THUMB_INSET = 5;
const THUMB_SIZE = TRACK_HEIGHT - THUMB_INSET * 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;

/**
 * The reveal-timing choice: now, or later.
 *
 * A custom control rather than `AppSwitch`, because the "later" state carries
 * the gradient and the platform `Switch` accepts only a flat track colour.
 * Everything else is borrowed — the same gradient family as the Create button
 * and the Guestbook chip, the same motion tokens, the same type scale.
 *
 * ── Why the gradient is an overlay ──
 *
 * Colour cannot be animated on the native thread, so cross-fading two track
 * colours would push a JS-driven animation onto every frame of the thumb's
 * travel. Instead the dark track is always painted and the gradient sits over
 * it at an animated opacity: opacity and transform both run natively, so the
 * whole transition stays off the JS thread.
 */
export function RevealTimingToggle({
  value,
  onChange,
  onDelayedLabelPress,
  wiggle = false,
}: {
  value: RevealTiming;
  onChange: (value: RevealTiming) => void;
  onDelayedLabelPress?: () => void;
  wiggle?: boolean;
}) {
  const motion = useMotion();
  const isDelayed = value === 'delayed';

  // One driver for everything: thumb position, gradient opacity and the two
  // labels' emphasis all read from it, so they can never disagree about which
  // state is showing mid-animation.
  const progress = useRef(new NativeAnimated.Value(isDelayed ? 1 : 0)).current;
  const wiggleX = useSharedValue(0);

  useEffect(() => {
    NativeAnimated.timing(progress, {
      toValue: isDelayed ? 1 : 0,
      duration: motion.duration('standardFast'),
      useNativeDriver: true,
    }).start();
  }, [isDelayed, motion, progress]);

  useEffect(() => {
    if (!wiggle || motion.reduceMotion) return;

    const step = (toValue: number) =>
      withTiming(toValue, {
        duration: 55,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      });

    wiggleX.set(withSequence(step(-4), step(4), step(-3), step(3), step(0)));
  }, [motion.reduceMotion, wiggle, wiggleX]);

  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wiggleX.get() }],
  }));

  const thumbStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, motion.translate(THUMB_TRAVEL)],
        }),
      },
    ],
  };

  return (
    <View style={S.row}>
      <Label
        text="Immediately"
        active={!isDelayed}
        progress={progress}
        // Emphasis runs opposite to `progress` for the left label.
        invert
        onPress={() => onChange('immediately')}
      />

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Add a delay before photos are revealed"
        accessibilityState={{ checked: isDelayed }}
        onPress={() => onChange(isDelayed ? 'immediately' : 'delayed')}
        // The control is 46pt tall; the slop brings the tappable area up to
        // the 44pt minimum in both axes with room to spare.
        hitSlop={10}
      >
        <Animated.View style={wiggleStyle}>
          <View style={S.track}>
            <NativeAnimated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
              <LinearGradient
                colors={REVEAL_TRACK_GRADIENT}
                start={REVEAL_TRACK_GRADIENT_START}
                end={REVEAL_TRACK_GRADIENT_END}
                style={StyleSheet.absoluteFill}
              />
            </NativeAnimated.View>

            <NativeAnimated.View style={[S.thumb, thumbStyle]} />
          </View>
        </Animated.View>
      </Pressable>

      <Label
        text="Add delay"
        active={isDelayed}
        progress={progress}
        onPress={onDelayedLabelPress ?? (() => onChange('delayed'))}
      />
    </View>
  );
}

/**
 * One side of the choice, tappable in its own right.
 *
 * Emphasis is opacity rather than a colour swap, for the same native-thread
 * reason as the track, and because fading between two weights of the same ink
 * reads as one label changing rather than two labels trading places.
 */
function Label({
  text,
  active,
  progress,
  invert = false,
  onPress,
}: {
  text: string;
  active: boolean;
  progress: NativeAnimated.Value;
  invert?: boolean;
  onPress: () => void;
}) {
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: invert ? [1, 0.45] : [0.45, 1],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={S.labelHit}
    >
      <NativeAnimated.View style={{ opacity }}>
        <AppText style={S.label}>{text}</AppText>
      </NativeAnimated.View>
    </Pressable>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  labelHit: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  /** Larger than the copy it replaced: these are the choice, not a caption. */
  label: {
    fontFamily: fontFamilies.textMedium,
    fontSize: 19,
    letterSpacing: -0.1,
    color: colours.textPrimary,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colours.surfaceRaised,
    justifyContent: 'center',
    padding: THUMB_INSET,
    // Keeps the gradient inside the pill rather than square at its corners.
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#EFE9E0',
  },
});
