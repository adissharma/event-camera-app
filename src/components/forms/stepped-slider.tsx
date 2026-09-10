import { useCallback, useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui/text';
import { colours, MOMENTS_SLIDER_GRADIENT, spacing, useMotion } from '@/design';
import {
  MOMENT_LIMIT_VALUES,
  momentLimitIndex,
  nearestMomentLimitIndex,
  type MomentLimit,
} from './stepped-slider-values';

export { MOMENT_LIMIT_VALUES, momentLimitIndex, nearestMomentLimitIndex, type MomentLimit } from './stepped-slider-values';

const TRACK_HEIGHT = 54;
const DOT_INSET_PERCENT = 7;

export interface SteppedSliderProps {
  value: MomentLimit | undefined;
  onValueChange: (value: MomentLimit) => void;
}

/** Six-step, thumbless slider used for a guest's photo allowance. */
export function SteppedSlider({ value, onValueChange }: SteppedSliderProps) {
  const motion = useMotion();
  const initialIndex = momentLimitIndex(value);
  const progress = useSharedValue(initialIndex / (MOMENT_LIMIT_VALUES.length - 1));
  const activeIndex = useSharedValue(initialIndex);
  const trackWidth = useSharedValue(0);

  const notifyChange = useCallback((index: number) => {
    const next = MOMENT_LIMIT_VALUES[index];
    if (next === undefined) return;
    void Haptics.selectionAsync().catch(() => {});
    onValueChange(next);
  }, [onValueChange]);

  useEffect(() => {
    const index = momentLimitIndex(value);
    activeIndex.set(index);
    progress.set(withTiming(index / (MOMENT_LIMIT_VALUES.length - 1), {
      duration: motion.duration('micro'),
    }));
  }, [activeIndex, motion, progress, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.get() * 100}%`,
  }));

  const setFromX = (x: number, snap: boolean) => {
    'worklet';
    const width = trackWidth.get();
    if (width <= 0) return;

    const nextProgress = Math.max(0, Math.min(1, x / width));
    const nextIndex = nearestMomentLimitIndex(nextProgress);
    progress.set(
      snap
        ? withSpring(nextIndex / (MOMENT_LIMIT_VALUES.length - 1), {
            duration: 400,
            dampingRatio: 0.8,
          })
        : nextProgress,
    );

    if (nextIndex !== activeIndex.get()) {
      activeIndex.set(nextIndex);
      scheduleOnRN(notifyChange, nextIndex);
    }
  };

  const pan = Gesture.Pan()
    .minDistance(2)
    .onBegin((event) => setFromX(event.x, false))
    .onUpdate((event) => setFromX(event.x, false))
    .onEnd((event) => setFromX(event.x, true));
  const tap = Gesture.Tap().onEnd((event) => setFromX(event.x, true));
  const gesture = Gesture.Simultaneous(pan, tap);

  const selectedIndex = momentLimitIndex(value);
  const adjustBy = (delta: number) => {
    const nextIndex = Math.max(0, Math.min(MOMENT_LIMIT_VALUES.length - 1, selectedIndex + delta));
    if (nextIndex !== selectedIndex) notifyChange(nextIndex);
  };

  function handleLayout(event: LayoutChangeEvent) {
    trackWidth.set(event.nativeEvent.layout.width);
  }

  return (
    <View style={{ width: '100%', gap: spacing.sm }}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Moments allowed per guest"
          accessibilityValue={{
            min: 5,
            max: 36,
            now: value === null || value === undefined ? 36 : value,
            text: value === null || value === undefined ? 'Unlimited' : `${value} photos`,
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => adjustBy(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          onLayout={handleLayout}
          style={{ height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, overflow: 'hidden', backgroundColor: colours.surfaceRaised, justifyContent: 'center' }}
        >
          <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' }, fillStyle]}>
            <LinearGradient colors={MOMENTS_SLIDER_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
          {MOMENT_LIMIT_VALUES.map((item, index) => {
            const isPast = index <= selectedIndex;
            return (
              <View
                key={String(item)}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: `${DOT_INSET_PERCENT + (index / (MOMENT_LIMIT_VALUES.length - 1)) * (100 - DOT_INSET_PERCENT * 2)}%`,
                  marginLeft: -4,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isPast ? colours.textPrimary : 'rgba(245, 242, 237, 0.48)',
                }}
              />
            );
          })}
        </Animated.View>
      </GestureDetector>

      <View style={{ height: 18, position: 'relative' }} pointerEvents="none">
        {MOMENT_LIMIT_VALUES.map((item, index) => (
          <AppText
            key={String(item)}
            variant="caption"
            tone={index === selectedIndex ? 'primary' : 'secondary'}
            style={{
              position: 'absolute',
              left: `${DOT_INSET_PERCENT + (index / (MOMENT_LIMIT_VALUES.length - 1)) * (100 - DOT_INSET_PERCENT * 2)}%`,
              width: 32,
              marginLeft: -16,
              textAlign: 'center',
            }}
          >
            {item === null ? '∞' : item}
          </AppText>
        ))}
      </View>
    </View>
  );
}
