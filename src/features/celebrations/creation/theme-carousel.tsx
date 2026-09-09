import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PanGestureHandler } from 'react-native-gesture-handler';

import {
  canonicalDeviceWidth,
  DEVICE_ASPECT_RATIO,
} from '@/components/media/device-frame';
import { CloseIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { GuestCoverPreview, parseCoverTheme } from './guest-cover-preview';
import { colours, spacing } from '@/design';
import type { CreationDraft } from '../draft/types';
import type { ThemeRow } from '@/types/database';

export interface ThemeCarouselProps {
  draft: CreationDraft;
  themes: ThemeRow[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

/**
 * Horizontally swiped theme picker controlling the persistent live preview.
 * The visual phone is mounted once above the navigator; this component owns
 * only its swipe/tap surface, label, dots, and full-screen inspection mode.
 */
export function ThemeCarousel({
  draft,
  themes,
  selectedSlug,
  onSelect,
}: ThemeCarouselProps) {
  const { width, height } = useWindowDimensions();
  const selectedIndex = Math.max(
    0,
    themes.findIndex((theme) => theme.slug === selectedSlug),
  );
  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(selectedIndex);
  const selectedSlugRef = useRef<string | null>(selectedSlug);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const gap = spacing.base;
  const cardWidth = canonicalDeviceWidth(width, height);
  const cardHeight = cardWidth * DEVICE_ASPECT_RATIO;
  const sidePadding = Math.max(spacing.base, Math.round((width - cardWidth) / 2));
  const snapInterval = cardWidth + gap;

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
      {/*
        The scroll view is the gesture surface for the one phone mounted by
        PreviewStageProvider. Its pages are intentionally transparent: adding
        a DeviceFrame here would bring back the second silhouette this flow is
        designed to remove.
      */}
      <View style={{ flex: 1, justifyContent: 'center' }}>
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
            paddingHorizontal: sidePadding,
            gap,
            alignItems: 'center',
          }}
        >
          {themes.map((theme, index) => {
            const isActive = index === activeIndex;
            return (
              <Pressable
                key={theme.slug}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${theme.name} theme${isActive ? ', selected. Tap to preview.' : ''}`}
                onPress={() => {
                  if (isActive) {
                    setIsPreviewVisible(true);
                  } else {
                    scrollRef.current?.scrollTo({ x: index * snapInterval, animated: true });
                  }
                }}
                style={{ width: cardWidth, height: cardHeight }}
              />
            );
          })}
        </ScrollView>
      </View>

      <AppText variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
        {themes[activeIndex]?.name ?? 'Swipe to choose a theme'}
      </AppText>
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
