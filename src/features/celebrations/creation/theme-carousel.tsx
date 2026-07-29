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
  onEditImage: () => void;
  onEditTitle: () => void;
  onEditDate: () => void;
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
  onEditImage,
  onEditTitle,
  onEditDate,
}: ThemeCarouselProps) {
  const { width } = useWindowDimensions();
  const motion = useMotion();
  const scrollRef = useRef<ScrollView>(null);
  const hasNudged = useRef(false);

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
  const sidePadding = Math.max(
    spacing.base,
    Math.round((width - cardWidth) / 2) - Math.round(cardWidth * 0.28),
  );
  const snapInterval = cardWidth + gap;

  function handleRowLayout(event: LayoutChangeEvent) {
    const measured = Math.floor(event.nativeEvent.layout.height);
    if (measured > 0 && measured !== rowHeight) setRowHeight(measured);
  }

  const selectedIndex = Math.max(
    0,
    themes.findIndex((theme) => theme.slug === selectedSlug),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

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

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    const theme = themes[index];
    if (!theme) return;

    setActiveIndex(index);
    if (theme.slug !== selectedSlug) {
      void Haptics.selectionAsync().catch(() => {});
      onSelect(theme.slug);
    }
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
          snapToInterval={snapInterval}
          decelerationRate="fast"
          contentOffset={{ x: selectedIndex * snapInterval, y: 0 }}
          onMomentumScrollEnd={handleMomentumEnd}
          contentContainerStyle={{
            paddingHorizontal: Math.max(spacing.base, sidePadding),
            gap,
            alignItems: 'center',
          }}
        >
          {(rowHeight === 0 ? [] : themes).map((theme, index) => {
            const isActive = index === activeIndex;
            return (
              <Pressable
                key={theme.slug}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${theme.name} theme`}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: index * snapInterval, animated: true });
                }}
                style={{ width: cardWidth, opacity: isActive ? 1 : 0.55 }}
              >
                <DeviceFrame width={cardWidth}>
                  <GuestCoverPreview
                    draft={draft}
                    theme={parseCoverTheme(theme.design_tokens)}
                    compact={!isActive}
                    // Only the focused card is editable. Pencils on a
                    // half-visible neighbour would invite taps that scroll it
                    // into view instead of editing.
                    editable={isActive}
                    onEditImage={onEditImage}
                    onEditTitle={onEditTitle}
                    onEditDate={onEditDate}
                  />
                </DeviceFrame>
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
