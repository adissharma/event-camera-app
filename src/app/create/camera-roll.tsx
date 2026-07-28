import { View } from 'react-native';

import { ToggleRow } from '@/components/forms/toggle-row';
import { Stepper } from '@/components/forms/stepper';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { spacing } from '@/design';
import { copy } from '@/i18n';

/**
 * Camera-roll settings.
 *
 * Deliberately framed as "Allow older photos" rather than anything resembling
 * "loosen restrictions". These are independent on/off settings, so they are
 * toggles — not radio cards, which would imply they are mutually exclusive.
 */
export default function CameraRollStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen
      step="camera-roll"
      heading={copy.create.olderPhotosHeading}
      supporting={copy.create.olderPhotosSupporting}
    >
      <View style={{ gap: spacing.base }}>
        <ToggleRow
          label="Let guests add from their camera roll"
          description="As well as taking photos in the app."
          value={draft.cameraRollUploadsEnabled}
          onValueChange={(cameraRollUploadsEnabled) =>
            update({
              cameraRollUploadsEnabled,
              // Keep capture mode consistent with the toggle, so the guest app
              // never offers a picker that the event will then refuse.
              captureMode: cameraRollUploadsEnabled ? 'camera_and_library' : 'camera_only',
            })
          }
        />

        {draft.cameraRollUploadsEnabled ? (
          <>
            <Stepper
              label={copy.create.cameraRollLimit}
              value={draft.cameraRollUploadLimit}
              min={0}
              max={100}
              step={5}
              onChange={(cameraRollUploadLimit) => update({ cameraRollUploadLimit })}
            />

            <ToggleRow
              label={copy.create.cameraRollAfterClose}
              description="Useful for the photos people find the next morning."
              value={draft.cameraRollUploadsAfterClose}
              onValueChange={(cameraRollUploadsAfterClose) =>
                update({ cameraRollUploadsAfterClose })
              }
            />

            <ToggleRow
              label="Allow photos taken on any date"
              description="Guests can add relevant photos from before the event."
              value={draft.allowMediaFromAnyDate}
              onValueChange={(allowMediaFromAnyDate) => update({ allowMediaFromAnyDate })}
            />
          </>
        ) : null}
      </View>
    </CreationStepScreen>
  );
}
