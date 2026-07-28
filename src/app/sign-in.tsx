import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useAuth } from '@/features/auth/context';
import { colours, layout, spacing } from '@/design';
import { copy } from '@/i18n';

/** Permissive on purpose — the authoritative check is whether the code arrives. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function SignInScreen() {
  const router = useRouter();
  const { requestCode, isBackendConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  // Validation only after a real attempt — never while someone is still typing
  // their first character.
  const [hasAttempted, setHasAttempted] = useState(false);

  const trimmed = email.trim();
  const isValid = EMAIL_PATTERN.test(trimmed);

  async function handleSubmit() {
    setHasAttempted(true);

    if (!isValid) {
      setError(copy.auth.invalidEmail);
      return;
    }

    setError(undefined);
    setIsSending(true);
    const result = await requestCode(trimmed);
    setIsSending(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    router.push({ pathname: '/verify', params: { email: trimmed } });
  }

  return (
    <Screen
      stickyAction={
        <Button
          label={copy.auth.sendCode}
          loading={isSending}
          disabled={!isBackendConfigured}
          disabledReason={
            isBackendConfigured ? undefined : 'The app is not connected to a backend yet.'
          }
          haptic
          onPress={handleSubmit}
        />
      }
    >
      <View style={{ gap: spacing.xl, maxWidth: layout.maxReadableWidth }}>
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" tone="secondary">
            {copy.welcome.eyebrow}
          </AppText>
          <AppText variant="displayLarge">{copy.auth.title}</AppText>
          <AppText variant="bodyLarge" tone="secondary">
            We will email you a six-digit code. No password to remember.
          </AppText>
        </View>

        <TextField
          label={copy.auth.emailLabel}
          placeholder={copy.auth.emailPlaceholder}
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            if (hasAttempted) setError(undefined);
          }}
          error={hasAttempted ? error : undefined}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          autoFocus
        />

        {!isBackendConfigured ? (
          <View
            style={{
              padding: spacing.base,
              borderRadius: 12,
              borderWidth: layout.hairline,
              borderColor: colours.borderStrong,
              gap: spacing.xs,
            }}
          >
            <AppText variant="labelLarge" tone="warning">
              Backend not configured
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in
              .env.local, then restart with `npx expo start --clear`.
            </AppText>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
