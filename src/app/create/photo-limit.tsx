import { View } from 'react-native';

import { OptionCard } from '@/components/forms/option-card';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { PHOTO_LIMIT_OPTIONS } from '@/config/app-config';
import { spacing } from '@/design';
import { copy, t } from '@/i18n';

export default function PhotoLimitStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen
      step="photo-limit"
      heading={copy.create.photoLimitHeading}
      supporting={copy.create.photoLimitSupporting}
    >
      <View style={{ gap: spacing.base }}>
        {PHOTO_LIMIT_OPTIONS.map((option) => {
          const isUnlimited = option === null;
          return (
            <OptionCard
              key={String(option)}
              label={
                isUnlimited
                  ? copy.create.photoLimitUnlimited
                  : t(copy.create.photoLimitCount, { count: option })
              }
              description={
                isUnlimited
                  ? 'Guests shoot as much as they like'
                  : undefined
              }
              // Labelled honestly rather than hidden. The host can still choose
              // it; the package step is where it is actually paid for, and
              // saying so here avoids a surprise two screens later.
              lockedReason={isUnlimited ? 'Included with Signature and above' : undefined}
              selected={draft.shotLimitPerGuest === option}
              onPress={() => update({ shotLimitPerGuest: option })}
            />
          );
        })}

        <AppText variant="bodySmall" tone="secondary" style={{ paddingTop: spacing.sm }}>
          You can change this later, right up until your event closes.
        </AppText>
      </View>
    </CreationStepScreen>
  );
}
