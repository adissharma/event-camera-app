import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { WheelPicker } from '@/components/forms/wheel-picker';
import { Button } from '@/components/ui/button';
import { ClockIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

export type GuestDelayMode = 'same' | 'custom';

const HOURS = Array.from({ length: 24 }, (_, index) => index + 1);

function labelForHour(hour: number): string {
  return `${hour} ${hour === 1 ? 'hour' : 'hours'} after me`;
}

function modeFromDelay(delayHours: number | null): GuestDelayMode {
  if (delayHours === null || delayHours === 0) return 'same';
  return 'custom';
}

export function GuestRevealDelaySheet({
  visible,
  initialDelayHours,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initialDelayHours: number | null;
  onCancel: () => void;
  onConfirm: (delayHours: number | null) => void;
}) {
  const [mode, setMode] = useState<GuestDelayMode>(() => modeFromDelay(initialDelayHours));
  const [customHours, setCustomHours] = useState(() => Math.max(1, initialDelayHours ?? 12));

  useEffect(() => {
    if (!visible) return;
    setMode(modeFromDelay(initialDelayHours));
    setCustomHours(Math.max(1, initialDelayHours ?? 12));
  }, [initialDelayHours, visible]);

  const selectedHourIndex = useMemo(
    () => Math.max(0, Math.min(HOURS.length - 1, customHours - 1)),
    [customHours],
  );

  function handleConfirm() {
    if (mode === 'same') {
      onConfirm(0);
      return;
    }
    onConfirm(customHours);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={S.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel="Close"
        />
        <View style={S.sheet}>
          <View style={S.grabber} />

          <AppText variant="titleMedium" align="center" style={S.title}>
            Set time for guests to see photos
          </AppText>

          <View style={S.pills}>
            <ModePill
              label="Same time as me"
              selected={mode === 'same'}
              onPress={() => setMode('same')}
            />
            <ModePill
              label="Custom"
              icon
              selected={mode === 'custom'}
              onPress={() => setMode('custom')}
            />
          </View>

          <View style={S.wheelSlot}>
            {mode === 'custom' ? (
              <View style={S.customWheel}>
                <WheelPicker
                  values={HOURS}
                  selectedIndex={selectedHourIndex}
                  onChange={(index) => {
                    setMode('custom');
                    setCustomHours(HOURS[index]);
                  }}
                  formatValue={labelForHour}
                  accessibilityLabel="Hours after you"
                  visibleRows={3}
                  width={210}
                  fadeColor={colours.surfaceRaised}
                />
              </View>
            ) : null}
          </View>

          <View style={S.actions}>
            <View style={S.action}>
              <Button label="Cancel" variant="secondary" onPress={onCancel} />
            </View>
            <View style={S.action}>
              <Button label="Set timing" onPress={handleConfirm} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModePill({
  label,
  selected,
  icon = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  icon?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        S.pill,
        selected ? S.pillSelected : S.pillIdle,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon ? (
        <ClockIcon size={15} color={selected ? colours.textOnBrand : colours.textSecondary} />
      ) : null}
      <AppText
        variant="labelLarge"
        align="center"
        style={{ color: selected ? colours.textOnBrand : colours.textSecondary }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const S = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    paddingBottom: 34,
    gap: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.borderStrong,
  },
  title: {
    marginTop: spacing.xs,
  },
  pills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  pillSelected: {
    backgroundColor: colours.brandPrimary,
  },
  pillIdle: {
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
  },
  wheelSlot: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customWheel: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
