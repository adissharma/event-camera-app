import { View } from 'react-native';

import { OptionCard } from '@/components/forms/option-card';
import { OverlappingPreviews } from '@/features/celebrations/creation/overlapping-previews';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { PHOTO_TREATMENT_OPTIONS } from '@/features/media/photo-treatment';
import { spacing } from '@/design';
import { copy } from '@/i18n';

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

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {PHOTO_TREATMENT_OPTIONS.map((treatment) => (
            <OptionCard
              key={treatment.value}
              label={treatment.label}
              description={treatment.description}
              selected={draft.photoTreatment === treatment.value}
              layoutMode="vertical"
              style={{ flex: 1, alignSelf: 'stretch' }}
              onPress={() => {
                update({
                  photoTreatment: treatment.value,
                  dateStampEnabled: treatment.value === 'disposable',
                });
              }}
            />
          ))}
        </View>
      </View>
    </CreationStepScreen>
  );
}
