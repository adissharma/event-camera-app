import { useEffect, useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useAuth } from '@/features/auth/context';
import { fetchMyProfile } from '@/services/profile';
import { resetToAuthenticatedRoot } from '@/lib/navigation/session-root';
import { layout, spacing } from '@/design';
import { copy, t } from '@/i18n';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { email, redirect } = useLocalSearchParams<{ email: string; redirect?: string }>();
  const { verifyCode, requestCode } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(value: string) {
    if (value.length !== CODE_LENGTH || isVerifying) return;

    setIsVerifying(true);
    setError(undefined);
    const result = await verifyCode(String(email ?? ''), value);
    setIsVerifying(false);

    if (!result.ok) {
      setError(result.error.message);
      setCode('');
      inputRef.current?.focus();
      return;
    }

    // Onboarding is explicit. A social/email profile may have a suggested name
    // before the user has accepted or edited it on the name screen.
    try {
      const profile = await fetchMyProfile();
      if (profile?.onboarding_completed_at) {
        resetToAuthenticatedRoot(router, (redirect as never) || '/home');
      } else {
        router.replace({
          pathname: '/your-name',
          params: redirect ? { redirect } : undefined,
        });
      }
    } catch {
      router.replace({
        pathname: '/your-name',
        params: redirect ? { redirect } : undefined,
      });
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setError(undefined);
    const result = await requestCode(String(email ?? ''));
    if (!result.ok) setError(result.error.message);
  }

  return (
    <Screen
      stickyAction={
        <Button
          label={copy.auth.verify}
          loading={isVerifying}
          disabled={code.length !== CODE_LENGTH}
          disabledReason={`Enter all ${CODE_LENGTH} digits`}
          haptic
          onPress={() => submit(code)}
        />
      }
    >
      <View style={{ gap: spacing.xl, maxWidth: layout.maxReadableWidth }}>
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" tone="secondary">
            {copy.welcome.eyebrow}
          </AppText>
          <AppText variant="displayLarge">Check your email</AppText>
          <AppText variant="bodyLarge" tone="secondary">
            {t(copy.auth.codeSentTo, { email: String(email ?? '') })}
          </AppText>
        </View>

        <TextField
          ref={inputRef}
          label={copy.auth.codeLabel}
          value={code}
          onChangeText={(next) => {
            const digits = next.replace(/\D/g, '').slice(0, CODE_LENGTH);
            setCode(digits);
            if (error) setError(undefined);
            if (digits.length === CODE_LENGTH) void submit(digits);
          }}
          error={error}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          editorial
          autoFocus
          inputStyle={{ letterSpacing: 8 }}
        />

        <Button
          label={cooldown > 0 ? t(copy.auth.resendIn, { seconds: cooldown }) : copy.auth.resend}
          variant="quiet"
          fullWidth={false}
          disabled={cooldown > 0}
          disabledReason="You can request another code shortly"
          onPress={handleResend}
        />
      </View>
    </Screen>
  );
}
