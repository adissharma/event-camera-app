import { useEffect, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { easing, useMotion } from '@/design';
import type { DurationToken } from '@/design';

export interface RevealProps {
  children: ReactNode;
  /** Position in a staggered group. Drives the delay. */
  index?: number;
  /** Milliseconds between staggered items. */
  step?: number;
  /** Distance travelled upward on entry, in points. */
  distance?: number;
  duration?: DurationToken;
  style?: ViewStyle;
}

/**
 * Mount reveal: a brief fade with a small upward translation.
 *
 * Deliberately implemented with `useAnimatedStyle` rather than Reanimated's
 * `entering=` layout animations. On React Native Web the layout-animation path
 * takes the element out of normal flow for the duration of the transition,
 * which collapses any parent that is sized by its children — the parent ends up
 * at padding height and its content overflows. Driving opacity and transform
 * directly keeps the element in flow on every platform, and behaves identically
 * on iOS and Android.
 *
 * Under reduce-motion the translation is dropped and the duration collapses to
 * a single brief fade, so the "something new arrived" meaning survives without
 * movement.
 */
export function Reveal({
  children,
  index = 0,
  step = 45,
  distance = 12,
  duration = 'standardSlow',
  style,
}: RevealProps) {
  const motion = useMotion();
  const progress = useSharedValue(0);

  // All three are resolved to primitives on the JS thread.
  //
  // `useAnimatedStyle` runs as a worklet on the UI thread and cannot call back
  // into an ordinary JS closure such as `motion.translate`.
  //
  // Just as importantly, the effect below depends on these numbers rather than
  // on the `motion` object. Depending on the object restarts the timing on
  // every render that produces a new identity, which strands the animation a
  // couple of percent in and looks like a frozen, invisible element.
  const travel = motion.translate(distance);
  const delayMs = motion.staggerDelay(index, step);
  const durationMs = motion.duration(duration);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: durationMs, easing: easing.standard }),
    );

    // Guaranteed settle.
    //
    // Content must never be invisible because an animation failed to run. If
    // the timing clock has not reached the end by the time it should have —
    // observed under React Native Web, but equally possible on a device that
    // drops the animation frame loop while backgrounded — snap to the final
    // state. An entrance animation is an enhancement; legibility is not.
    const settle = setTimeout(() => {
      progress.value = 1;
    }, delayMs + durationMs + 250);

    return () => clearTimeout(settle);
  }, [progress, delayMs, durationMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * travel }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
