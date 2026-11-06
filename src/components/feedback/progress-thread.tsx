import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  makeMutable,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { colours, easing, layout, useMotion } from '@/design';

export interface ProgressThreadProps {
  /** 1-based position. */
  current: number;
  total: number;
}

/**
 * How far along the journey the thread is, shared by every step.
 *
 * Each step is its own route and mounts its own thread, so a value owned by the
 * component would start every step from zero, and the line would snap left
 * before filling. With one value, a new step's first frame is exactly where the
 * last step's thread stopped.
 *
 * Written only from the plain functions below: the React Compiler miscompiles
 * hooks that mutate module-level state.
 */
const threadProgress = makeMutable(0);

function animateThreadTo(target: number, durationMs: number): void {
  threadProgress.value = withTiming(target, {
    duration: durationMs,
    easing: easing.standard,
  });
}

function settleThreadAt(target: number): void {
  threadProgress.value = target;
}

/**
 * The connecting thread.
 *
 * This is the one visual motif that persists across every step of creation. It
 * is the principle borrowed from the MindMarket audit — one element that
 * carries continuity and changes state, rather than each screen arriving
 * unrelated to the last. It is deliberately NOT a segmented progress bar:
 * segments read as bureaucracy, a single line reads as a journey.
 *
 * It never disappears and reappears between steps. That continuity is the
 * entire point, which is why its position lives outside any one step's thread.
 */
export function ProgressThread({ current, total }: ProgressThreadProps) {
  const motion = useMotion();
  const target = Math.min(1, Math.max(0, current / total));
  const durationMs = motion.duration('standardSlow');

  // On focus rather than on mount, because stepping back returns to a screen
  // that never unmounted, and the thread still has to follow it.
  useFocusEffect(
    useCallback(() => {
      animateThreadTo(target, durationMs);

      // Guaranteed settle — the same protection as `Reveal`. A thread stuck
      // short would misreport how far through the flow the host actually is.
      const settle = setTimeout(() => settleThreadAt(target), durationMs + 250);

      return () => clearTimeout(settle);
    }, [target, durationMs]),
  );

  // The first step stays mounted for the whole journey, so its unmount means
  // the host has left, and the next event starts from an empty line.
  const isFirstStep = current === 1;
  useEffect(() => {
    if (!isFirstStep) return;
    return () => settleThreadAt(0);
  }, [isFirstStep]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${threadProgress.value * 100}%`,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
      accessibilityLabel={`Step ${current} of ${total}`}
      style={{
        height: 2,
        backgroundColor: colours.borderSubtle,
        borderRadius: layout.hairline,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          { height: '100%', backgroundColor: colours.brandPrimary, borderRadius: layout.hairline },
          fillStyle,
        ]}
      />
    </View>
  );
}
