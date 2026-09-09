import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';

export const WHEEL_ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const EDGE_PADDING = WHEEL_ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

export interface WheelPickerProps<T extends string | number> {
  values: T[];
  selectedIndex: number;
  onChange: (index: number) => void;
  formatValue?: (value: T) => string;
  accessibilityLabel: string;
  width?: number;
}

/** A compact, native-feeling wheel: momentum scrolling, snapping and a quiet centre rail. */
export function WheelPicker<T extends string | number>({
  values,
  selectedIndex,
  onChange,
  formatValue = String,
  accessibilityLabel,
  width = 96,
}: WheelPickerProps<T>) {
  const listRef = useRef<FlatList<T>>(null);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: selectedIndex * WHEEL_ROW_HEIGHT, animated: false });
  }, [selectedIndex, values.length]);

  function finishScroll(offset: number) {
    const next = Math.max(0, Math.min(values.length - 1, Math.round(offset / WHEEL_ROW_HEIGHT)));
    if (next !== selectedIndex) onChange(next);
  }

  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel} style={[styles.container, { width }]}>
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
        initialNumToRender={VISIBLE_ROWS + 2}
        contentContainerStyle={{ paddingVertical: EDGE_PADDING }}
        getItemLayout={(_data, index) => ({ length: WHEEL_ROW_HEIGHT, offset: WHEEL_ROW_HEIGHT * index, index })}
        onMomentumScrollEnd={(event) => finishScroll(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => finishScroll(event.nativeEvent.contentOffset.y)}
      />
      <View pointerEvents="none" style={styles.selectionRail} />
      <View pointerEvents="none" style={styles.fadeTop} />
      <View pointerEvents="none" style={styles.fadeBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: WHEEL_ROW_HEIGHT * VISIBLE_ROWS, overflow: 'hidden', position: 'relative' },
  row: { alignItems: 'center', justifyContent: 'center', height: WHEEL_ROW_HEIGHT, paddingHorizontal: spacing.xs },
  selectionRail: { position: 'absolute', top: EDGE_PADDING, left: 0, right: 0, height: WHEEL_ROW_HEIGHT, borderTopWidth: layout.hairline, borderBottomWidth: layout.hairline, borderColor: colours.borderSubtle },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: EDGE_PADDING, backgroundColor: colours.background, opacity: 0.72 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: EDGE_PADDING, backgroundColor: colours.background, opacity: 0.72 },
});
