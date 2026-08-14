import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { LockIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

const PREVIEW_IMAGES = [
  require('../../../../assets/images/placeholders/christian_wedding.png'),
  require('../../../../assets/images/placeholders/hindu_wedding.png'),
  require('../../../../assets/images/placeholders/treatment_preview_1.png'),
] as const;

export function RevealPreview({
  locked,
  message,
}: {
  locked: boolean;
  message: string;
}) {
  return (
    <View style={styles.previewContainer}>
      <View style={styles.photoRow}>
        {PREVIEW_IMAGES.map((imgSrc, index) => (
          <View key={index} style={styles.photoTile}>
            <Image
              source={imgSrc}
              style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
              resizeMode="cover"
              blurRadius={locked ? 20 : 0}
            />

            {locked ? (
              <View style={styles.lockOverlay}>
                <View style={styles.lockCircle}>
                  <LockIcon size={18} color="#FFFFFF" />
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <AppText style={styles.statusText}>{message}</AppText>
    </View>
  );
}

export function ChoiceTile({
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
      style={({ pressed }) => [
        styles.choiceTile,
        selected ? styles.choiceTileSelected : null,
        pressed ? { opacity: 0.92 } : null,
      ]}
    >
      <AppText variant="label" tone={selected ? 'onBrand' : 'secondary'} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

export function PickerModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.modalDoneBtn}>
              <AppText variant="labelLarge" style={styles.modalDoneText}>
                Done
              </AppText>
            </Pressable>
          </View>
          <View style={styles.modalBody}>{children}</View>
        </View>
      </Pressable>
    </Modal>
  );
}

export const revealSharedStyles = StyleSheet.create({
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 48,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectorText: {
    color: colours.textPrimary,
  },
});

const styles = StyleSheet.create({
  previewContainer: {
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoTile: {
    width: 96,
    aspectRatio: 9 / 16,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colours.surfaceMuted,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  lockCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statusText: {
    color: colours.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  choiceTile: {
    flex: 1,
    minHeight: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
  },
  choiceTileSelected: {
    backgroundColor: colours.brandPrimary,
    borderWidth: 0,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.base,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderSubtle,
  },
  modalDoneBtn: {
    paddingHorizontal: spacing.sm,
  },
  modalDoneText: {
    color: colours.brandPrimary,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.base,
    alignItems: 'center',
  },
});
