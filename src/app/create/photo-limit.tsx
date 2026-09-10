import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui/text';
import { spacing, useMotion } from '@/design';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { CaptureLimitPreview } from '@/features/celebrations/creation/capture-limit-preview';
import { MOMENT_LIMIT_VALUES, MomentLimit, SteppedSlider } from '@/components/forms/stepped-slider';
import { useCoverSource } from '@/features/celebrations/cover-source';
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
  const coverSource = useCoverSource(draft.coverLocalUri ?? draft.coverStoragePath);

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
  const motion = useMotion();

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

  function selectLimit(value: MomentLimit) {
    if (value === null && unlimitedGated) {
      setUpgradeOpen(true);
      return;
    }
    update({ shotLimitPerGuest: value });
  }

  const limitCopy = LIMIT_COPY[selectedLimit === null ? 'unlimited' : String(selectedLimit) as '5' | '10' | '16' | '24' | '36'];

  return (
    <CreationStepScreen
      step="photo-limit"
      heading={copy.create.photoLimitHeading}
      headingAlign="center"
      scrollable={false}
    >
      <View style={{ flex: 1, gap: spacing.base, paddingBottom: spacing.xl }}>
        <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
          <CaptureLimitPreview limit={storedCount} coverSource={coverSource} />
        </View>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="numericLarge" align="center">
            {selectedLimit === null ? '∞' : selectedLimit}
          </AppText>
          <LimitCopy text={limitCopy} duration={motion.duration('micro')} />
          <View style={{ width: '100%', marginTop: spacing.lg }}>
            <SteppedSlider value={selectedLimit} onValueChange={selectLimit} />
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

function LimitCopy({ text, duration }: { text: string; duration: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(0);
    opacity.set(withTiming(1, { duration }));
  }, [duration, opacity, text]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={style}>
      <AppText variant="bodyLarge" tone="secondary" align="center" numberOfLines={1} adjustsFontSizeToFit>
        {text}
      </AppText>
    </Animated.View>
  );
}
