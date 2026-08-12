import { Pressable, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ExpandingSection } from '@/components/feedback/expanding-section';
import { AppText } from '@/components/ui/text';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, layout, radii, spacing } from '@/design';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { copy } from '@/i18n';

const LIMITED_COUNT_OPTIONS = [5, 10, 16, 24, 36] as const;
const DEFAULT_LIMITED_COUNT = 16;

export default function PhotoLimitStep() {
  const { draft, update } = useCreationDraft();

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
    void Haptics.selectionAsync().catch(() => {});
    update({ shotLimitPerGuest: null });
  }

  return (
    <CreationStepScreen
      step="photo-limit"
      heading={copy.create.photoLimitHeading}
      scrollable={false}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: spacing.base }}>
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
            supporting={copy.create.photoLimitUnlimitedSupporting.replace('{price}', UNLIMITED_PRICE)}
            selected={selectedCaptureMode === 'unlimited'}
            onPress={selectUnlimited}
            style={{ flex: 1 }}
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
    </CreationStepScreen>
  );
}

function CaptureModeCard({
  title,
  description,
  supporting,
  selected,
  onPress,
  style,
}: {
  title: string;
  description: string;
  supporting?: string;
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
          {supporting ? (
            <AppText
              variant="bodySmall"
              tone="secondary"
              style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }}
            >
              {supporting}
            </AppText>
          ) : null}
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

const UNLIMITED_PRICE_BY_CURRENCY: Record<string, string> = { GBP: '+£4.99', USD: '+$7.99' };
const UNLIMITED_PRICE = UNLIMITED_PRICE_BY_CURRENCY[LOCALE_CONFIG.currency] ?? '+£4.99';
