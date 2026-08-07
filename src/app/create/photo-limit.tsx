import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { ToggleRow } from '@/components/forms/toggle-row';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

/** The numbered choices, shown as a compact row rather than a full-width list. */
const COUNT_OPTIONS = [5, 10, 15, 25] as const;

/** The unlimited add-on price, by currency. Only these two exist today. */
const UNLIMITED_PRICE_BY_CURRENCY: Record<string, string> = { GBP: '+£4.99', USD: '+$7.99' };
const UNLIMITED_PRICE = UNLIMITED_PRICE_BY_CURRENCY[LOCALE_CONFIG.currency] ?? '+£4.99';

export default function PhotoLimitStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen
      step="photo-limit"
      heading={copy.create.photoLimitHeading}
      supporting={copy.create.photoLimitSupporting}
    >
      <View style={{ gap: spacing.base }}>
        {/* The number itself is the whole label — "photos" is implied by the
            heading above, and spelling it out on every chip left no room to
            keep all four on one row. */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {COUNT_OPTIONS.map((option) => (
            <CountChip
              key={option}
              count={option}
              selected={draft.shotLimitPerGuest === option}
              onPress={() => update({ shotLimitPerGuest: option })}
            />
          ))}
        </View>

        <UnlimitedCard
          selected={draft.shotLimitPerGuest === null}
          onPress={() => update({ shotLimitPerGuest: null })}
        />

        <View
          style={{
            height: layout.hairline,
            backgroundColor: colours.borderSubtle,
            marginVertical: spacing.xs,
          }}
        />

        <ToggleRow
          label={copy.create.cameraRollToggle}
          description={copy.create.cameraRollToggleDescription}
          value={draft.cameraRollUploadsEnabled}
          onValueChange={(cameraRollUploadsEnabled) =>
            update({
              cameraRollUploadsEnabled,
              captureMode: cameraRollUploadsEnabled ? 'camera_and_library' : 'camera_only',
              cameraRollAnytime: true,
            })
          }
        />

        <ToggleRow
          label="Let guests view photos taken by others"
          value={draft.galleryVisibility === 'all_guests'}
          onValueChange={(allowed) =>
            update({ galleryVisibility: allowed ? 'all_guests' : 'own_only' })
          }
        />
      </View>
    </CreationStepScreen>
  );
}

/** One number in the compact row. */
function CountChip({
  count,
  selected,
  onPress,
}: {
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${count} photos per guest`}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.base,
        borderRadius: radii.lg,
        backgroundColor: selected ? colours.brandSoft : colours.surface,
        borderWidth: selected ? 2 : layout.hairline,
        borderColor: selected ? colours.brandPrimary : colours.borderStrong,
      }}
    >
      <AppText variant="labelLarge">{count}</AppText>
    </Pressable>
  );
}

/**
 * The unlimited option, called out as the option the host is nudged toward.
 *
 * Visually distinct even when unselected — the Instagram gradient border and
 * "Popular" tag are always there, not just on selection — because the point
 * is to draw the eye here first, not to wait until it's already chosen.
 */
function UnlimitedCard({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  // Instagram-style gradient border (same as challenge highlights)
  const GRADIENT_COLORS = ['#C13584', '#E1306C', '#F77737', '#FCAF45'] as const;

  return (
    <LinearGradient
      colors={GRADIENT_COLORS}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{
        borderRadius: radii.lg,
        padding: 2,
      }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${copy.create.photoLimitUnlimited}. Guests shoot as much as they like. ${UNLIMITED_PRICE}.`}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={{
          padding: spacing.base,
          borderRadius: radii.lg,
          backgroundColor: selected ? colours.brandSoft : colours.surface,
          gap: spacing.xxs,
        }}
      >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="labelLarge">{copy.create.photoLimitUnlimited}</AppText>
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radii.pill,
              backgroundColor: colours.brandPrimary,
            }}
          >
            <AppText variant="caption" tone="onBrand">
              Popular
            </AppText>
          </View>
        </View>

        {/* The non-colour selection signal every other card in this flow
            uses — a ring when unselected, a filled tick when selected. */}
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
          }}
        >
          {selected ? (
            <AppText variant="caption" tone="onBrand">
              ✓
            </AppText>
          ) : null}
        </View>
      </View>

      <AppText variant="bodySmall" tone="secondary">
        Guests shoot as much as they like
      </AppText>

      <AppText variant="labelLarge" tone="brand">
        {UNLIMITED_PRICE}
      </AppText>
      </Pressable>
    </LinearGradient>
  );
}
