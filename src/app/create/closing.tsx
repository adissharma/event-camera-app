import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { CalendarPicker } from '@/components/forms/calendar-picker';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  DEFAULT_CLOSING_HOURS,
  DEFAULT_CLOSING_MINUTES,
  combineDateAndTime,
  formatSelectedDate,
  formatTime12h,
} from '@/components/forms/month-calendar';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

export default function ClosingStep() {
  const { draft, update } = useCreationDraft();
  const [showTimePicker, setShowTimePicker] = useState(false);

  const selected = draft.endsAt ? new Date(draft.endsAt) : null;

  function selectDay(day: Date) {
    // Keep the time already chosen; only the date changes. Built from
    // components rather than by mutating the existing date, so a 31st never
    // rolls into the following month.
    const hours = selected?.getHours() ?? DEFAULT_CLOSING_HOURS;
    const minutes = selected?.getMinutes() ?? DEFAULT_CLOSING_MINUTES;
    update({ endsAt: combineDateAndTime(day, hours, minutes).toISOString() });
  }

  function selectTime(time: Date) {
    const base = selected ?? new Date();
    update({
      endsAt: combineDateAndTime(base, time.getHours(), time.getMinutes()).toISOString(),
    });
  }

  return (
    <CreationStepScreen
      step="closing"
      heading={copy.create.closingHeading}
      supporting={copy.create.closingSupporting}
      // The calendar is the scroll surface on this step; the screen must not be.
      scrollable={false}
    >
      <View style={{ gap: spacing.base, flex: 1 }}>
        {/* The choice, always visible above the calendar. Scrolling months
            without a persistent answer is disorienting — you lose track of what
            you actually picked. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.base,
            padding: spacing.base,
            borderRadius: radii.lg,
            backgroundColor: colours.surface,
            borderWidth: layout.hairline,
            borderColor: selected ? colours.brandPrimary : colours.borderStrong,
          }}
        >
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="eyebrow" tone="secondary">
              Ends
            </AppText>
            <AppText variant="labelLarge">
              {selected ? formatSelectedDate(selected) : 'Choose a date'}
            </AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selected ? `Closing time, ${formatTime12h(selected)}. Change` : 'Set a time'
            }
            onPress={() => setShowTimePicker((open) => !open)}
            style={{
              minHeight: layout.minTouchTarget,
              justifyContent: 'center',
              paddingHorizontal: spacing.base,
              borderRadius: radii.md,
              borderWidth: layout.hairline,
              borderColor: showTimePicker ? colours.focusRing : colours.borderStrong,
            }}
          >
            {/* Displayed as am/pm; the picker below runs in 24-hour. */}
            <AppText variant="numeric">
              {selected ? formatTime12h(selected) : '11:59 pm'}
            </AppText>
          </Pressable>
        </View>

        {showTimePicker ? (
          <View
            style={{
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: radii.lg,
              backgroundColor: colours.surface,
              borderWidth: layout.hairline,
              borderColor: colours.borderSubtle,
            }}
          >
            <DateTimePicker
              value={
                selected ??
                combineDateAndTime(new Date(), DEFAULT_CLOSING_HOURS, DEFAULT_CLOSING_MINUTES)
              }
              mode="time"
              display="spinner"
              // 24-hour in the selector, am/pm in the summary above. Setting a
              // time is unambiguous in 24-hour; reading one back is friendlier
              // in 12-hour.
              is24Hour
              themeVariant="dark"
              onChange={(_event, time) => {
                if (Platform.OS !== 'ios') setShowTimePicker(false);
                if (time) selectTime(time);
              }}
            />
            {Platform.OS === 'ios' ? (
              <Button
                label={copy.common.done}
                variant="secondary"
                size="small"
                onPress={() => setShowTimePicker(false)}
              />
            ) : null}
          </View>
        ) : null}

        <CalendarPicker
          selected={selected}
          onSelect={selectDay}
          // The past cannot be a closing time, so it is not offerable.
          minimumDate={new Date()}
          fill
        />

        <View style={{ gap: spacing.xxs, paddingTop: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            Times are in {draft.timezone.replace(/_/g, ' ')}.
          </AppText>
        </View>
      </View>
    </CreationStepScreen>
  );
}
