import { useEffect, useState, type ReactNode } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { easing, useMotion } from '@/design';

export interface ExpandingSectionProps {
  expanded: boolean;
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Discloses a block of settings with a combined height and fade.
 *
 * Height alone reads as the content being squeezed out of existence; fading it
 * across the same curve makes it read as arriving and leaving instead.
 *
 * The children stay mounted so their height can be measured while collapsed,
 * and are hidden from touch and from assistive tech in that state — a clipped
 * control is otherwise still reachable by a screen reader and by taps.
 */
export function ExpandingSection({ expanded, children, style }: ExpandingSectionProps) {
  const motion = useMotion();
  const progress = useSharedValue(expanded ? 1 : 0);
  const contentHeight = useSharedValue(0);
  const [isMeasured, setIsMeasured] = useState(false);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: motion.duration('standard'),
      easing: easing.inOut,
    });
  }, [expanded, progress, motion]);

  function handleLayout(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.height;
    // Content can reflow while open — a longer date string, a wrapped line —
    // so track the latest measurement rather than only the first.
    if (Math.abs(contentHeight.value - next) > 0.5) {
      contentHeight.value = next;
    }
    if (!isMeasured && next > 0) setIsMeasured(true);
  }

  const animatedStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={[
        { overflow: 'hidden' },
        animatedStyle,
        // Until the first measurement lands there is no height to interpolate
        // toward, so an open section holds its natural height rather than
        // collapsing to zero for a frame on mount.
        isMeasured ? null : { height: expanded ? undefined : 0 },
        style,
      ]}
      pointerEvents={expanded ? 'auto' : 'none'}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
    >
      {/*
       * Taken out of flow to be measured.
       *
       * A child of a `height: 0` parent is squashed by the layout engine, not
       * merely clipped by `overflow: hidden` — measuring it in flow reported 0
       * while collapsed, so the next expansion animated to a height of nothing.
       * Positioned absolutely it is free of the parent's height and always
       * reports its natural size.
       *
       * The exception is the first paint of a section that starts open: there
       * is no measurement yet, so it stays in flow for that one pass to give
       * the container a height, and moves out of flow once measured.
       */}
      <View
        onLayout={handleLayout}
        style={expanded && !isMeasured ? undefined : styles.measured}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  measured: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
