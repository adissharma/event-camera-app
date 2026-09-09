import { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';
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
const MONTH_HEADER_HEIGHT = 44;
/** 6 rows, fixed — see `buildMonth`. */
const MONTH_BODY_HEIGHT = ROW_HEIGHT * 6;
const MONTH_HEIGHT = MONTH_HEADER_HEIGHT + MONTH_BODY_HEIGHT;

/**
 * Vertically scrolling month calendar.
 *
 * Modelled on the iOS calendar: months run continuously downward and each
 * month is named once, prominently, inside the scroll surface.
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
  const minimumDateTime = minimumDate ? startOfDay(minimumDate).getTime() : null;
  const floor = useMemo(
    () => (minimumDateTime === null ? today : new Date(minimumDateTime)),
    [minimumDateTime, today],
  );

  const months = useMemo(() => buildMonths(floor, monthCount), [floor, monthCount]);

  return (
    <View style={[{ gap: spacing.sm }, fill ? { flex: 1 } : null]}>
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
        <FlatList
          data={months}
          keyExtractor={(month) => `${month.year}-${month.month}`}
          showsVerticalScrollIndicator={false}
          // Lets a flick carry a long way, which is the point of a scrollable
          // calendar rather than a paged one.
          decelerationRate="normal"
          initialNumToRender={4}
          windowSize={11}
          removeClippedSubviews={false}
          getItemLayout={(_data, index) => ({
            length: MONTH_HEIGHT,
            offset: MONTH_HEIGHT * index,
            index,
          })}
          renderItem={({ item: month }) => (
            <Month
              month={month}
              selected={selected}
              today={today}
              minimumDate={floor}
              onSelect={onSelect}
            />
          )}
        />
      </View>
    </View>
  );
}

function Month({
  month,
  selected,
  today,
  minimumDate,
  onSelect,
}: {
  month: CalendarMonth;
  selected: Date | null;
  today: Date;
  minimumDate: Date;
  onSelect: (date: Date) => void;
}) {
  return (
    <View style={{ height: MONTH_HEIGHT }}>
      <View
        accessibilityLabel={month.label}
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
          {/*
            The only place the month is named now that the pinned header is
            gone, so it carries that weight rather than sitting back as a
            quiet separator label.
          */}
          <AppText variant="titleMedium" maxFontSizeMultiplier={1.4}>
            {month.label}
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

      {month.weeks.map((week) => (
        <View key={week.map((day) => day.key).join(':')} style={{ flexDirection: 'row', height: ROW_HEIGHT }}>
          {week.map((day) => (
            <DayCell
              key={day.key}
              day={day}
              selected={isSameDay(day.date, selected)}
              isToday={isSameDay(day.date, today)}
              disabled={day.date !== null && day.date < minimumDate}
              onPress={() => day.date && onSelect(day.date)}
            />
          ))}
        </View>
      ))}
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
