import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

export function AppleGlyph({ size = 20, color = '#0B0B0C' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 170 170" fill={color}>
      <Path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.76-11.72-14.15-6.53-10.12-11.76-21.78-15.69-34.97-3.93-13.2-5.9-25.74-5.9-37.64 0-14.28 3.65-26.04 10.95-35.28 7.3-9.24 16.5-13.97 27.6-14.19 4.35 0 9.24 1.15 14.67 3.44 5.43 2.3 9.07 3.51 10.91 3.65 1.52-.14 5.33-1.42 11.43-3.85 6.1-2.43 11.21-3.53 15.34-3.3 12.08.76 21.6 4.9 28.56 12.43-10.45 6.32-15.68 15.12-15.68 26.4 0 9.04 3.48 16.7 10.44 22.98 6.96 6.28 15.39 9.8 25.29 10.56-2.18 6.53-4.79 13.06-7.83 19.59zM119.22 31.84c0-7.3 2.6-13.9 7.8-19.8 5.2-5.9 11.5-9.4 18.9-10.5.9 7.4-1.8 14.1-8.1 20.1-6.3 6-12.5 9.4-18.6 10.2z" />
    </Svg>
  );
}

export function GoogleGlyph({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export function MailGlyph({ size = 18, color = colours.textPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 6l-10 7L2 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export interface AuthButtonProps {
  onPress: () => Promise<void> | void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppleSignInButton({
  onPress,
  disabled = false,
  loading = false,
  style,
}: AuthButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  async function handlePress() {
    if (disabled || isLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInternalLoading(true);
    try {
      await onPress();
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      disabled={disabled || isLoading}
      onPress={handlePress}
      style={({ pressed }) => [
        S.appleButton,
        pressed && S.buttonPressed,
        (disabled || isLoading) && S.buttonDisabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color="#0B0B0C" size="small" />
      ) : (
        <>
          <View style={S.iconContainer}>
            <AppleGlyph size={18} color="#0B0B0C" />
          </View>
          <AppText variant="labelLarge" style={S.appleText}>
            Continue with Apple
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function GoogleSignInButton({
  onPress,
  disabled = false,
  loading = false,
  style,
}: AuthButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  async function handlePress() {
    if (disabled || isLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInternalLoading(true);
    try {
      await onPress();
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      disabled={disabled || isLoading}
      onPress={handlePress}
      style={({ pressed }) => [
        S.googleButton,
        pressed && S.buttonPressed,
        (disabled || isLoading) && S.buttonDisabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={colours.textPrimary} size="small" />
      ) : (
        <>
          <View style={S.iconContainer}>
            <GoogleGlyph size={18} />
          </View>
          <AppText variant="labelLarge" style={S.googleText}>
            Continue with Google
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function EmailSignInButton({
  onPress,
  disabled = false,
  loading = false,
  style,
}: AuthButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  async function handlePress() {
    if (disabled || isLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInternalLoading(true);
    try {
      await onPress();
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with email"
      disabled={disabled || isLoading}
      onPress={handlePress}
      style={({ pressed }) => [
        S.emailButton,
        pressed && S.buttonPressed,
        (disabled || isLoading) && S.buttonDisabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={colours.textPrimary} size="small" />
      ) : (
        <>
          <View style={S.iconContainer}>
            <MailGlyph size={18} color={colours.textPrimary} />
          </View>
          <AppText variant="labelLarge" style={S.emailText}>
            Continue with email
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <View style={S.dividerContainer}>
      <View style={S.dividerLine} />
      <AppText variant="caption" tone="secondary" style={S.dividerLabel}>
        {label}
      </AppText>
      <View style={S.dividerLine} />
    </View>
  );
}

const S = StyleSheet.create({
  appleButton: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: '#F5F2ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  appleText: {
    color: '#0B0B0C',
    fontWeight: '600',
    fontSize: 16,
  },
  googleButton: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: layout.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  googleText: {
    color: colours.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  emailButton: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: layout.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emailText: {
    color: colours.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: layout.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerLabel: {
    color: colours.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
