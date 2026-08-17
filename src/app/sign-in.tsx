import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useAuth } from '@/features/auth/context';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function SignInScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { requestCode, isBackendConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
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
    try {
      const result = await requestCode(trimmed);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      router.push({
        pathname: '/verify',
        params: {
          email: trimmed,
          ...(redirect ? { redirect } : {}),
        },
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      <Screen
        stickyAction={
          <Button
            label={copy.auth.sendCode}
            loading={isSending}
            disabled={!trimmed || !isBackendConfigured}
            disabledReason={
              !isBackendConfigured
                ? 'The app is not connected to a backend yet.'
                : undefined
            }
            haptic
            onPress={handleSubmit}
          />
        }
      >
        <View style={S.container}>
          <View style={S.headerGroup}>
            <AppText variant="eyebrow" tone="secondary">
              {copy.welcome.eyebrow}
            </AppText>
            <AppText variant="displayLarge">Enter your email</AppText>
            <AppText variant="bodyLarge" tone="secondary">
              We will email you a six-digit code. No password to remember.
            </AppText>
          </View>

          {error ? (
            <View style={S.errorBanner}>
              <AppText variant="bodySmall" style={S.errorText}>
                {error}
              </AppText>
            </View>
          ) : null}

          <TextField
            label={copy.auth.emailLabel}
            placeholder={copy.auth.emailPlaceholder}
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (hasAttempted) setError(undefined);
            }}
            error={hasAttempted ? (isValid ? undefined : error) : undefined}
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
            <View style={S.backendWarningCard}>
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
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    gap: spacing.xl,
    maxWidth: layout.maxReadableWidth,
  },
  headerGroup: {
    gap: spacing.xs,
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: layout.hairline,
  },
  errorText: {
    color: '#F87171',
  },
  backendWarningCard: {
    padding: spacing.base,
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    gap: spacing.xs,
  },
});
