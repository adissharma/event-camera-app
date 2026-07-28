import { View } from 'react-native';

import { OptionCard } from '@/components/forms/option-card';
import { ToggleRow } from '@/components/forms/toggle-row';
import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { spacing } from '@/design';
import { copy } from '@/i18n';
import type { GalleryVisibility } from '@/types/database';

/**
 * Visibility is a mutually exclusive choice, so it uses radio-style cards.
 * The three settings below it are genuinely independent, so they use toggles.
 * Mixing the two idioms is what makes a privacy screen ambiguous, which is the
 * last screen where a host should have to guess.
 */
const VISIBILITY_OPTIONS: {
  value: GalleryVisibility;
  label: string;
  description: string;
}[] = [
  {
    value: 'all_guests',
    label: copy.create.privacyAllGuests,
    description: 'Once revealed, every guest sees the whole gallery.',
  },
  {
    value: 'own_only',
    label: copy.create.privacyOwnOnly,
    description: 'Guests see what they took, and nothing else.',
  },
  {
    value: 'hosts_only',
    label: copy.create.privacyHostsOnly,
    description: 'Nobody but you, until you decide to share.',
  },
];

export default function PrivacyStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen step="privacy" heading={copy.create.privacyHeading}>
      <View style={{ gap: spacing.base }}>
        {VISIBILITY_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            description={option.description}
            selected={draft.galleryVisibility === option.value}
            onPress={() => update({ galleryVisibility: option.value })}
          />
        ))}

        <AppText variant="eyebrow" tone="secondary" style={{ paddingTop: spacing.base }}>
          Also
        </AppText>

        <ToggleRow
          label={copy.create.pinRequired}
          description="Guests enter a short PIN before they can join."
          value={draft.pinRequired}
          onValueChange={(pinRequired) =>
            update({ pinRequired, pin: pinRequired ? draft.pin : null })
          }
        />

        {draft.pinRequired ? (
          <TextField
            label="Event PIN"
            placeholder="4 to 8 digits"
            value={draft.pin ?? ''}
            onChangeText={(next) => update({ pin: next.replace(/\D/g, '').slice(0, 8) })}
            keyboardType="number-pad"
            maxLength={8}
            hint="Share this with your guests alongside the QR code."
          />
        ) : null}

        <ToggleRow
          label={copy.create.guestDownloads}
          description="Guests can save photos to their own phone."
          value={draft.guestDownloadsEnabled}
          onValueChange={(guestDownloadsEnabled) => update({ guestDownloadsEnabled })}
        />

        <ToggleRow
          label={copy.create.hostApproval}
          description="You review each photo before it joins the gallery."
          value={draft.moderationEnabled}
          onValueChange={(moderationEnabled) => update({ moderationEnabled })}
        />
      </View>
    </CreationStepScreen>
  );
}
