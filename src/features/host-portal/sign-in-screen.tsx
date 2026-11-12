import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Link, Redirect } from 'expo-router';

import { StillsLockup } from '@/components/brand/stills-lockup';
import { useDocumentTitle } from '@/components/brand/use-document-title';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { useAuth } from '@/features/auth/context';
import type { AuthResult, AuthSession } from '@/features/auth/types';
import { copy, t } from '@/i18n';
import { Notice } from './ui';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_LENGTH = 6;

/**
 * Sign-in for hosts on the web.
 *
 * All three methods the app offers, because an account belongs to its provider:
 * a host who signed up with Apple's private relay has no inbox to receive a code
 * at, so offering email alone would strand them outside their own events.
 */
export default function HostSignInScreen() {
  useDocumentTitle('Sign in — Stills. for hosts');
  const { isSignedIn, isBackendConfigured, requestCode, verifyCode, signInWithApple, signInWithGoogle } = useAuth();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'email' | 'code' | 'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | undefined>();

  if (isSignedIn) return <Redirect href="/host" />;

  const trimmedEmail = email.trim();

  async function sendCode() {
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(copy.auth.invalidEmail);
      return;
    }
    setError(undefined);
    setBusy('email');
    const result = await requestCode(trimmedEmail);
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCode('');
    setStep('code');
  }

  async function submitCode(value: string) {
    if (value.length !== CODE_LENGTH || busy) return;
    setError(undefined);
    setBusy('code');
    const result = await verifyCode(trimmedEmail, value);
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      setCode('');
    }
    // On success `isSignedIn` flips and the redirect above takes over.
  }

  async function signInWith(provider: 'apple' | 'google', start: () => Promise<AuthResult<AuthSession>>) {
    setError(undefined);
    setBusy(provider);
    const result = await start();
    // Reached only on failure: on success the browser has left for the provider.
    setBusy(null);
    if (!result.ok && result.error.code !== 'cancelled') setError(result.error.message);
  }

  return (
    <ScrollView contentContainerStyle={S.page}>
      <View style={S.logo}>
        <StillsLockup size={40} />
      </View>

      <View style={S.card}>
        {step === 'email' ? (
          <>
            <View style={S.heading}>
              <AppText variant="titleLarge">Sign in to your events</AppText>
              <AppText variant="body" tone="secondary">
                Use the same account you use in the app.
              </AppText>
            </View>

            {error ? <Notice tone="error">{error}</Notice> : null}
            {!isBackendConfigured ? (
              <Notice tone="error">Sign in is temporarily unavailable. Please try again later.</Notice>
            ) : null}

            <View style={S.group}>
              <Button
                label="Continue with Apple"
                variant="secondary"
                size="medium"
                loading={busy === 'apple'}
                disabled={busy !== null || !isBackendConfigured}
                onPress={() => void signInWith('apple', signInWithApple)}
              />
              <Button
                label="Continue with Google"
                variant="secondary"
                size="medium"
                loading={busy === 'google'}
                disabled={busy !== null || !isBackendConfigured}
                onPress={() => void signInWith('google', signInWithGoogle)}
              />
            </View>

            <View style={S.divider}>
              <View style={S.dividerLine} />
              <AppText variant="caption" tone="secondary">
                or
              </AppText>
              <View style={S.dividerLine} />
            </View>

            <View style={S.group}>
              <TextField
                label={copy.auth.emailLabel}
                placeholder={copy.auth.emailPlaceholder}
                value={email}
                onChangeText={(next) => {
                  setEmail(next);
                  setError(undefined);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                onSubmitEditing={() => void sendCode()}
              />
              <Button
                label={copy.auth.sendCode}
                size="medium"
                loading={busy === 'email'}
                disabled={!trimmedEmail || busy !== null || !isBackendConfigured}
                onPress={() => void sendCode()}
              />
            </View>
          </>
        ) : (
          <>
            <View style={S.heading}>
              <AppText variant="titleLarge">Check your email</AppText>
              <AppText variant="body" tone="secondary">
                {t(copy.auth.codeSentTo, { email: trimmedEmail })}
              </AppText>
            </View>

            {error ? <Notice tone="error">{error}</Notice> : null}

            <TextField
              label={copy.auth.codeLabel}
              value={code}
              onChangeText={(next) => {
                const digits = next.replace(/\D/g, '').slice(0, CODE_LENGTH);
                setCode(digits);
                setError(undefined);
                if (digits.length === CODE_LENGTH) void submitCode(digits);
              }}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              autoFocus
              inputStyle={S.codeInput}
            />
            <View style={S.group}>
              <Button
                label={copy.auth.verify}
                size="medium"
                loading={busy === 'code'}
                disabled={code.length !== CODE_LENGTH}
                onPress={() => void submitCode(code)}
              />
              <Button
                label="Use a different email"
                variant="quiet"
                size="medium"
                disabled={busy !== null}
                onPress={() => {
                  setError(undefined);
                  setStep('email');
                }}
              />
            </View>
          </>
        )}
      </View>

      <View style={S.footer}>
        <AppText variant="caption" tone="secondary" align="center">
          This is for event hosts. Guests join from their phone with the event&apos;s QR code or link.
        </AppText>
        <Link href="/privacy" accessibilityRole="link">
          <AppText variant="caption" tone="secondary" style={S.footerLink}>
            Privacy Policy
          </AppText>
        </Link>
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  page: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
  },
  logo: {
    marginBottom: spacing.sm,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  heading: {
    gap: spacing.xs,
  },
  group: {
    gap: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
  },
  codeInput: {
    letterSpacing: spacing.sm,
  },
  footer: {
    maxWidth: 420,
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
});
