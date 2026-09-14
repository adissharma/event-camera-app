import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { WheelPicker } from '@/components/forms/wheel-picker';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  DEFAULT_CLOSING_HOURS,
  DEFAULT_CLOSING_MINUTES,
  combineDateAndTime,
  getClosingDateBounds,
} from '@/components/forms/month-calendar';
import { spacing } from '@/design';
import { copy } from '@/i18n';

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2020, month, 1)),
);

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function nextDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(DEFAULT_CLOSING_HOURS, DEFAULT_CLOSING_MINUTES, 0, 0);
  return date;
}

export default function ClosingStep() {
  const { draft, update } = useCreationDraft();
  const now = useMemo(() => new Date(), []);
  const bounds = useMemo(() => getClosingDateBounds(now), [now]);
  /**
   * Whatever the host has chosen, valid or not.
   *
   * Deliberately unclamped. Correcting the date as they scroll moves the
   * wheel under their finger and never says why; the step's own validator
   * refuses a past date and explains it above Next, which is where a
   * rejection can actually be read.
   */
  const selected = useMemo(
    () => (draft.endsAt ? new Date(draft.endsAt) : nextDefaultDate()),
    [draft.endsAt],
  );

  /**
   * Every day and every month, unfiltered.
   *
   * A wheel that silently omits the first half of the year leaves the host
   * scrolling for a value that is not there, with nothing to say it was
   * removed or why. Showing everything and validating the answer is the
   * honest arrangement: the choice is refusable, not invisible.
   */
  const years = Array.from(
    { length: bounds.maximum.getFullYear() - bounds.minimum.getFullYear() + 1 },
    (_, index) => bounds.minimum.getFullYear() + index,
  );
  const months = Array.from({ length: 12 }, (_, month) => month);
  const days = Array.from(
    { length: daysInMonth(selected.getFullYear(), selected.getMonth()) },
    (_, i) => i + 1,
  );

  useEffect(() => {
    if (draft.endsAt !== selected.toISOString()) update({ endsAt: selected.toISOString() });
  }, [draft.endsAt, selected, update]);

  function selectPart(part: 'day' | 'month' | 'year', value: number) {
    const nextYear = part === 'year' ? value : selected.getFullYear();
    const nextMonth = part === 'month' ? value : selected.getMonth();
    const nextDay = Math.min(part === 'day' ? value : selected.getDate(), daysInMonth(nextYear, nextMonth));
    const next = combineDateAndTime(
      new Date(nextYear, nextMonth, nextDay),
      selected.getHours(),
      selected.getMinutes(),
    );
    update({ endsAt: next.toISOString() });
  }

  return (
    <CreationStepScreen
      step="closing"
      heading={copy.create.closingHeading}
      headingAlign="center"
      scrollable={false}
      editNextHref="/create/closing-time"
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
          <WheelPicker values={days} selectedIndex={Math.max(0, days.indexOf(selected.getDate()))} onChange={(index) => selectPart('day', days[index])} accessibilityLabel="Event end day" width={76} />
          <WheelPicker values={months} selectedIndex={Math.max(0, months.indexOf(selected.getMonth()))} onChange={(index) => selectPart('month', months[index])} formatValue={(month) => MONTHS[month]} accessibilityLabel="Event end month" width={156} />
          <WheelPicker values={years} selectedIndex={Math.max(0, years.indexOf(selected.getFullYear()))} onChange={(index) => selectPart('year', years[index])} accessibilityLabel="Event end year" width={96} />
        </View>
      </View>
      {/* Kept available for a possible return to the calendar experience. */}
      {/* <CalendarPicker selected={selected} onSelect={(date) => update({ endsAt: date.toISOString() })} minimumDate={new Date()} fill /> */}
    </CreationStepScreen>
  );
}
