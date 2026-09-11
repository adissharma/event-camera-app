import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { WheelPicker } from '@/components/forms/wheel-picker';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

const GUEST_DELAY_OPTIONS = [0, ...Array.from({ length: 24 }, (_, index) => index + 1)];

function labelForHour(hour: number): string {
  if (hour === 0) return 'Same time as me';
  return `${hour} ${hour === 1 ? 'hour' : 'hours'} after me`;
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
  const [selectedDelayHours, setSelectedDelayHours] = useState(() => initialDelayHours ?? 0);

  useEffect(() => {
    if (!visible) return;
    setSelectedDelayHours(initialDelayHours ?? 0);
  }, [initialDelayHours, visible]);

  const selectedHourIndex = useMemo(
    () => {
      const index = GUEST_DELAY_OPTIONS.indexOf(selectedDelayHours);
      return index >= 0 ? index : 0;
    },
    [selectedDelayHours],
  );

  function handleConfirm() {
    onConfirm(selectedDelayHours);
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

          <View style={S.wheelSlot}>
            <WheelPicker
              values={GUEST_DELAY_OPTIONS}
              selectedIndex={selectedHourIndex}
              onChange={(index) => setSelectedDelayHours(GUEST_DELAY_OPTIONS[index] ?? 0)}
              formatValue={labelForHour}
              accessibilityLabel="Guest photo reveal delay"
              visibleRows={5}
              width={260}
              fadeColor={colours.surfaceRaised}
            />
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
  wheelSlot: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
