import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';

export const WHEEL_ROW_HEIGHT = 48;
const DEFAULT_VISIBLE_ROWS = 5;

function triggerWheelHaptic() {
  void Haptics.selectionAsync().catch(() => {});
}

export interface WheelPickerProps<T extends string | number> {
  values: T[];
  selectedIndex: number;
  onChange: (index: number) => void;
  formatValue?: (value: T) => string;
  accessibilityLabel: string;
  width?: number;
  /**
   * What the top and bottom fades blend into.
   *
   * Defaults to the page canvas, which is right on a full screen. A wheel on
   * a raised surface — a sheet — must be told, or the fades paint the darker
   * canvas colour over the lighter surface and read as two grey blocks
   * bracketing the selection rather than as a fade.
   */
  fadeColor?: string;
  /**
   * Rows shown at once, selected row included. Must be odd — the selection
   * sits in the middle, so an even count has no middle.
   */
  visibleRows?: number;
  /**
   * Shows the selection alone, with no neighbours and no scrolling.
   *
   * For a value the surrounding UI has already decided — the wheel still
   * says what it is, and keeps its height so nothing around it moves, but
   * stops offering alternatives it would not accept.
   */
  locked?: boolean;
}

/** A compact, native-feeling wheel: momentum scrolling, snapping and a quiet centre rail. */
export function WheelPicker<T extends string | number>({
  values,
  selectedIndex,
  onChange,
  formatValue = String,
  accessibilityLabel,
  width = 96,
  fadeColor = colours.background,
  visibleRows = DEFAULT_VISIBLE_ROWS,
  locked = false,
}: WheelPickerProps<T>) {
  const listRef = useRef<FlatList<T>>(null);
  const hasSettled = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `scrollToOffset` also emits the normal FlatList completion callbacks.
  // Keep a JS-side gesture flag so positioning a wheel from surrounding state
  // never masquerades as a host changing that wheel.
  const userScrollInProgress = useRef(false);
  const edgePadding = WHEEL_ROW_HEIGHT * Math.floor(visibleRows / 2);
  const scrollOffset = useSharedValue(selectedIndex * WHEEL_ROW_HEIGHT);
  const isUserScrolling = useSharedValue(false);
  const lastHapticIndex = useSharedValue(selectedIndex);

  useEffect(() => {
    lastHapticIndex.set(selectedIndex);
  }, [lastHapticIndex, selectedIndex]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  useEffect(() => {
    // Animated after the first placement: the opening position should simply
    // be correct, but a later change — the surrounding UI choosing a value —
    // should be visible as the wheel moving to it.
    listRef.current?.scrollToOffset({
      offset: selectedIndex * WHEEL_ROW_HEIGHT,
      animated: hasSettled.current,
    });
    if (!hasSettled.current) scrollOffset.set(selectedIndex * WHEEL_ROW_HEIGHT);
    hasSettled.current = true;
  }, [scrollOffset, selectedIndex, values.length]);

  const animatedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.set(event.contentOffset.y);
    },
  });

  useAnimatedReaction(
    () =>
      Math.max(
        0,
        Math.min(
          values.length - 1,
          Math.round(scrollOffset.get() / WHEEL_ROW_HEIGHT),
        ),
      ),
    (nextIndex) => {
      if (!isUserScrolling.get() || nextIndex === lastHapticIndex.get()) return;
      lastHapticIndex.set(nextIndex);
      scheduleOnRN(triggerWheelHaptic);
    },
  );

  function finishScroll(offset: number) {
    if (!userScrollInProgress.current) return;
    const next = Math.max(0, Math.min(values.length - 1, Math.round(offset / WHEEL_ROW_HEIGHT)));
    if (next !== selectedIndex) onChange(next);
  }

  function beginUserScroll() {
    if (locked) return;
    userScrollInProgress.current = true;
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    isUserScrolling.set(true);
    lastHapticIndex.set(selectedIndex);
  }

  function endUserScrollSoon() {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      isUserScrolling.set(false);
      userScrollInProgress.current = false;
      settleTimer.current = null;
    }, 120);
  }

  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel} style={[styles.container, { width, height: WHEEL_ROW_HEIGHT * visibleRows }]}>
      <Animated.FlatList
        ref={listRef}
        data={values}
        keyExtractor={(value, index) => `${String(value)}-${index}`}
        extraData={selectedIndex}
        renderItem={({ item, index }: ListRenderItemInfo<T>) => (
          <WheelRow
            index={index}
            hidden={locked && index !== selectedIndex}
            scrollOffset={scrollOffset}
            value={formatValue(item)}
          />
        )}
        scrollEnabled={!locked}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        bounces
        scrollEventThrottle={16}
        initialNumToRender={visibleRows + 2}
        contentContainerStyle={{ paddingVertical: edgePadding }}
        getItemLayout={(_data, index) => ({ length: WHEEL_ROW_HEIGHT, offset: WHEEL_ROW_HEIGHT * index, index })}
        onScroll={animatedScrollHandler}
        onScrollBeginDrag={beginUserScroll}
        onMomentumScrollEnd={(event) => {
          finishScroll(event.nativeEvent.contentOffset.y);
          endUserScrollSoon();
        }}
        onScrollEndDrag={(event) => {
          finishScroll(event.nativeEvent.contentOffset.y);
          endUserScrollSoon();
        }}
      />
      <View pointerEvents="none" style={[styles.selectionRail, { top: edgePadding }]} />
      <View pointerEvents="none" style={[styles.fadeTop, { backgroundColor: fadeColor, height: edgePadding }]} />
      <View pointerEvents="none" style={[styles.fadeBottom, { backgroundColor: fadeColor, height: edgePadding }]} />
    </View>
  );
}

function WheelRow({
  index,
  hidden,
  scrollOffset,
  value,
}: {
  index: number;
  hidden: boolean;
  scrollOffset: SharedValue<number>;
  value: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollOffset.get() - index * WHEEL_ROW_HEIGHT);
    return {
      opacity: interpolate(
        distance,
        [0, WHEEL_ROW_HEIGHT * 2],
        [1, 0.45],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            distance,
            [0, WHEEL_ROW_HEIGHT * 2],
            [1, 0.82],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <View style={styles.row}>
      {hidden ? null : (
        <Animated.View style={[styles.value, animatedStyle]}>
          <AppText
            variant="titleMedium"
            align="center"
            numberOfLines={1}
            maxFontSizeMultiplier={1.25}
            style={styles.value}
          >
            {value}
          </AppText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', position: 'relative' },
  row: { alignItems: 'center', justifyContent: 'center', height: WHEEL_ROW_HEIGHT, paddingHorizontal: spacing.xs },
  value: { width: '100%' },
  selectionRail: { position: 'absolute', left: 0, right: 0, height: WHEEL_ROW_HEIGHT, borderTopWidth: layout.hairline, borderBottomWidth: layout.hairline, borderColor: colours.borderSubtle },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.72 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.72 },
});
