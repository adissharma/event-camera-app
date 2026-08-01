import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { colours, radii, spacing, useMotion } from '@/design';

/** Track padding. The thumb inset and the segment width both derive from it. */
const TRACK_PADDING = 4;

export interface SegmentedOption<T> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced before the options, e.g. "When do you want to see new photos?". */
  accessibilityLabel?: string;
}

/**
 * The one segmented control in the app.
 *
 * A single pill track with equal-width segments and a thumb that slides to the
 * selection rather than the background snapping on under the finger — the
 * movement is what tells you the two options belong to one choice.
 *
 * Labels cross-fade rather than switching outright, so mid-slide the text over
 * the thumb is already dark and the text it is leaving is already pale. A hard
 * swap leaves pale text sitting on cream for a frame.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const motion = useMotion();
  const [trackWidth, setTrackWidth] = useState(0);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const progress = useRef(new Animated.Value(selectedIndex)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: selectedIndex,
      useNativeDriver: true,
      ...motion.spring('responsive'),
    }).start();
  }, [selectedIndex, progress, motion]);

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const segmentWidth =
    trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  // `interpolate` needs at least two stops, so a single-option control skips
  // the thumb animation entirely rather than building an invalid range.
  const canSlide = options.length > 1 && segmentWidth > 0;
  const translateX = canSlide
    ? progress.interpolate({
        inputRange: options.map((_, index) => index),
        outputRange: options.map((_, index) => index * segmentWidth),
      })
    : 0;

  return (
    <View
      style={styles.track}
      onLayout={handleLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: segmentWidth, transform: [{ translateX }] },
          ]}
        />
      ) : null}

      {options.map((option, index) => {
        const isSelected = index === selectedIndex;

        // Peaks at this segment and falls away on either side, so the pair of
        // labels always sums to one during the slide.
        const range = { inputRange: [index - 1, index, index + 1], extrapolate: 'clamp' as const };
        const activeOpacity = progress.interpolate({ ...range, outputRange: [0, 1, 0] });
        const restingOpacity = progress.interpolate({ ...range, outputRange: [1, 0, 1] });

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              if (isSelected) return;
              void Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            style={styles.segment}
          >
            {/* Stacked so the two states can cross-fade in place. Only the
                resting copy carries layout; the active copy sits on top. */}
            <Animated.View style={{ opacity: restingOpacity }}>
              <AppText style={styles.label} numberOfLines={1}>
                {option.label}
              </AppText>
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, styles.activeLabelWrap, { opacity: activeOpacity }]}>
              <AppText style={[styles.label, styles.labelActive]} numberOfLines={1}>
                {option.label}
              </AppText>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colours.surfaceMuted,
    borderRadius: radii.pill,
    padding: TRACK_PADDING,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: radii.pill,
    backgroundColor: colours.brandPrimary,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLabelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colours.textSecondary,
    fontWeight: '500',
    fontSize: 13,
  },
  labelActive: {
    color: colours.textOnBrand,
    fontWeight: '700',
  },
});
