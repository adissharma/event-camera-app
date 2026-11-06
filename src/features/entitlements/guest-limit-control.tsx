import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, fontFamilies, radii, spacing } from '@/design';
import { stepGuestLimit } from './guest-limit';

const BUTTON_SIZE = 52;

/**
 * Chooses a number of guests.
 *
 * `max` is the package's ceiling, or `null` when it has none. Reaching for more than
 * that is reported rather than swallowed, so a screen can answer it with an upgrade.
 */
export function GuestLimitStepper({
  value,
  max,
  onChange,
  onExceededMax,
}: {
  value: number;
  max: number | null;
  onChange: (value: number) => void;
  onExceededMax?: () => void;
}) {
  // What is being typed, which can briefly be empty on the way to a number.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  // Applied as it is typed, because a tap on Save does not end editing first.
  const changeText = (next: string) => {
    const digits = next.replace(/[^0-9]/g, '').slice(0, 5);
    setText(digits);
    const typed = parseInt(digits, 10);
    if (!Number.isFinite(typed) || typed < 1) return;
    if (max !== null && typed > max) {
      onChange(max);
      setText(String(max));
      onExceededMax?.();
      return;
    }
    onChange(typed);
  };

  const step = (direction: 1 | -1) => {
    if (direction === 1 && max !== null && value >= max) {
      onExceededMax?.();
      return;
    }
    onChange(stepGuestLimit(value, direction, max));
  };

  return (
    <View style={S.row}>
      <StepButton symbol="−" label="Fewer guests" disabled={value <= 1} onPress={() => step(-1)} />
      <TextInput
        value={text}
        onChangeText={changeText}
        onEndEditing={() => setText(String(value))}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel="Number of guests"
        style={S.input}
      />
      <StepButton symbol="+" label="More guests" onPress={() => step(1)} />
    </View>
  );
}

function StepButton({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={6}
      style={({ pressed }) => [S.button, disabled && S.buttonDisabled, pressed && S.buttonPressed]}
    >
      <AppText variant="titleLarge" style={S.symbol}>
        {symbol}
      </AppText>
    </Pressable>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surfaceRaised,
  },
  buttonDisabled: { opacity: 0.35 },
  buttonPressed: { opacity: 0.7 },
  symbol: { color: '#FFFFFF' },
  input: {
    flex: 1,
    height: BUTTON_SIZE,
    borderRadius: radii.lg,
    backgroundColor: colours.surfaceRaised,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 22,
  },
});
