import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';

export const WHEEL_ROW_HEIGHT = 48;
const DEFAULT_VISIBLE_ROWS = 5;

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
}: WheelPickerProps<T>) {
  const listRef = useRef<FlatList<T>>(null);
  const edgePadding = WHEEL_ROW_HEIGHT * Math.floor(visibleRows / 2);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: selectedIndex * WHEEL_ROW_HEIGHT, animated: false });
  }, [selectedIndex, values.length]);

  function finishScroll(offset: number) {
    const next = Math.max(0, Math.min(values.length - 1, Math.round(offset / WHEEL_ROW_HEIGHT)));
    if (next !== selectedIndex) onChange(next);
  }

  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel} style={[styles.container, { width, height: WHEEL_ROW_HEIGHT * visibleRows }]}>
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(value, index) => `${String(value)}-${index}`}
        renderItem={({ item, index }: ListRenderItemInfo<T>) => (
          <View style={styles.row}>
            <AppText variant={index === selectedIndex ? 'titleMedium' : 'bodyLarge'} tone={index === selectedIndex ? undefined : 'secondary'} numberOfLines={1} adjustsFontSizeToFit>
              {formatValue(item)}
            </AppText>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        bounces
        initialNumToRender={visibleRows + 2}
        contentContainerStyle={{ paddingVertical: edgePadding }}
        getItemLayout={(_data, index) => ({ length: WHEEL_ROW_HEIGHT, offset: WHEEL_ROW_HEIGHT * index, index })}
        onMomentumScrollEnd={(event) => finishScroll(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => finishScroll(event.nativeEvent.contentOffset.y)}
      />
      <View pointerEvents="none" style={[styles.selectionRail, { top: edgePadding }]} />
      <View pointerEvents="none" style={[styles.fadeTop, { backgroundColor: fadeColor, height: edgePadding }]} />
      <View pointerEvents="none" style={[styles.fadeBottom, { backgroundColor: fadeColor, height: edgePadding }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', position: 'relative' },
  row: { alignItems: 'center', justifyContent: 'center', height: WHEEL_ROW_HEIGHT, paddingHorizontal: spacing.xs },
  selectionRail: { position: 'absolute', left: 0, right: 0, height: WHEEL_ROW_HEIGHT, borderTopWidth: layout.hairline, borderBottomWidth: layout.hairline, borderColor: colours.borderSubtle },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.72 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.72 },
});
