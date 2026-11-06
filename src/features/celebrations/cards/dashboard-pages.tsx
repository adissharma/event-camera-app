import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { colours, easing, fontFamilies, layout, spacing, useMotion } from '@/design';

export interface DashboardPagesProps {
  /** The first page, which fills the screen. */
  children: ReactNode;
  /** The albums, under the second page's title. */
  previous: ReactNode;
  /** The height of the header floating over both pages. */
  headerHeight: number;
}

/** The hint's full height, for the first page to keep its content clear of. */
export const DASHBOARD_HINT_HEIGHT = 52;

/** How much of the screen a drag has to cover to carry on to the other page. */
const SNAP_SHARE = 0.12;
/** A flick faster than this changes page, whatever the distance. */
const FLICK_VELOCITY = 400;

const BOUNCE_HEIGHT = 6;
const BOUNCE_MS = 260;
const BOUNCE_REST_MS = 3200;

/** Clear of the home indicator on phones that have one. */
function hintBottom(insetBottom: number): number {
  return Math.max(insetBottom, spacing.base);
}

/** What the first page has to leave free at its foot for the hint. */
export function dashboardHintClearance(insetBottom: number): number {
  return hintBottom(insetBottom) + DASHBOARD_HINT_HEIGHT + spacing.xs;
}

function Chevron({ direction }: { direction: 'up' | 'down' }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d={direction === 'up' ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'}
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The dashboard as two pages stacked vertically, a screen apart. Dragging up from
 * the first snaps to the second, and dragging down from the top of the second's
 * list snaps back. Left and right are left free for whatever the first page holds.
 */
export function DashboardPages({ children, previous, headerHeight }: DashboardPagesProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const durationMs = motion.duration('standardSlow');

  const [isOnPrevious, setIsOnPrevious] = useState(false);
  const offset = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const startedOnPrevious = useSharedValue(false);
  const movesPage = useSharedValue(false);
  const scrollY = useSharedValue(0);
  const bounce = useSharedValue(0);

  // A vertical swipe is never a tap, even if it ends where the page started. Only
  // a list that actually scrolls cancels the press beneath the finger, and these
  // pages can move without one, so the root takes the touch from whatever pressable
  // holds it. That covers everything on both pages without each having to know.
  const isVerticalSwipe = useRef(false);
  const setIsVerticalSwipe = useCallback((value: boolean) => {
    isVerticalSwipe.current = value;
  }, []);

  const settle = useCallback(
    (previousPage: boolean) => {
      setIsOnPrevious(previousPage);
      offset.value = withTiming(previousPage ? -screenHeight : 0, {
        duration: durationMs,
        easing: easing.standard,
      });
    },
    [durationMs, offset, screenHeight],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const scroll = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        // A sideways swipe belongs to the events on the first page.
        .failOffsetX([-12, 12])
        .simultaneousWithExternalGesture(scroll)
        .onStart((event) => {
          scheduleOnRN(setIsVerticalSwipe, true);
          dragStart.value = offset.value;
          startedOnPrevious.value = offset.value <= -screenHeight / 2;
          // Decided once, for the whole swipe. Upwards from the first page, or
          // downwards from the top of the list. Anything else scrolls the list,
          // even if that carries it to its top: only a fresh swipe goes back.
          movesPage.value = startedOnPrevious.value
            ? scrollY.value <= 0 && event.translationY > 0
            : event.translationY < 0;
        })
        .onChange((event) => {
          if (!movesPage.value) return;
          offset.value = Math.min(Math.max(dragStart.value + event.translationY, -screenHeight), 0);
        })
        .onEnd((event) => {
          if (!movesPage.value) return;
          const threshold = screenHeight * SNAP_SHARE;
          const carriesOn = startedOnPrevious.value
            ? event.translationY > threshold || event.velocityY > FLICK_VELOCITY
            : event.translationY < -threshold || event.velocityY < -FLICK_VELOCITY;
          scheduleOnRN(settle, startedOnPrevious.value !== carriesOn);
        })
        .onFinalize(() => {
          scheduleOnRN(setIsVerticalSwipe, false);
        }),
    [
      dragStart,
      movesPage,
      offset,
      screenHeight,
      scroll,
      scrollY,
      setIsVerticalSwipe,
      settle,
      startedOnPrevious,
    ],
  );

  // A short double hop, then a long rest: enough to be noticed without nagging.
  // Only while the screen is in view, and never under reduce-motion.
  const { reduceMotion } = motion;
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      const hop = (height: number) =>
        withSequence(
          withTiming(-height, { duration: BOUNCE_MS, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: BOUNCE_MS, easing: Easing.in(Easing.quad) }),
        );
      bounce.value = withRepeat(
        withDelay(BOUNCE_REST_MS, withSequence(hop(BOUNCE_HEIGHT), hop(BOUNCE_HEIGHT / 2))),
        -1,
        false,
      );
      return () => {
        cancelAnimation(bounce);
        bounce.value = 0;
      };
    }, [bounce, reduceMotion]),
  );

  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [-screenHeight * 0.2, 0], [0, 1], 'clamp'),
    transform: [{ translateY: bounce.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={S.root}
        onMoveShouldSetResponderCapture={() => isVerticalSwipe.current}
      >
        <Animated.View style={[S.pages, { height: screenHeight * 2 }, pagesStyle]}>
          <View
            style={{ height: screenHeight }}
            accessibilityElementsHidden={isOnPrevious}
            importantForAccessibility={isOnPrevious ? 'no-hide-descendants' : 'auto'}
          >
            {children}
          </View>

          <View
            style={[S.previousPage, { height: screenHeight, paddingTop: headerHeight }]}
            accessibilityElementsHidden={!isOnPrevious}
            importantForAccessibility={isOnPrevious ? 'auto' : 'no-hide-descendants'}
          >
            <GestureDetector gesture={scroll}>
              <Animated.ScrollView
                scrollEnabled={isOnPrevious}
                bounces={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
              >
                <View style={S.previousHeader}>
                  <AppText variant="button" style={S.previousTitle} accessibilityRole="header">
                    Previous albums
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to current events"
                    onPress={() => settle(false)}
                    hitSlop={12}
                  >
                    <Chevron direction="down" />
                  </Pressable>
                </View>
                {previous}
              </Animated.ScrollView>
            </GestureDetector>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={isOnPrevious ? 'none' : 'box-none'}
          style={[S.hintWrap, { bottom: hintBottom(insets.bottom) }, hintStyle]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous albums"
            onPress={() => settle(true)}
            hitSlop={12}
            style={S.hint}
          >
            <Chevron direction="up" />
            <AppText variant="bodySmall" style={S.hintLabel}>
              Previous albums
            </AppText>
          </Pressable>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const S = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  pages: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  previousPage: {
    backgroundColor: '#000000',
  },
  previousHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
    paddingBottom: spacing.lg,
  },
  previousTitle: {
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.12,
    color: colours.textPrimary,
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    height: DASHBOARD_HINT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintLabel: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.textMedium,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
});
