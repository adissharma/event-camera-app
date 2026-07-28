import { View } from 'react-native';

import { OptionCard } from '@/components/forms/option-card';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { FEATURE_FLAGS } from '@/config/feature-flags';
import { spacing } from '@/design';
import { copy } from '@/i18n';

/**
 * Contribution formats.
 *
 * Unavailable formats are shown and labelled "Coming later" rather than
 * rendered as working controls. The brief is explicit: never create a
 * misleading control. A card that looks selectable and then silently does
 * nothing is worse than an honest one that says it is not ready.
 *
 * The Memory Book is listed separately and described as the organised final
 * output — it is NOT another name for audio or video.
 */
export default function FormatsStep() {
  const { draft } = useCreationDraft();

  const upcoming = [
    { key: 'video', label: copy.create.formatVideo, description: 'Short clips from guests.', enabled: FEATURE_FLAGS.videoContributions },
    { key: 'audio', label: copy.create.formatAudio, description: 'A spoken message for the couple.', enabled: FEATURE_FLAGS.audioGuestbook },
    { key: 'messages', label: copy.create.formatMessages, description: 'Written notes alongside photos.', enabled: FEATURE_FLAGS.writtenMessages },
    { key: 'memory-book', label: copy.create.formatMemoryBook, description: 'Photos, messages, audio and video, gathered into one keepsake.', enabled: FEATURE_FLAGS.memoryBook },
  ];

  return (
    <CreationStepScreen
      step="formats"
      heading={copy.create.formatsHeading}
      supporting={copy.create.formatsSupporting}
    >
      <View style={{ gap: spacing.base }}>
        <OptionCard
          label={copy.create.formatPhoto}
          description="Included with every event."
          selected={draft.allowedMediaTypes.includes('photo')}
          // Photo is the product. Turning it off would leave an event with no
          // way to contribute at all, so it is not offered as a choice.
          onPress={() => {}}
        />

        <AppText variant="eyebrow" tone="secondary" style={{ paddingTop: spacing.base }}>
          {copy.create.comingLater}
        </AppText>

        {upcoming.map((format) => (
          <OptionCard
            key={format.key}
            label={format.label}
            description={format.description}
            selected={false}
            locked={!format.enabled}
            lockedReason={format.enabled ? undefined : copy.create.comingLater}
            onPress={() => {}}
          />
        ))}
      </View>
    </CreationStepScreen>
  );
}
