import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';

/**
 * Placeholder so the home event card has a type-safe destination.
 * The full dashboard is Phase 7.
 */
export default function CelebrationDashboardScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <AppText variant="eyebrow" tone="secondary">
          Event dashboard
        </AppText>
        <AppText variant="displayLarge">Coming in Phase 7</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {celebrationId}
        </AppText>
      </View>
    </Screen>
  );
}
