import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colours, useMotion } from '@/design';
import {
  FACET_OPACITIES,
  facetPaths,
  hangerOpacity,
  LOOP_MS,
  TWINKLE_OPACITIES,
} from './empty-events-mark-geometry';

export interface EmptyEventsMarkProps {
  size?: number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

const INK = colours.textSecondary;
const TWINKLE = '#FFFFFF';

function FacetGroup({
  paths,
  index,
  fill,
  opacity,
}: {
  paths: SharedValue<string[]>;
  index: number;
  fill: string;
  opacity: number;
}) {
  const animatedProps = useAnimatedProps(() => ({ d: paths.value[index] }));
  return <AnimatedPath animatedProps={animatedProps} fill={fill} opacity={opacity} />;
}

/** The ball's string and fixing, which only the ball has any use for. */
function Hanger({ clock }: { clock: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({ opacity: hangerOpacity(clock.value) }));

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d="M100 2 V38 M95 38 H105"
      stroke={INK}
      strokeWidth={3.4}
      strokeLinecap="round"
    />
  );
}

/**
 * The empty dashboard's mark: a spinning disco ball with twinkling mirrors, which
 * turns into things from every kind of event, then back again. They are listed in
 * `empty-events-mark-geometry`.
 */
export function EmptyEventsMark({ size = 168 }: EmptyEventsMarkProps) {
  const { reduceMotion } = useMotion();
  const clock = useSharedValue(0);
  const paths = useDerivedValue(() => facetPaths(clock.value));

  // Only while the screen is in view: this is decoration, and the screen stays
  // mounted underneath everything opened from it.
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      clock.value = withRepeat(
        withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
        -1,
        false,
      );
      return () => {
        cancelAnimation(clock);
        // A repeat loops back to wherever it started, so it has to start at zero.
        clock.value = 0;
      };
    }, [clock, reduceMotion]),
  );

  return (
    <Svg
      width={size}
      height={(size * 160) / 200}
      viewBox="0 0 200 160"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Hanger clock={clock} />

      {FACET_OPACITIES.map((opacity, index) => (
        <FacetGroup key={index} paths={paths} index={index} fill={INK} opacity={opacity} />
      ))}
      {TWINKLE_OPACITIES.map((opacity, level) => (
        <FacetGroup
          key={`twinkle-${level}`}
          paths={paths}
          index={FACET_OPACITIES.length + level}
          fill={TWINKLE}
          opacity={opacity}
        />
      ))}
    </Svg>
  );
}
