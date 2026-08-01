import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { DeviceFrame } from '@/components/media/device-frame';
import { GuestCoverPreview, parseCoverTheme } from './guest-cover-preview';
import { colours, easing, spacing, useMotion } from '@/design';
import type { CreationDraft } from '../draft/types';
import type { ThemeRow } from '@/types/database';

export interface ThemeCarouselProps {
  draft: CreationDraft;
  themes: ThemeRow[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onEditCover: () => void;
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
  onEditCover,
}: ThemeCarouselProps) {
  const { width } = useWindowDimensions();
  const motion = useMotion();
  const selectedIndex = Math.max(
    0,
    themes.findIndex((theme) => theme.slug === selectedSlug),
  );
  const scrollRef = useRef<ScrollView>(null);
  const hasNudged = useRef(false);
  const activeIndexRef = useRef(selectedIndex);
  const selectedSlugRef = useRef<string | null>(selectedSlug);

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
  const heightDerivedWidth = rowHeight > 0 ? Math.floor(rowHeight / DEVICE_RATIO) : 0;
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
    }
  }, [selectedIndex]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    selectedSlugRef.current = selectedSlug;
  }, [selectedSlug]);

  const nudge = useSharedValue(0);

  /**
   * A single nudge on arrival, never a loop.
   *
   * A permanently bouncing card reads as broken within about ten seconds, and
   * the motion system forbids looping decoration outright. Two gentle cycles
   * say "this moves" and then stop. Suppressed entirely under reduce-motion,
   * where a repeating horizontal translation is exactly the pattern that
   * triggers people.
   */
  useEffect(() => {
    if (hasNudged.current || motion.reduceMotion || themes.length < 2) return;
    hasNudged.current = true;

    const travel = -14;
    const step = (to: number, duration: number) =>
      withTiming(to, { duration, easing: easing.inOut });

    nudge.value = withDelay(
      600,
      withSequence(step(travel, 260), step(0, 260), step(travel * 0.6, 200), step(0, 220)),
    );
  }, [nudge, motion.reduceMotion, themes.length]);

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
    <View style={{ flex: 1, gap: spacing.base }}>
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
                  theme={parseCoverTheme(theme.design_tokens)}
                  compact={false}
                  // Only the focused card shows the edit affordance. A pencil
                  // on a half-visible neighbour would invite a tap that scrolls
                  // it into view instead of editing it.
                  editable={isActive}
                  onEditCover={onEditCover}
                />
              </DeviceFrame>
            );

            if (isActive) {
              // The whole card opens the editor, not just its pencil badge —
              // a host looking at the cover shouldn't have to find a small
              // target to change it. Rendered in-flow with the rest of the
              // card content, this scrolls with it rather than sitting at a
              // fixed screen position while the theme underneath it changes.
              return (
                <Pressable
                  key={theme.slug}
                  accessibilityRole="button"
                  accessibilityLabel="Edit cover"
                  onPress={onEditCover}
                  style={{ width: cardWidth }}
                >
                  {card}
                </Pressable>
              );
            }

            return (
              <Pressable
                key={theme.slug}
                accessibilityRole="button"
                accessibilityState={{ selected: false }}
                accessibilityLabel={`${theme.name} theme`}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: index * snapInterval, animated: true });
                }}
                style={{ width: cardWidth, opacity: 0.55 }}
              >
                {card}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      <ThemeIndicator themes={themes} activeIndex={activeIndex} />
    </View>
  );
}

function ThemeIndicator({ themes, activeIndex }: { themes: ThemeRow[]; activeIndex: number }) {
  const active = themes[activeIndex];

  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <AppText variant="labelLarge" accessibilityLiveRegion="polite">
        {active?.name ?? ''}
      </AppText>

      <View style={{ flexDirection: 'row', gap: 6 }}>
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
    </View>
  );
}
