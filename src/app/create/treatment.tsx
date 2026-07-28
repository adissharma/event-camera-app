import { View } from 'react-native';

import { OptionCard } from '@/components/forms/option-card';
import { ToggleRow } from '@/components/forms/toggle-row';
import { AppText } from '@/components/ui/text';
import { VisualPlaceholder } from '@/components/media/visual-placeholder';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { spacing } from '@/design';
import { copy } from '@/i18n';
import type { PhotoTreatment } from '@/types/database';

const TREATMENTS: { value: PhotoTreatment; label: string; description: string }[] = [
  { value: 'original', label: copy.create.treatmentOriginal, description: 'Exactly as the camera saw it.' },
  { value: 'disposable', label: copy.create.treatmentDisposable, description: 'Direct flash, deep shadows, a little grain.' },
  { value: 'black_and_white', label: copy.create.treatmentBlackAndWhite, description: 'Quiet and timeless.' },
  { value: 'warm_film', label: copy.create.treatmentWarmFilm, description: 'Warm cast, soft highlights.' },
];

export default function TreatmentStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen
      step="treatment"
      heading={copy.create.treatmentHeading}
      supporting={copy.create.treatmentSupporting}
    >
      <View style={{ gap: spacing.base }}>
        {/* One sample photograph, so the comparison is between treatments
            rather than between different images. */}
        <VisualPlaceholder assetKey="theme_film" aspectRatio={4 / 3} />

        {TREATMENTS.map((treatment) => (
          <OptionCard
            key={treatment.value}
            label={treatment.label}
            description={treatment.description}
            selected={draft.photoTreatment === treatment.value}
            onPress={() => update({ photoTreatment: treatment.value })}
          />
        ))}

        {draft.photoTreatment === 'disposable' ? (
          <ToggleRow
            label={copy.create.dateStamp}
            description="The little orange date in the corner."
            value={draft.dateStampEnabled}
            onValueChange={(dateStampEnabled) => update({ dateStampEnabled })}
          />
        ) : null}

        <AppText variant="bodySmall" tone="secondary" style={{ paddingTop: spacing.sm }}>
          Your originals are always kept, untouched. A treatment can be changed or
          removed at any time, even after the event.
        </AppText>
      </View>
    </CreationStepScreen>
  );
}
