import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { OptionCard } from '@/components/forms/option-card';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { resolveReveal, type RevealChoice } from '@/features/celebrations/draft/types';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, layout, radii, spacing } from '@/design';
import { copy, t } from '@/i18n';

const CHOICES: { value: RevealChoice; label: string; description: string }[] = [
  { value: 'during', label: copy.create.revealDuring, description: 'Photos appear as they are taken.' },
  { value: 'at_close', label: copy.create.revealAtClose, description: 'Everything lands the moment capture ends.' },
  { value: 'after_12h', label: copy.create.reveal12h, description: 'Something to wake up to.' },
  { value: 'after_24h', label: copy.create.reveal24h, description: 'A full day to let it settle.' },
  { value: 'custom', label: copy.create.revealCustom, description: 'Pick the exact moment.' },
  { value: 'manual', label: copy.create.revealManual, description: 'Nothing appears until you release it.' },
];

export default function RevealStep() {
  const { draft, update } = useCreationDraft();
  const [showPicker, setShowPicker] = useState(false);
  // See closing.tsx — the default is captured on open, not during render.
  const [pickerDefault, setPickerDefault] = useState<Date | null>(null);

  const resolved = resolveReveal(draft.revealChoice, draft.endsAt, draft.customRevealAt);

  const revealLabel =
    resolved.mode === 'instant'
      ? 'Photos appear straight away'
      : resolved.mode === 'manual'
        ? 'You choose when they appear'
        : resolved.revealAt
          ? t(copy.create.revealReturnAt, {
              time: new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
                weekday: 'long', day: 'numeric', month: 'long',
                hour: '2-digit', minute: '2-digit', timeZone: draft.timezone,
              }).format(new Date(resolved.revealAt)),
            })
          : 'Set a closing time first';

  return (
    <CreationStepScreen step="reveal" heading={copy.create.revealHeading}>
      <View style={{ gap: spacing.base }}>
        {CHOICES.map((choice) => (
          <OptionCard
            key={choice.value}
            label={choice.label}
            description={choice.description}
            selected={draft.revealChoice === choice.value}
            onPress={() => {
              update({ revealChoice: choice.value });
              if (choice.value === 'custom') {
                const base = draft.endsAt ? new Date(draft.endsAt).getTime() : Date.now();
                setPickerDefault(new Date(base + 43_200_000));
                setShowPicker(true);
              }
            }}
          />
        ))}

        {showPicker && draft.revealChoice === 'custom' ? (
          <View style={{ gap: spacing.sm }}>
            <DateTimePicker
              value={
                draft.customRevealAt
                  ? new Date(draft.customRevealAt)
                  : (pickerDefault ?? new Date())
              }
              mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
              // A reveal before the event closes contradicts the whole promise,
              // so the picker will not offer it.
              minimumDate={draft.endsAt ? new Date(draft.endsAt) : new Date()}
              onChange={(_event, date) => {
                if (Platform.OS !== 'ios') setShowPicker(false);
                if (date) update({ customRevealAt: date.toISOString() });
              }}
            />
            {Platform.OS === 'ios' ? (
              <Button label={copy.common.done} variant="secondary" onPress={() => setShowPicker(false)} />
            ) : null}
          </View>
        ) : null}

        {/* The developing state, previewed. This is what a guest sees between
            the event closing and the reveal, and it is the single most
            confusing thing to get wrong — so the host sees it here. */}
        <View
          style={{
            marginTop: spacing.base,
            padding: spacing.lg,
            borderRadius: radii.lg,
            backgroundColor: colours.surface,
            borderWidth: layout.hairline,
            borderColor: colours.borderSubtle,
            gap: spacing.xs,
          }}
        >
          <AppText variant="eyebrow" tone="secondary">
            {copy.create.revealDeveloping}
          </AppText>
          <AppText variant="titleMedium">{revealLabel}</AppText>
        </View>
      </View>
    </CreationStepScreen>
  );
}
