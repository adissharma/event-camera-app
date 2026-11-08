import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { EventGlass, EVENT_GLASS_RADIUS } from '@/components/ui/event-glass';
import { colours, easing, radii, spacing, useMotion } from '@/design';

export interface PreviousAlbumsSheetProps {
  count: number;
  children: ReactNode;
}

/**
 * How much of the sheet shows when closed, above the home indicator: the handle
 * and the very top of the first album's photos.
 */
export const PREVIOUS_ALBUMS_PEEK = 44;

/** A flick faster than this decides the direction, whatever the distance. */
const FLICK_VELOCITY = 500;

/**
 * The host's past albums, peeking up from the bottom of the dashboard.
 *
 * Tapping it or dragging it up opens it over the screen. Once open, the list
 * scrolls, and dragging down from the top of the list closes it again.
 */
export function PreviousAlbumsSheet({ count, children }: PreviousAlbumsSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const durationMs = motion.duration('standardSlow');

  const sheetHeight = screenHeight - insets.top - spacing.base;
  const closedY = sheetHeight - PREVIOUS_ALBUMS_PEEK - insets.bottom;

  const [isOpen, setIsOpen] = useState(false);
  const openOffset = useSharedValue(closedY);
  const dragStart = useSharedValue(closedY);
  const scrollY = useSharedValue(0);
  const startedOpen = useSharedValue(false);
  const movesSheet = useSharedValue(true);

  const settle = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      openOffset.value = withTiming(open ? 0 : closedY, {
        duration: durationMs,
        easing: easing.standard,
      });
    },
    [closedY, durationMs, openOffset],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const scroll = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-16, 16])
        .simultaneousWithExternalGesture(scroll)
        .onStart(() => {
          dragStart.value = openOffset.value;
          startedOpen.value = openOffset.value <= 0;
          // Decided once, for the whole swipe. One that starts with the list
          // scrolled is scrolling the list, even if it carries the list to its
          // top: only a fresh swipe from the top may then close the sheet.
          movesSheet.value = !startedOpen.value || scrollY.value <= 0;
        })
        .onChange((event) => {
          if (!movesSheet.value) return;
          // Pushing up from the top scrolls the list, and coming back down within
          // the same swipe returns it. The sheet joins in only once it is at the top.
          if (scrollY.value > 0) {
            dragStart.value = openOffset.value - event.translationY;
            return;
          }
          openOffset.value = Math.min(
            Math.max(dragStart.value + event.translationY, 0),
            closedY,
          );
        })
        .onEnd((event) => {
          // Nothing to settle if the sheet never left the top. A flick here is
          // the list's own, so velocity must not be read as a request to close.
          if (!movesSheet.value || (startedOpen.value && openOffset.value <= 0)) return;
          const open =
            Math.abs(event.velocityY) > FLICK_VELOCITY
              ? event.velocityY < 0
              : openOffset.value < closedY / 2;
          scheduleOnRN(settle, open);
        }),
    [closedY, dragStart, movesSheet, openOffset, scroll, scrollY, settle, startedOpen],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: openOffset.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openOffset.value, [0, closedY], [1, 0], 'clamp'),
  }));

  return (
    <>
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, S.scrim, scrimStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close previous albums"
          onPress={() => settle(false)}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[S.sheet, { height: sheetHeight }, sheetStyle]}>
          <EventGlass />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Previous albums, ${count}`}
            accessibilityState={{ expanded: isOpen }}
            onPress={() => settle(!isOpen)}
            style={S.header}
          >
            <View style={S.handle} />
          </Pressable>

          <View style={S.body}>
            {/*
              React Native's own scroll view, not Gesture Handler's: that one adds
              a scroll gesture of its own which blocks the sheet's drag on the list.
            */}
            <GestureDetector gesture={scroll}>
              <Animated.ScrollView
                scrollEnabled={isOpen}
                bounces={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
                // Closed, the albums are only a preview of what opening shows.
                pointerEvents={isOpen ? 'auto' : 'none'}
              >
                {children}
              </Animated.ScrollView>
            </GestureDetector>

            {isOpen ? null : (
              <Pressable
                accessibilityElementsHidden
                importantForAccessibility="no"
                onPress={() => settle(true)}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const S = StyleSheet.create({
  scrim: { backgroundColor: colours.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: EVENT_GLASS_RADIUS,
    borderTopRightRadius: EVENT_GLASS_RADIUS,
    overflow: 'hidden',
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colours.textSecondary,
    opacity: 0.5,
  },
  body: { flex: 1 },
});
