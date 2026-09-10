import { useCallback, useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  measure,
  useAnimatedRef,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colours, MOMENTS_SLIDER_GRADIENT, useMotion } from '@/design';
import {
  MOMENT_LIMIT_VALUES,
  momentLimitDotProgress,
  momentLimitIndex,
  momentLimitIndexForTrackPosition,
  momentLimitIndexAtDotProgress,
  type MomentLimit,
} from './stepped-slider-values';

export {
  MOMENT_LIMIT_VALUES,
  momentLimitDotProgress,
  momentLimitIndex,
  momentLimitIndexForTrackPosition,
  momentLimitIndexAtDotProgress,
  nearestMomentLimitIndex,
  type MomentLimit,
} from './stepped-slider-values';

const TRACK_HEIGHT = 54;
const DOT_RADIUS = 4;
const STEP_COUNT = MOMENT_LIMIT_VALUES.length - 1;

function fillProgressForIndex(index: number): number {
  'worklet';
  // Unlimited intentionally fills through the rounded end of the track.
  return index === STEP_COUNT ? 1 : momentLimitDotProgress(index);
}

export interface SteppedSliderProps {
  value: MomentLimit | undefined;
  onValueChange: (value: MomentLimit) => void;
}

/** Six-step, thumbless slider used for a guest's photo allowance. */
export function SteppedSlider({ value, onValueChange }: SteppedSliderProps) {
  const motion = useMotion();
  const initialIndex = momentLimitIndex(value);
  const progress = useSharedValue(fillProgressForIndex(initialIndex));
  const activeIndex = useSharedValue(initialIndex);
  const trackWidth = useSharedValue(0);
  const trackRef = useAnimatedRef<View>();

  const notifyValueChange = useCallback((index: number) => {
    const next = MOMENT_LIMIT_VALUES[index];
    if (next === undefined) return;
    onValueChange(next);
  }, [onValueChange]);

  const notifySliderSnap = useCallback((index: number) => {
    void Haptics.selectionAsync().catch(() => {});
    notifyValueChange(index);
  }, [notifyValueChange]);

  useEffect(() => {
    const index = momentLimitIndex(value);
    activeIndex.set(index);
    progress.set(withTiming(fillProgressForIndex(index), {
      duration: motion.duration('micro'),
    }));
  }, [activeIndex, motion, progress, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.get() * 100}%`,
  }));

  useAnimatedReaction(
    () => {
      const width = trackWidth.get();
      if (width <= 0) return -1;
      return momentLimitIndexAtDotProgress(
        progress.get(),
        activeIndex.get(),
        DOT_RADIUS / width,
      );
    },
    (nextIndex) => {
      if (nextIndex >= 0 && nextIndex !== activeIndex.get()) {
        activeIndex.set(nextIndex);
        scheduleOnRN(notifySliderSnap, nextIndex);
      }
    },
  );

  const setFromPosition = (localX: number, absoluteX: number, snap: boolean) => {
    'worklet';
    const trackLayout = measure(trackRef);
    const width = trackLayout?.width ?? trackWidth.get();
    if (width <= 0) return;

    // Gesture coordinates can be relative to a wrapper on some native
    // configurations. Deriving the point from the track's page position makes
    // every tap resolve against the visible pill itself.
    const x = trackLayout ? absoluteX - trackLayout.pageX : localX;
    const nextProgress = Math.max(0, Math.min(1, x / width));
    if (snap) {
      const nextIndex = momentLimitIndexForTrackPosition(x, width);
      progress.set(withSpring(fillProgressForIndex(nextIndex), {
        duration: 400,
        dampingRatio: 0.8,
      }));
      return;
    }

    progress.set(nextProgress);
  };

  const pan = Gesture.Pan()
    .minDistance(2)
    .onStart((event) => setFromPosition(event.x, event.absoluteX, false))
    .onUpdate((event) => setFromPosition(event.x, event.absoluteX, false))
    .onEnd((event) => setFromPosition(event.x, event.absoluteX, true));
  const tap = Gesture.Tap().onEnd((event) => setFromPosition(event.x, event.absoluteX, true));
  const gesture = Gesture.Simultaneous(pan, tap);

  const selectedIndex = momentLimitIndex(value);
  const adjustBy = (delta: number) => {
    const nextIndex = Math.max(0, Math.min(MOMENT_LIMIT_VALUES.length - 1, selectedIndex + delta));
    if (nextIndex !== selectedIndex) notifyValueChange(nextIndex);
  };

  function handleLayout(event: LayoutChangeEvent) {
    trackWidth.set(event.nativeEvent.layout.width);
  }

  return (
    <View style={{ width: '100%' }}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          ref={trackRef}
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
                  left: `${momentLimitDotProgress(index) * 100}%`,
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
    </View>
  );
}
