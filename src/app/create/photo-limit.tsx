import { useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ExpandingSection } from '@/components/feedback/expanding-section';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { CaptureLimitPreview } from '@/features/celebrations/creation/capture-limit-preview';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { copy } from '@/i18n';
import { useEventEntitlements } from '@/features/entitlements/use-event-entitlements';
import { upgradesForFeature } from '@/features/entitlements/event-entitlements';
import { UpgradeSheet } from '@/features/entitlements/upgrade-sheet';

const LIMITED_COUNT_OPTIONS = [5, 10, 16, 24, 36] as const;
const DEFAULT_LIMITED_COUNT = 16;

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

  const storedCount = draft.shotLimitPerGuest;
  const hasLimitedSelection = typeof storedCount === 'number' && Number.isFinite(storedCount);
  const selectedCaptureMode =
    storedCount === null ? 'unlimited' : hasLimitedSelection ? 'limited' : null;

  function selectLimited(nextChoice?: (typeof LIMITED_COUNT_OPTIONS)[number]) {
    const resolvedChoice = nextChoice ?? inferLimitedChoice(storedCount) ?? DEFAULT_LIMITED_COUNT;

    void Haptics.selectionAsync().catch(() => {});
    update({ shotLimitPerGuest: resolvedChoice });
  }

  function selectUnlimited() {
    // Intercepted before the write, never after. Applying it and rolling back
    // on a cancelled purchase would briefly grant an allowance the event has
    // not paid for, and this draft is saved as the host moves through it.
    if (unlimitedGated) {
      void Haptics.selectionAsync().catch(() => {});
      setUpgradeOpen(true);
      return;
    }
    void Haptics.selectionAsync().catch(() => {});
    update({ shotLimitPerGuest: null });
  }

  return (
    <CreationStepScreen
      step="photo-limit"
      heading={copy.create.photoLimitHeading}
      scrollable={false}
    >
      <View style={{ flex: 1, gap: spacing.base }}>
        <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
          <CaptureLimitPreview limit={storedCount} coverSource={coverSource} />
        </View>

        <View style={{ gap: spacing.base }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' }}>
            <CaptureModeCard
              title={copy.create.photoLimitLimited}
              description={copy.create.photoLimitLimitedDescription}
              selected={selectedCaptureMode === 'limited'}
              onPress={() => selectLimited()}
              style={{ flex: 1 }}
            />

            <CaptureModeCard
              title={copy.create.photoLimitUnlimited}
              description={copy.create.photoLimitUnlimitedDescription}
              selected={selectedCaptureMode === 'unlimited'}
              onPress={selectUnlimited}
              // Visible and tappable, just not yet applicable — the host is
              // the one who can change that, so the card's job is to be found.
              style={{ flex: 1, opacity: unlimitedGated ? 0.55 : 1 }}
            />
          </View>

          <ExpandingSection expanded={selectedCaptureMode === 'limited'}>
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {LIMITED_COUNT_OPTIONS.map((option) => (
                  <CountChoiceChip
                    key={option}
                    label={String(option)}
                    selected={storedCount === option}
                    onPress={() => selectLimited(option)}
                  />
                ))}
              </View>
            </View>
          </ExpandingSection>
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

function CaptureModeCard({
  title,
  description,
  selected,
  onPress,
  style,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [
        {
          gap: spacing.sm,
          padding: spacing.base,
          borderRadius: radii.lg,
          backgroundColor: selected ? colours.brandSoft : colours.surface,
          borderWidth: selected ? 2 : layout.hairline,
          borderColor: selected ? colours.brandPrimary : colours.borderStrong,
          minHeight: 124,
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.base }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="labelLarge">{title}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        </View>

        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: selected ? 0 : layout.hairline,
            borderColor: colours.borderStrong,
            backgroundColor: selected ? colours.brandPrimary : 'transparent',
            marginTop: 2,
          }}
        >
          {selected ? (
            <AppText variant="caption" tone="onBrand">
              ✓
            </AppText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function CountChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minWidth: 58,
        minHeight: layout.minTouchTarget,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colours.brandPrimary : colours.surfaceMuted,
        borderWidth: selected ? 0 : layout.hairline,
        borderColor: colours.borderStrong,
      }}
    >
      <AppText variant="label" tone={selected ? 'onBrand' : 'secondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function inferLimitedChoice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return LIMITED_COUNT_OPTIONS.includes(value as (typeof LIMITED_COUNT_OPTIONS)[number])
    ? (value as (typeof LIMITED_COUNT_OPTIONS)[number])
    : DEFAULT_LIMITED_COUNT;
}
