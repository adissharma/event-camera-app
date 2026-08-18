import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/brand-logo';
import GrainGradientBackground from '../components/media/grain-gradient-background';
import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import {
  AppleSignInButton,
  GoogleSignInButton,
  EmailSignInButton,
} from '@/components/auth/auth-buttons';
import { useAuth } from '@/features/auth/context';
import { listCelebrations } from '@/services/celebrations';
import { fetchMyProfile, firstNameFrom } from '@/services/profile';
import { colours, layout, radii, spacing, useMotion } from '@/design';
import { copy } from '@/i18n';

/**
 * Welcome — the first screen on a cold start.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const { isSignedIn, isRestoring, signInWithApple, signInWithGoogle, isBackendConfigured } = useAuth();

  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isRestoring && isSignedIn) {
      router.replace('/home');
    }
  }, [router, isSignedIn, isRestoring]);

  async function handlePostSignIn() {
    try {
      const profile = await fetchMyProfile();
      if (firstNameFrom(profile)) {
        router.replace('/home');
      } else {
        router.replace('/your-name');
      }
    } catch {
      router.replace('/home');
    }
  }

  async function handleAppleSignIn() {
    setError(undefined);
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (!result.ok) {
        if (result.error.code !== 'cancelled') {
          setError(result.error.message);
        }
        return;
      }
      await handlePostSignIn();
    } catch (e) {
      setError('Could not complete Apple sign in. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(undefined);
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        if (result.error.code !== 'cancelled') {
          setError(result.error.message);
        }
        return;
      }
      await handlePostSignIn();
    } catch (e) {
      setError('Could not complete Google sign in. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <GrainGradientBackground
          speed={motion.reduceMotion ? 0 : 1}
          dom={{
            scrollEnabled: false,
            style: { flex: 1, backgroundColor: colours.background },
          }}
        />
      </View>

      <LinearGradient
        colors={colours.imageScrim}
        locations={[0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + spacing.base,
          paddingHorizontal: layout.gutter,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.md }}>
          <Reveal index={0} step={70}>
            <BrandLogo height={52} variant="light" />
          </Reveal>
        </View>

        <View style={{ gap: spacing.sm }}>
          {error ? (
            <View style={S.errorBanner}>
              <AppText variant="bodySmall" style={S.errorText}>
                {error}
              </AppText>
            </View>
          ) : null}

          <Reveal index={1} step={70} style={{ gap: spacing.md }}>
            <AppleSignInButton
              onPress={handleAppleSignIn}
              loading={isAppleLoading}
              disabled={isGoogleLoading || !isBackendConfigured}
            />

            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              loading={isGoogleLoading}
              disabled={isAppleLoading || !isBackendConfigured}
            />

            <EmailSignInButton
              onPress={() => router.push('/sign-in')}
              disabled={isAppleLoading || isGoogleLoading}
            />

            <View style={{ paddingTop: spacing.xs }}>
              <Button
                label={copy.welcome.joinEvent}
                variant="quiet"
                labelStyle={{ fontSize: 16, lineHeight: 20 }}
                onPress={() => router.push('/j')}
              />
            </View>
          </Reveal>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: layout.hairline,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: '#F87171',
  },
});
