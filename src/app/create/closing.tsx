import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { OptionCard } from '@/components/forms/option-card';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { LOCALE_CONFIG } from '@/config/app-config';
import { spacing } from '@/design';
import { copy } from '@/i18n';

/**
 * Quick choices cover the overwhelming majority of real events, which end the
 * same evening or the morning after. A full calendar as the primary control
 * would make the common case slower to serve the rare one; the custom option
 * opens the native picker for everything else.
 */
function quickOptions(timezone: string) {
  const now = new Date();

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 0, 0);

  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(11, 0, 0, 0);

  const inThreeDays = new Date(now);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  inThreeDays.setHours(23, 59, 0, 0);

  return [
    { key: 'tonight', label: 'Tonight', at: endOfToday },
    { key: 'tomorrow', label: 'Tomorrow morning', at: tomorrowMorning },
    { key: 'three-days', label: 'In three days', at: inThreeDays },
  ].filter((option) => option.at.getTime() > now.getTime())
   .map((option) => ({
     ...option,
     description: new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
       weekday: 'long', day: 'numeric', month: 'long',
       hour: '2-digit', minute: '2-digit', timeZone: timezone,
     }).format(option.at),
   }));
}

export default function ClosingStep() {
  const { draft, update } = useCreationDraft();
  const [showPicker, setShowPicker] = useState(false);
  // Captured when the picker opens rather than computed during render.
  // `Date.now()` in render is impure — it yields a different value on every
  // re-render, which React Compiler correctly rejects.
  const [pickerDefault, setPickerDefault] = useState<Date | null>(null);

  const options = quickOptions(draft.timezone);
  const selectedIso = draft.endsAt;
  const isCustom =
    selectedIso !== null && !options.some((o) => o.at.toISOString() === selectedIso);

  const formatted = selectedIso
    ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: draft.timezone,
      }).format(new Date(selectedIso))
    : null;

  return (
    <CreationStepScreen
      step="closing"
      heading={copy.create.closingHeading}
      supporting={copy.create.closingSupporting}
    >
      <View style={{ gap: spacing.base }}>
        {options.map((option) => (
          <OptionCard
            key={option.key}
            label={option.label}
            description={option.description}
            selected={selectedIso === option.at.toISOString()}
            onPress={() => update({ endsAt: option.at.toISOString() })}
          />
        ))}

        <OptionCard
          label="Choose a date and time"
          description={isCustom && formatted ? formatted : 'Pick exactly when it closes'}
          selected={isCustom}
          onPress={() => {
            setPickerDefault(new Date(Date.now() + 86_400_000));
            setShowPicker(true);
          }}
        />

        {showPicker ? (
          <View style={{ gap: spacing.sm }}>
            <DateTimePicker
              value={selectedIso ? new Date(selectedIso) : (pickerDefault ?? new Date())}
              mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
              // Guests cannot capture into the past, so the picker should not
              // offer it — cheaper than validating after the fact.
              minimumDate={new Date()}
              onChange={(_event, date) => {
                if (Platform.OS !== 'ios') setShowPicker(false);
                if (date) update({ endsAt: date.toISOString() });
              }}
            />
            {Platform.OS === 'ios' ? (
              <Button label={copy.common.done} variant="secondary" onPress={() => setShowPicker(false)} />
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: spacing.xxs, paddingTop: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary">
            {copy.create.timezoneLabel}
          </AppText>
          {/* Shown rather than editable: it is the device zone, and in practice
              a host sets up their event in the place it happens. Editing it
              belongs in advanced settings, not on the critical path. */}
          <AppText variant="body" tone="secondary">
            {draft.timezone}
          </AppText>
        </View>
      </View>
    </CreationStepScreen>
  );
}
