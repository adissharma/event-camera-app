import { Pressable, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

export interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Shown instead of the tick when the option is not available on this plan. */
  locked?: boolean;
  lockedReason?: string;
  /** Right-aligned supplementary text, e.g. a price. */
  trailing?: string;
  style?: ViewStyle;
}

/**
 * A selectable card for a mutually exclusive choice.
 *
 * Selection is signalled three ways — tinted fill, doubled border weight, and a
 * tick glyph — because the design system forbids communicating state through
 * colour alone. On this palette the brand and success hues are both greens, so
 * the glyph is doing real work, not decoration.
 */
export function OptionCard({
  label,
  description,
  selected,
  onPress,
  locked = false,
  lockedReason,
  trailing,
  style,
}: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: locked }}
      accessibilityLabel={label}
      accessibilityHint={locked ? lockedReason : description}
      disabled={locked}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {
          // Haptics are unavailable on web and on some devices. Never let
          // feedback failure block the actual selection.
        });
        onPress();
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.base,
          minHeight: layout.minTouchTarget + 8,
          padding: spacing.base,
          borderRadius: radii.lg,
          backgroundColor: selected ? colours.brandSoft : colours.surface,
          borderWidth: selected ? 2 : layout.hairline,
          borderColor: selected ? colours.brandPrimary : colours.borderStrong,
          opacity: locked ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="labelLarge">{label}</AppText>
        {description ? (
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        ) : null}
        {locked && lockedReason ? (
          <AppText variant="caption" tone="warning">
            {lockedReason}
          </AppText>
        ) : null}
      </View>

      {trailing ? (
        <AppText variant="numeric" tone="secondary">
          {trailing}
        </AppText>
      ) : null}

      {/* The non-colour signal. A ring when unselected, a filled tick when
          selected, a lock when unavailable. */}
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
        {locked ? (
          <AppText variant="caption" tone="secondary">
            ✕
          </AppText>
        ) : selected ? (
          <AppText variant="caption" tone="onBrand">
            ✓
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
