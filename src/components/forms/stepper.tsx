import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

/**
 * A controlled number.
 *
 * Used instead of a text field wherever the range is small and bounded: a
 * keyboard invites "500" into a field that means five, and then the form has to
 * argue with the user about it.
 */
export function Stepper({ label, value, min, max, step = 1, onChange }: StepperProps) {
  const decrease = () => commit(Math.max(min, value - step));
  const increase = () => commit(Math.min(max, value + step));

  function commit(next: number) {
    if (next === value) return;
    void Haptics.selectionAsync().catch(() => {});
    onChange(next);
  }

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
      }}
    >
      <AppText variant="labelLarge" style={{ flex: 1 }}>
        {label}
      </AppText>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <StepperButton label="Decrease" symbol="−" onPress={decrease} disabled={value <= min} />
        {/* Tabular figures so the number does not shift as it changes width. */}
        <AppText
          variant="numeric"
          style={{ minWidth: 32, textAlign: 'center' }}
          accessibilityLiveRegion="polite"
        >
          {value}
        </AppText>
        <StepperButton label="Increase" symbol="+" onPress={increase} disabled={value >= max} />
      </View>
    </View>
  );
}

function StepperButton({
  label,
  symbol,
  onPress,
  disabled,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: layout.hairline,
        borderColor: colours.borderStrong,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <AppText variant="labelLarge">{symbol}</AppText>
    </Pressable>
  );
}
