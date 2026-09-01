import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { PanGestureHandler } from 'react-native-gesture-handler';

import { DeviceFrame } from '@/components/media/device-frame';
import { CloseIcon } from '@/components/ui/icons';
import { GuestCoverPreview, parseCoverTheme } from './guest-cover-preview';
import { colours, easing, spacing, useMotion } from '@/design';
import type { CreationDraft } from '../draft/types';
import type { ThemeRow } from '@/types/database';

export interface ThemeCarouselProps {
  draft: CreationDraft;
  themes: ThemeRow[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

/**
 * Horizontally swiped theme picker built from live cover previews.
 *
 * The card is deliberately narrower than the screen so the next theme peeks in
 * from the right. That peek is the entire discovery mechanism — without it a
 * host has no reason to suspect the cover swipes at all, and a row of theme
 * name chips would be a weaker version of the same information.
 */
export function ThemeCarousel({
  draft,
  themes,
  selectedSlug,
  onSelect,
}: ThemeCarouselProps) {
  const { width } = useWindowDimensions();
  const motion = useMotion();
  const selectedIndex = Math.max(
    0,
    themes.findIndex((theme) => theme.slug === selectedSlug),
  );
  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(selectedIndex);
  const selectedSlugRef = useRef<string | null>(selectedSlug);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  /**
   * Measured height of the carousel row.
   *
   * The card has to be sized from the space available VERTICALLY, not from the
   * screen width. A phone frame is 19.5:9, so a width-derived card is more than
   * twice as tall as it is wide and simply overflowed — the frame was clipped at
   * the notch and the guest's join button was cut off the bottom.
   */
  const [rowHeight, setRowHeight] = useState(0);

  const gap = spacing.base;
  const DEVICE_RATIO = 19.5 / 9;

  // Fit to height first, then cap the width so a short, wide screen still
  // leaves the next card peeking rather than filling the viewport.
  //
  // Backed off a further 8% from that fit — a subtle reduction, not a
  // redesign — so the row leaves a bit more breathing room around the dots,
  // the CTAs and the rest of the screen instead of using every available
  // pixel of height.
  const PHONE_SHRINK = 0.92;
  const heightDerivedWidth = rowHeight > 0 ? Math.floor((rowHeight / DEVICE_RATIO) * PHONE_SHRINK) : 0;
  const cardWidth = Math.max(140, Math.min(heightDerivedWidth || 200, Math.round(width * 0.62)));
  // The dots below already signal that more themes exist, so the next card only
  // needs a gentle peek. A small offset keeps the phone optically centred
  // without letting the neighbour pull it as far left as the old layout did.
  const sidePadding = Math.max(
    spacing.base,
    Math.round((width - cardWidth) / 2) - Math.round(cardWidth * 0.12),
  );
  const snapInterval = cardWidth + gap;

  function handleRowLayout(event: LayoutChangeEvent) {
    const measured = Math.floor(event.nativeEvent.layout.height);
    if (measured > 0 && measured !== rowHeight) setRowHeight(measured);
  }

  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (selectedIndex !== activeIndexRef.current) {
      setActiveIndex(selectedIndex);
      activeIndexRef.current = selectedIndex;
      scrollRef.current?.scrollTo({ x: selectedIndex * snapInterval, animated: false });
    }
  }, [selectedIndex, snapInterval]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    selectedSlugRef.current = selectedSlug;
  }, [selectedSlug]);

  const nudge = useSharedValue(0);

  /**
   * A single nudge on every arrival, never a loop.
   *
   * A permanently bouncing card reads as broken within about ten seconds, and
   * the motion system forbids looping decoration outright. Two gentle cycles
   * say "this moves" and then stop. Suppressed entirely under reduce-motion,
   * where a repeating horizontal translation is exactly the pattern that
   * triggers people.
   */
  useFocusEffect(
    useCallback(() => {
      nudge.value = 0;
      if (motion.reduceMotion || themes.length < 2) return;

      const travel = -14;
      const step = (to: number, duration: number) =>
        withTiming(to, { duration, easing: easing.inOut });

      nudge.value = withDelay(
        600,
        withSequence(step(travel, 260), step(0, 260), step(travel * 0.6, 200), step(0, 220)),
      );

      const settle = setTimeout(() => {
        nudge.value = 0;
      }, 600 + 260 + 260 + 200 + 220 + 250);

      return () => {
        clearTimeout(settle);
        cancelAnimation(nudge);
        nudge.value = 0;
      };
    }, [motion.reduceMotion, nudge, themes.length]),
  );

  const nudgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }],
  }));

  function clampIndex(index: number) {
    return Math.max(0, Math.min(themes.length - 1, index));
  }

  function selectIndex(index: number) {
    const theme = themes[index];
    if (!theme) return;

    if (index !== activeIndexRef.current) {
      activeIndexRef.current = index;
      setActiveIndex(index);
      void Haptics.selectionAsync().catch(() => {});
    }

    if (theme.slug !== selectedSlugRef.current) {
      selectedSlugRef.current = theme.slug;
      onSelect(theme.slug);
    }
  }

  function nearestIndex(event: NativeSyntheticEvent<NativeScrollEvent>) {
    return clampIndex(Math.round(event.nativeEvent.contentOffset.x / snapInterval));
  }

  // Deliberately not driven by `onScroll`: recomputing the active card on every
  // scroll frame — each of which used to update state, fire a haptic, and push
  // the theme choice into the draft store — was the cause of the visible
  // freeze while dragging. The card only needs to know which one is active
  // once the gesture actually settles.
  //
  // Also deliberately NOT calling `scrollTo` here: `snapToInterval` already
  // makes the native scroll view come to rest exactly on a card boundary.
  // Layering a manual `scrollTo` on top of that fought the native settle —
  // the two disagreed by a frame or two and produced the stutter/jitter
  // reported as "buggy" scrolling. This only ever needs to read where the
  // view already landed, not move it again.
  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    selectIndex(nearestIndex(event));
  }

  return (
    <View style={{ flex: 1, gap: spacing.sm }}>
      <Animated.View style={[{ flex: 1 }, nudgeStyle]} onLayout={handleRowLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Snapping rather than paging: paging assumes one card per screen
          // width, which would hide the peek that makes this discoverable.
          // Not `disableIntervalMomentum` — that clamps every gesture to a
          // single card regardless of how hard it's flicked, which reads as
          // unresponsive on a real swipe. A strong flick should be able to
          // carry past more than one card, same as it would natively.
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          contentOffset={{ x: selectedIndex * snapInterval, y: 0 }}
          onScrollEndDrag={handleScrollEnd}
          onMomentumScrollEnd={handleScrollEnd}
          contentContainerStyle={{
            paddingHorizontal: Math.max(spacing.base, sidePadding),
            gap,
            alignItems: 'center',
          }}
        >
          {(rowHeight === 0 ? [] : themes).map((theme, index) => {
            const isActive = index === activeIndex;
            const card = (
              <DeviceFrame width={cardWidth}>
                <GuestCoverPreview
                  draft={draft}
                  theme={parseCoverTheme(theme.design_tokens, theme.slug)}
                  compact={false}
                  // Only the focused card is interactive — a tap anywhere on
                  // it opens the full-screen preview (see `GuestCoverPreview`).
                  // A half-visible neighbour instead scrolls into view, via
                  // the wrapper below.
                  editable={isActive}
                  onPreview={() => setIsPreviewVisible(true)}
                />
              </DeviceFrame>
            );

            // Always the same element type at this position, active or not —
            // only `disabled`/`style` change. Branching between a `View` and
            // a `Pressable` here used to force React to unmount and remount
            // this whole subtree the instant a swipe settled and `isActive`
            // flipped, which is what showed up as a flash right as the new
            // card was selected.
            return (
              <Pressable
                key={theme.slug}
                disabled={isActive}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={isActive ? undefined : `${theme.name} theme`}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: index * snapInterval, animated: true });
                }}
                style={{ width: cardWidth, opacity: isActive ? 1 : 0.55 }}
              >
                {card}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      <PaginationDots themes={themes} activeIndex={activeIndex} />
      <FullScreenCoverPreviewPager
        visible={isPreviewVisible}
        draft={draft}
        themes={themes}
        initialIndex={activeIndex}
        onSelect={selectIndex}
        onClose={() => setIsPreviewVisible(false)}
      />
    </View>
  );
}

function FullScreenCoverPreviewPager({
  visible,
  draft,
  themes,
  initialIndex,
  onSelect,
  onClose,
}: {
  visible: boolean;
  draft: CreationDraft;
  themes: ThemeRow[];
  initialIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const translateY = useSharedValue(0);
  const initialIndexRef = useRef(initialIndex);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (dismissTimerRef.current !== null) clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    initialIndexRef.current = initialIndex;
    if (visible) {
      translateY.value = 0;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
      });
    }
  }, [initialIndex, translateY, visible, width]);

  function handlePanEvent(event: { nativeEvent: { translationY?: number } }) {
    const translationY = event.nativeEvent.translationY ?? 0;
    if (translationY > 0) translateY.value = translationY;
  }

  function handlePanStateChange(event: {
    nativeEvent: { state: number; translationY?: number; velocityY?: number };
  }) {
    // Gesture-handler state 5 is END; 3 is FAILED.
    if (event.nativeEvent.state === 5) {
      const translationY = event.nativeEvent.translationY ?? 0;
      const velocityY = event.nativeEvent.velocityY ?? 0;
      if (translationY > 120 || velocityY > 0.5) {
        translateY.value = withTiming(height, { duration: 200 });
        dismissTimerRef.current = setTimeout(() => {
          onClose();
          translateY.value = 0;
        }, 220);
      } else {
        translateY.value = withSpring(0, { damping: 12, stiffness: 120 });
      }
    } else if (event.nativeEvent.state === 3) {
      translateY.value = withSpring(0);
    }
  }

  const translateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  function handlePreviewScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    const index = Math.max(
      0,
      Math.min(themes.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)),
    );
    onSelect(index);
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={false}
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
        <PanGestureHandler
          onGestureEvent={handlePanEvent}
          onHandlerStateChange={handlePanStateChange}
          activeOffsetY={[-12, 12]}
          failOffsetX={[-24, 24]}
        >
          <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, translateStyle]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews={false}
            style={{ flex: 1, backgroundColor: '#000' }}
            contentOffset={{ x: initialIndexRef.current * width, y: 0 }}
            onMomentumScrollEnd={handlePreviewScrollEnd}
            onScrollEndDrag={handlePreviewScrollEnd}
            scrollEventThrottle={16}
          >
            {themes.map((theme) => (
              <View
                key={theme.slug}
                style={{ width, height, backgroundColor: colours.background }}
              >
                <GuestCoverPreview
                  draft={draft}
                  theme={parseCoverTheme(theme.design_tokens, theme.slug)}
                  compact={false}
                  editable={false}
                  isFullScreen
                />
              </View>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            onPress={onClose}
            style={{
              position: 'absolute',
              top: Platform.OS === 'ios' ? 60 : 30,
              right: spacing.md,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <CloseIcon size={18} color="#fff" />
          </Pressable>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

/**
 * Just the dots. With only three themes on offer and no name label above them
 * any more, the row needs no accessible live-region text of its own — each
 * card already announces `"${theme.name} theme"` when it takes focus.
 */
function PaginationDots({ themes, activeIndex }: { themes: ThemeRow[]; activeIndex: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      {themes.map((theme, index) => (
        <View
          key={theme.slug}
          style={{
            width: index === activeIndex ? 16 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor:
              index === activeIndex ? colours.brandPrimary : colours.borderStrong,
          }}
        />
      ))}
    </View>
  );
}
