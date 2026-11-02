import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

export type SeatView = 'seat' | 'plan';

const OPTIONS: { value: SeatView; label: string }[] = [
  { value: 'seat', label: 'Your seat' },
  { value: 'plan', label: 'Floor plan' },
];

/** Switches a guest between their seat and the host's floor plan. */
export function SeatViewToggle({ value, onChange }: { value: SeatView; onChange: (next: SeatView) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <AppText variant="label" style={selected ? styles.labelSelected : styles.label}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderRadius: radii.pill,
  },
  optionSelected: {
    backgroundColor: colours.surfaceRaised,
  },
  label: {
    color: colours.textSecondary,
  },
  labelSelected: {
    color: colours.textPrimary,
  },
});
