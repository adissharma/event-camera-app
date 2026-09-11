import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { CaptureLimitPreview } from '@/features/celebrations/creation/capture-limit-preview';
import { MOMENT_LIMIT_VALUES, MomentLimit, SteppedSlider } from '@/components/forms/stepped-slider';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { copy } from '@/i18n';
import { useEventEntitlements } from '@/features/entitlements/use-event-entitlements';
import { upgradesForFeature } from '@/features/entitlements/event-entitlements';
import { UpgradeSheet } from '@/features/entitlements/upgrade-sheet';

const LIMIT_COPY: Record<'5' | '10' | '16' | '24' | '36' | 'unlimited', string> = {
  5: 'Five shots. Make them count.',
  10: 'A little room to play.',
  16: 'Plenty for the best bits.',
  24: 'More moments, fewer regrets.',
  36: 'Go on, get snap-happy.',
  unlimited: 'Unlimited. Snap without counting.',
};

export default function PhotoLimitStep() {
  const { draft, update } = useCreationDraft();

  /*
   * Present only when this step was opened from Manage Event, i.e. the event
   * is already published and already on a package. During creation there is
   * no id and no gate — the host chooses, and the paywall at the end prices
   * what they chose.
   */
  const { celebrationId } = useLocalSearchParams<{ celebrationId?: string }>();
  const entitlements = useEventEntitlements(celebrationId ?? null);
  const unlimitedGated = Boolean(celebrationId) && !entitlements.has('unlimitedPhotos');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const storedCount = draft.shotLimitPerGuest;
  const selectedLimit: MomentLimit =
    storedCount === undefined || storedCount === null
      ? null
      : MOMENT_LIMIT_VALUES.includes(storedCount as Exclude<MomentLimit, null>)
        ? storedCount as Exclude<MomentLimit, null>
        : 16;

  useEffect(() => {
    if (storedCount === undefined && !unlimitedGated) {
      update({ shotLimitPerGuest: null });
    } else if (storedCount !== null && storedCount !== undefined && selectedLimit !== storedCount) {
      update({ shotLimitPerGuest: selectedLimit });
    }
  }, [selectedLimit, storedCount, unlimitedGated, update]);

  /**
   * What the thumb is over right now, which is not yet what has been chosen.
   *
   * Cleared on commit so the label falls back to the draft — holding it would
   * leave a stale number showing after a change from anywhere else.
   */
  const [previewLimit, setPreviewLimit] = useState<MomentLimit | undefined>(undefined);
  const shownLimit = previewLimit === undefined ? selectedLimit : previewLimit;

  function selectLimit(value: MomentLimit) {
    setPreviewLimit(undefined);
    if (value === null && unlimitedGated) {
      setUpgradeOpen(true);
      return;
    }
    update({ shotLimitPerGuest: value });
  }

  const limitCopy = LIMIT_COPY[shownLimit === null ? 'unlimited' : String(shownLimit) as '5' | '10' | '16' | '24' | '36'];

  return (
    <CreationStepScreen
      step="photo-limit"
      heading={copy.create.photoLimitHeading}
      headingAlign="center"
      scrollable={false}
    >
      {/* Phone and slider as one centred block. The preview used to take all
          the free space, which pushed the slider to the bottom of the screen
          and left the two reading as unrelated. */}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          gap: spacing.lg,
          paddingBottom: spacing.xl,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <CaptureLimitPreview limit={storedCount} />
        </View>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="numericLarge" align="center">
            {shownLimit === null ? '∞' : shownLimit}
          </AppText>
          <LimitCopy text={limitCopy} />
          <View style={{ width: '100%', marginTop: spacing.base }}>
            <SteppedSlider
              value={selectedLimit}
              onValueChange={selectLimit}
              onPreviewChange={setPreviewLimit}
            />
          </View>
        </View>
      </View>

      {/* The same upgrade surface every other locked feature opens. On
          success the choice the host was making is applied for them. */}
      {upgradeOpen && celebrationId ? (
        <UpgradeSheet
          visible
          celebrationId={String(celebrationId)}
          currentPlan={entitlements.plan}
          options={upgradesForFeature(entitlements.plan, 'unlimitedPhotos')}
          title="Unlock unlimited photos"
          onClose={() => setUpgradeOpen(false)}
          onUpgraded={() => {
            setUpgradeOpen(false);
            update({ shotLimitPerGuest: null });
          }}
        />
      ) : null}
    </CreationStepScreen>
  );
}

function LimitCopy({ text }: { text: string }) {
  return (
    <View>
      <AppText variant="bodyLarge" tone="secondary" align="center" numberOfLines={1} adjustsFontSizeToFit>
        {text}
      </AppText>
    </View>
  );
}
