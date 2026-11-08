import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleSignInButton, GoogleSignInButton } from '@/components/auth/auth-buttons';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';
import { useAuth } from './context';

/** Why the sheet appeared, which decides what it says. */
export type SignInReason = 'publish' | 'account';

const COPY: Record<SignInReason, { title: string; body: string }> = {
  publish: {
    title: 'Save your event',
    body: 'Sign in so your event is yours, and you can get back to it on any device.',
  },
  account: {
    title: 'Sign in',
    body: 'Get back to your events and albums on any device.',
  },
};

/** Taps on the title that open email sign-in, for App Review and testers. */
const SECRET_TAPS = 5;
const SECRET_TAP_WINDOW_MS = 3000;

/**
 * Asks for an account at the moment one is needed, rather than at the door.
 *
 * Anyone can browse and build an event without signing in. An account is only
 * needed once an event has to exist on the server and belong to someone, which is
 * publishing, or when someone wants their existing events back.
 */
export function SignInSheet({
  visible,
  reason,
  onClose,
  onSignedIn,
}: {
  visible: boolean;
  reason: SignInReason;
  onClose: () => void;
  /** Called once there is a session, so the caller can carry on with what it was doing. */
  onSignedIn: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithApple, signInWithGoogle, isBackendConfigured } = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (provider: 'apple' | 'google') => {
      setBusy(provider);
      setError(null);
      try {
        const result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
        if (result.ok) {
          onSignedIn();
          return;
        }
        // Cancelling is a decision, not a failure.
        if (result.error.code !== 'cancelled') setError(result.error.message);
      } catch {
        setError('Could not sign you in. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [onSignedIn, signInWithApple, signInWithGoogle],
  );

  const secretTapCount = useRef(0);
  const secretTapAt = useRef(0);
  const registerSecretTap = () => {
    const now = Date.now();
    secretTapCount.current =
      now - secretTapAt.current > SECRET_TAP_WINDOW_MS ? 1 : secretTapCount.current + 1;
    secretTapAt.current = now;
    if (secretTapCount.current < SECRET_TAPS) return;
    secretTapCount.current = 0;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
    router.push('/sign-in');
  };

  const text = COPY[reason];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={[S.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
          <View style={S.handle} />
          <Pressable onPress={registerSecretTap} accessible={false} style={S.copy}>
            <AppText variant="titleLarge" style={S.title}>
              {text.title}
            </AppText>
            <AppText variant="bodyLarge" style={S.body}>
              {text.body}
            </AppText>
          </Pressable>

          {error || !isBackendConfigured ? (
            <AppText variant="bodySmall" style={S.error}>
              {error ?? 'Sign in is temporarily unavailable. Please try again later.'}
            </AppText>
          ) : null}

          <View style={S.buttons}>
            <AppleSignInButton
              onPress={() => void run('apple')}
              loading={busy === 'apple'}
              disabled={busy !== null || !isBackendConfigured}
            />
            <GoogleSignInButton
              onPress={() => void run('google')}
              loading={busy === 'google'}
              disabled={busy !== null || !isBackendConfigured}
            />
            {/* Someone who opened the app to join a party rather than host one. */}
            {reason === 'account' ? (
              <Button
                label={copy.welcome.joinEvent}
                variant="quiet"
                onPress={() => {
                  onClose();
                  router.push('/j');
                }}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    backgroundColor: '#0D0D0F',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  copy: { gap: spacing.sm },
  title: { color: '#FFFFFF' },
  body: { color: '#9A9A9F', lineHeight: 23 },
  error: { color: colours.error },
  buttons: { gap: spacing.md },
});
