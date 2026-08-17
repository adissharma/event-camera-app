import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { colours, layout, radii, spacing } from '@/design';

/**
 * Device-level, not per-event: once a host has seen the pitch for Challenge
 * Packs once, it should not resurface for their next event either.
 */
const SEEN_KEY = '__seen_challenge_packs_intro';

export async function hasSeenChallengePacksIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markChallengePacksIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Non-fatal: worst case the intro shows once more.
  }
}

export function ChallengePacksIntroModal({
  visible,
  onGetStarted,
}: {
  visible: boolean;
  onGetStarted: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={S.backdrop}>
        <View style={[S.card, { marginBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <AppText variant="titleMedium" align="center" style={S.title}>
            Get more perspectives from your guests
          </AppText>
          <AppText variant="body" tone="secondary" align="center" style={S.body}>
            Challenges give guests simple ideas for moments to capture — from the obvious
            highlights to the things you might otherwise miss.
          </AppText>
          <Button label="Get started" haptic onPress={onGetStarted} />
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 11, 12, 0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    padding: spacing.xl,
    gap: spacing.base,
  },
  title: { color: colours.textPrimary },
  body: { marginBottom: spacing.xs },
});
