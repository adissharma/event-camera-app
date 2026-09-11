import { View } from 'react-native';

import { RevealPreview } from '@/features/celebrations/creation/reveal-step-shared';
import { TreatmentSwatches } from '@/features/celebrations/creation/treatment-swatches';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { normalisePhotoTreatment } from '@/features/media/photo-treatment';
import { spacing } from '@/design';
import { copy } from '@/i18n';

/** Kept in step with `summarySlot` on the two reveal screens. */
const SUMMARY_SLOT_HEIGHT = 20;

export default function TreatmentStep() {
  const { draft, update } = useCreationDraft();
  const treatment = normalisePhotoTreatment(draft.photoTreatment);

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
        {/*
          The reveal steps put a summary line under their collage, and its
          slot is reserved whether or not there is anything in it. Centring
          divides what is left over, so that reserved height lifts the collage
          by half of it. This step has no summary — but it sits between those
          two, and the collage must not jump as the host moves through them,
          so it reserves the same space and holds the same position.

          Matches `summarySlot` and the `spacing.md` gap in `reveal.tsx` and
          `guest-reveal.tsx`.
        */}
        <View style={{ gap: spacing.md }}>
          <RevealPreview locked={false} treatment={treatment} />
          <View style={{ height: SUMMARY_SLOT_HEIGHT }} />
        </View>

        <TreatmentSwatches
          selected={treatment}
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
