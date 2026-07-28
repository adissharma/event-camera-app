import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colours, easing, layout, useMotion } from '@/design';

export interface ProgressThreadProps {
  /** 1-based position. */
  current: number;
  total: number;
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
 * entire point; re-mounting it per screen would destroy the effect even though
 * the pixels would look identical at rest.
 */
export function ProgressThread({ current, total }: ProgressThreadProps) {
  const motion = useMotion();
  const progress = useSharedValue(0);
  const target = Math.min(1, Math.max(0, current / total));
  const durationMs = motion.duration('standardSlow');

  useEffect(() => {
    progress.value = withTiming(target, {
      duration: durationMs,
      easing: easing.standard,
    });

    // Guaranteed settle — the same protection as `Reveal`. A thread stuck at
    // zero would misreport how far through the flow the host actually is.
    const settle = setTimeout(() => {
      progress.value = target;
    }, durationMs + 250);

    return () => clearTimeout(settle);
  }, [progress, target, durationMs]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
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
