import { View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';

/**
 * Placeholder route so navigation from Welcome is type-safe.
 * Replaced by the 13-step creation flow in Phase 5.
 */
export default function CreateEntryScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <AppText variant="displayLarge">Create an event</AppText>
        <AppText variant="body" tone="secondary">
          The event-creation flow is implemented in Phase 5.
        </AppText>
      </View>
    </Screen>
  );
}
