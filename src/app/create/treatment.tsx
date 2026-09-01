import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { OptionCard } from '@/components/forms/option-card';
import { OverlappingPreviews } from '@/features/celebrations/creation/overlapping-previews';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  normalisePhotoTreatment,
  PHOTO_TREATMENT_OPTIONS,
  type SupportedPhotoTreatment,
} from '@/features/media/photo-treatment';
import { colours, easing, spacing, useMotion } from '@/design';
import { copy } from '@/i18n';

export default function TreatmentStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen
      step="treatment"
      heading={copy.create.treatmentHeading}
      supporting={copy.create.treatmentSupporting}
      scrollable={false}
    >
      <View style={{ flex: 1, minHeight: 0, gap: spacing.base }}>
        <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
          <OverlappingPreviews treatment={draft.photoTreatment} />
        </View>

        <TreatmentCarousel
          selected={normalisePhotoTreatment(draft.photoTreatment)}
          onSelect={(photoTreatment) => {
            update({
              photoTreatment,
              dateStampEnabled: photoTreatment === 'disposable',
            });
          }}
        />
      </View>
    </CreationStepScreen>
  );
}

function TreatmentCarousel({
  selected,
  onSelect,
}: {
  selected: SupportedPhotoTreatment;
  onSelect: (treatment: SupportedPhotoTreatment) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const hasNudged = useRef(false);
  const motion = useMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const cardWidth = Math.round(containerWidth * 0.84);
  const gap = spacing.sm;
  const snapInterval = cardWidth + gap;
  const snapOffsets = PHOTO_TREATMENT_OPTIONS.map((_, index) =>
    index === PHOTO_TREATMENT_OPTIONS.length - 1
      ? Math.max(0, index * snapInterval - (containerWidth - cardWidth))
      : index * snapInterval,
  );
  const selectedIndex = Math.max(
    0,
    PHOTO_TREATMENT_OPTIONS.findIndex((treatment) => treatment.value === selected),
  );

  const nudge = useSharedValue(0);

  useEffect(() => {
    if (hasNudged.current || motion.reduceMotion || PHOTO_TREATMENT_OPTIONS.length < 2) return;
    hasNudged.current = true;

    const travel = -14;
    const step = (to: number, duration: number) =>
      withTiming(to, { duration, easing: easing.inOut });

    nudge.value = withDelay(
      600,
      withSequence(step(travel, 260), step(0, 260), step(travel * 0.6, 200), step(0, 220)),
    );
  }, [motion.reduceMotion, nudge]);

  const nudgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }],
  }));

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== containerWidth) setContainerWidth(nextWidth);
  }

  function selectIndex(index: number, withHaptic = true) {
    const option = PHOTO_TREATMENT_OPTIONS[index];
    if (!option || option.value === selected) return;

    if (withHaptic) void Haptics.selectionAsync().catch(() => {});
    onSelect(option.value);
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (snapInterval === 0) return;
    const offset = event.nativeEvent.contentOffset.x;
    const index = snapOffsets.reduce(
      (nearest, candidate, candidateIndex) =>
        Math.abs(candidate - offset) < Math.abs(snapOffsets[nearest] - offset)
          ? candidateIndex
          : nearest,
      0,
    );
    selectIndex(index);
  }

  function showOption(index: number, withHaptic = true) {
    const offset = snapOffsets[index];
    if (offset === undefined) return;
    scrollRef.current?.scrollTo({ x: offset, animated: true });
    selectIndex(index, withHaptic);
  }

  return (
    <View onLayout={handleLayout} style={{ gap: spacing.sm }}>
      {containerWidth > 0 ? (
        <Animated.View style={nudgeStyle}>
          <ScrollView
            ref={scrollRef}
            horizontal
            snapToOffsets={snapOffsets}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: snapOffsets[selectedIndex] ?? 0, y: 0 }}
            contentContainerStyle={{ gap }}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
          >
            {PHOTO_TREATMENT_OPTIONS.map((treatment, index) => (
              <View key={treatment.value} style={{ width: cardWidth }}>
                <OptionCard
                  label={treatment.label}
                  selected={selected === treatment.value}
                  onPress={() => showOption(index, false)}
                />
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
      >
        {PHOTO_TREATMENT_OPTIONS.map((treatment, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Pressable
              key={treatment.value}
              accessibilityRole="tab"
              accessibilityLabel={treatment.label}
              accessibilityState={{ selected: isSelected }}
              hitSlop={10}
              onPress={() => showOption(index)}
              style={{
                width: isSelected ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: isSelected ? colours.brandPrimary : colours.borderStrong,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
