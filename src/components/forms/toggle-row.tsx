import { Switch, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

export interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * An independent on/off setting.
 *
 * Toggles are used ONLY for settings that are genuinely independent. A mutually
 * exclusive choice uses `OptionCard`, because a row of toggles where only one
 * may be on is the most common way a settings screen becomes ambiguous.
 */
export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  disabledReason,
}: ToggleRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.base,
        minHeight: layout.minTouchTarget,
        padding: spacing.base,
        borderRadius: radii.lg,
        backgroundColor: colours.surface,
        borderWidth: layout.hairline,
        borderColor: colours.borderSubtle,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="labelLarge">{label}</AppText>
        {description ? (
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        ) : null}
        {disabled && disabledReason ? (
          <AppText variant="caption" tone="warning">
            {disabledReason}
          </AppText>
        ) : null}
      </View>

      <Switch
        accessibilityLabel={label}
        accessibilityHint={disabled ? disabledReason : description}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colours.surfaceRaised, true: colours.brandPrimary }}
        thumbColor={value ? colours.textOnBrand : colours.textSecondary}
        ios_backgroundColor={colours.surfaceRaised}
      />
    </View>
  );
}
