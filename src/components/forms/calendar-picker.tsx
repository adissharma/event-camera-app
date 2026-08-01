import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SectionList,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import {
  WEEKDAY_LABELS,
  buildMonths,
  isSameDay,
  startOfDay,
  type CalendarDay,
  type CalendarMonth,
} from './month-calendar';

export interface CalendarPickerProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
  /** Days before this are shown but not selectable. */
  minimumDate?: Date;
  /** How many months forward to render. */
  monthCount?: number;
  /** Fixed height. Ignored when `fill` is set. */
  height?: number;
  /** Fill the remaining vertical space instead of taking a fixed height. */
  fill?: boolean;
}

const ROW_HEIGHT = 44;
/** Breathing space between months with a month label. */
const MONTH_HEADER_HEIGHT = 36;
/** 6 rows, fixed — see `buildMonth`. */
const MONTH_BODY_HEIGHT = ROW_HEIGHT * 6;

/**
 * Vertically scrolling month calendar.
 *
 * Modelled on the iOS calendar: months run continuously downward, and the
 * current month's name stays pinned at the top until the next month reaches
 * it. That pinning is what makes fast flicking usable — without it you lose
 * track of where you are the moment you move quickly.
 *
 * Two implementation choices that matter for that feel:
 *
 * - Every month is exactly six rows tall, padded with blanks. Variable heights
 *   make a flick feel uneven because rows shift as each month enters view, and
 *   they also break `getItemLayout`, which is what allows instant jumps.
 * - `getItemLayout` is supplied, so the list never has to measure rows. Without
 *   it a fast flick through a couple of years stutters while React Native
 *   measures its way down.
 */
export function CalendarPicker({
  selected,
  onSelect,
  minimumDate,
  monthCount = 12,
  height = 320,
  fill = false,
}: CalendarPickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const floor = minimumDate ? startOfDay(minimumDate) : today;

  const months = useMemo(() => buildMonths(floor, monthCount), [floor, monthCount]);

  const [pinnedIndex, setPinnedIndex] = useState(0);
  const listRef = useRef<SectionList<CalendarDay[], CalendarMonth>>(null);

  const sections = useMemo(
    () => months.map((month) => ({ ...month, data: month.weeks })),
    [months],
  );

  /**
   * Tracks which month owns the top of the viewport.
   *
   * Derived from the scroll offset rather than from `onViewableItemsChanged`:
   * viewability callbacks fire irregularly during a fast flick, which makes the
   * pinned title lag or skip a month. Arithmetic on a fixed row height is exact
   * and costs nothing.
   */
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = event.nativeEvent.contentOffset.y;
    const monthHeight = MONTH_HEADER_HEIGHT + MONTH_BODY_HEIGHT;
    // Shift threshold by one row height so that the title transitions to the next month
    // as soon as the viewport scrolls into the last week of the current month.
    const index = Math.min(
      months.length - 1,
      Math.max(0, Math.floor((offset + ROW_HEIGHT) / monthHeight)),
    );
    if (index !== pinnedIndex) setPinnedIndex(index);
  }

  const pinned = months[pinnedIndex];

  return (
    <View style={[{ gap: spacing.sm }, fill ? { flex: 1 } : null]}>
      {/* Pinned month and year. Large, and deliberately outside the list so it
          never scrolls with the content. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="titleLarge" accessibilityLiveRegion="polite">
          {pinned?.label ?? ''}
        </AppText>
      </View>

      {/* Weekday header, fixed above the scroller. */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={`${label}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="caption" tone="secondary">
              {label}
            </AppText>
          </View>
        ))}
      </View>

      <View
        style={{
          ...(fill ? { flex: 1 } : { height }),
          borderRadius: radii.lg,
          borderWidth: layout.hairline,
          borderColor: colours.borderSubtle,
          backgroundColor: colours.surface,
          overflow: 'hidden',
        }}
      >
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(week) => week[0]?.key ?? Math.random().toString()}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          // Lets a flick carry a long way, which is the point of a scrollable
          // calendar rather than a paged one.
          decelerationRate="normal"
          // The month name lives in the pinned title above, so in-list headers
          // must not stick as well — two copies of "July 2026" appeared on
          // screen at once.
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          windowSize={11}
          removeClippedSubviews
          getItemLayout={(_data, index) => {
            const itemsPerSection = 7; // 1 header + 6 weeks
            const sectionIndex = Math.floor(index / itemsPerSection);
            const itemIndexInSection = index % itemsPerSection;
            const sectionHeight = MONTH_HEADER_HEIGHT + MONTH_BODY_HEIGHT;

            let length = ROW_HEIGHT;
            let offset = 0;

            if (itemIndexInSection === 0) {
              length = MONTH_HEADER_HEIGHT;
              offset = sectionIndex * sectionHeight;
            } else {
              length = ROW_HEIGHT;
              offset =
                sectionIndex * sectionHeight +
                MONTH_HEADER_HEIGHT +
                (itemIndexInSection - 1) * ROW_HEIGHT;
            }

            return {
              length,
              offset,
              index,
            };
          }}
          renderSectionHeader={({ section }) => (
            <View
              accessibilityLabel={section.label}
              style={{
                height: MONTH_HEADER_HEIGHT,
                justifyContent: 'center',
                backgroundColor: colours.surface,
                paddingHorizontal: spacing.base,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <AppText variant="eyebrow" tone="secondary">
                  {section.label}
                </AppText>
                <View
                  style={{
                    flex: 1,
                    height: layout.hairline,
                    backgroundColor: colours.borderSubtle,
                  }}
                />
              </View>
            </View>
          )}
          renderItem={({ item: week }) => (
            <View style={{ flexDirection: 'row', height: ROW_HEIGHT }}>
              {week.map((day) => (
                <DayCell
                  key={day.key}
                  day={day}
                  selected={isSameDay(day.date, selected)}
                  isToday={isSameDay(day.date, today)}
                  disabled={day.date !== null && day.date < floor}
                  onPress={() => day.date && onSelect(day.date)}
                />
              ))}
            </View>
          )}
        />
      </View>
    </View>
  );
}

function DayCell({
  day,
  selected,
  isToday,
  disabled,
  onPress,
}: {
  day: CalendarDay;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  if (!day.date) {
    return <View style={{ flex: 1 }} />;
  }

  const label = day.date.getDate();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={day.date.toDateString()}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? colours.brandPrimary : 'transparent',
          // Today is marked by an outline, not a fill, so it never competes
          // with the selected day.
          borderWidth: !selected && isToday ? 1 : 0,
          borderColor: colours.borderStrong,
          opacity: disabled ? 0.28 : 1,
        }}
      >
        <AppText variant="numeric" tone={selected ? 'onBrand' : 'primary'}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}
