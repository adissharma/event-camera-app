import { View } from 'react-native';

import { RevealPreview } from '@/features/celebrations/creation/reveal-step-shared';
import { TreatmentSwatches } from '@/features/celebrations/creation/treatment-swatches';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { normalisePhotoTreatment } from '@/features/media/photo-treatment';
import { spacing } from '@/design';
import { copy } from '@/i18n';

export default function TreatmentStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen
      step="treatment"
      heading={copy.create.treatmentHeading}
      headingAlign="center"
      scrollable={false}
    >
      {/* The same block the reveal steps use — collage, then the control —
          so three consecutive steps put the photographs in one place and the
          choice beneath them rather than rearranging the screen each time. */}
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <RevealPreview locked={false} />

        <TreatmentSwatches
          selected={normalisePhotoTreatment(draft.photoTreatment)}
          onSelect={(photoTreatment) => {
            update({
              photoTreatment,
              dateStampEnabled: photoTreatment === 'disposable',
            });
          }}
        />
      </View>
    </CreationStepScreen>
  );
}
