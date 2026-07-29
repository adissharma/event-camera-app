import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './text';
import { colours, layout, radii, spacing } from '@/design';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A modal sheet for a single focused edit.
 *
 * Used instead of navigating to another screen so the host never loses sight of
 * the cover they are editing — the whole point of this step is watching the
 * preview change.
 *
 * Tapping the scrim closes it. `onRequestClose` is wired too, which is what
 * makes the Android back gesture dismiss the sheet rather than the screen
 * beneath it.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colours.scrim, justifyContent: 'flex-end' }}
      >
        {/* Stops a tap inside the sheet from reaching the scrim behind it. */}
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colours.surfaceRaised,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            borderTopWidth: layout.hairline,
            borderColor: colours.borderSubtle,
            paddingHorizontal: layout.gutter,
            paddingTop: spacing.base,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.lg,
          }}
        >
          {/* Grabber. Purely a visual affordance that this is a sheet. */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: colours.borderStrong,
              alignSelf: 'center',
            }}
          />

          <AppText variant="titleMedium">{title}</AppText>

          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
