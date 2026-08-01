import { View } from 'react-native';

import { OptionCard } from '@/components/forms/option-card';
import { OverlappingPreviews } from '@/features/celebrations/creation/overlapping-previews';
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
        <OverlappingPreviews treatment={draft.photoTreatment} />

        {TREATMENTS.map((treatment) => (
          <OptionCard
            key={treatment.value}
            label={treatment.label}
            description={treatment.description}
            selected={draft.photoTreatment === treatment.value}
            onPress={() => {
              update({
                photoTreatment: treatment.value,
                dateStampEnabled: treatment.value === 'disposable',
              });
            }}
          />
        ))}
      </View>
    </CreationStepScreen>
  );
}
