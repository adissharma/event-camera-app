import { useEffect, useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useAuth } from '@/features/auth/context';
import { layout, spacing } from '@/design';
import { copy, t } from '@/i18n';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyCode, requestCode } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // A cooldown rather than an always-available resend: the provider rate-limits
  // sends, and a user tapping twice would burn their remaining allowance and
  // then be told to wait far longer.
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
      // Clear on failure so the next attempt starts clean rather than requiring
      // the user to delete six characters first.
      setCode('');
      inputRef.current?.focus();
      return;
    }

    router.replace('/home');
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
            // Auto-submit on the last digit. Saves a tap on the single most
            // repeated action in the app.
            if (digits.length === CODE_LENGTH) void submit(digits);
          }}
          error={error}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          editorial
          autoFocus
          // Wide tracking makes six digits scannable as a group.
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
