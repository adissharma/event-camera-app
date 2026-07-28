import { View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';

/**
 * Placeholder route so navigation from Welcome is type-safe.
 * Replaced by the passwordless OTP flow in Phase 4.
 */
export default function SignInScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <AppText variant="displayLarge">Sign in</AppText>
        <AppText variant="body" tone="secondary">
          Passwordless email sign-in is implemented in Phase 4.
        </AppText>
      </View>
    </Screen>
  );
}
