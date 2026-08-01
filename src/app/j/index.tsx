import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { colours, layout, spacing, radii } from '@/design';

export default function GuestEntryHomeScreen() {
  const router = useRouter();
  const [slug, setSlug] = useState('');

  const handleJoin = () => {
    if (slug.trim()) {
      router.push(`/j/${slug.trim()}`);
    }
  };

  return (
    <View style={S.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={S.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={S.container}>
            <AppText variant="displayLarge" align="center" style={S.title}>
              Join an Event
            </AppText>

            <AppText
              variant="bodyLarge"
              tone="secondary"
              align="center"
              style={S.subtitle}
            >
              Enter the event code from your invitation link
            </AppText>

            <View style={S.form}>
              <TextInput
                value={slug}
                onChangeText={setSlug}
                placeholder="Event code"
                placeholderTextColor={colours.textSecondary}
                style={S.input}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleJoin}
                editable={!slug || slug.length < 50}
              />

              <Pressable
                onPress={handleJoin}
                disabled={!slug.trim()}
                style={({ pressed }) => [
                  S.button,
                  !slug.trim() && S.buttonDisabled,
                  pressed && S.buttonPressed,
                ]}
              >
                <AppText variant="labelLarge" style={S.buttonText}>
                  Continue
                </AppText>
              </Pressable>
            </View>

            <View style={S.helpSection}>
              <AppText variant="caption" tone="secondary" align="center">
                Don't have an event code?{'\n'}
                Check your invitation email or ask the event host.
              </AppText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colours.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.xl,
  },
  container: {
    gap: spacing.lg,
  },
  title: {
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colours.textSecondary,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colours.borderSubtle,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    fontSize: 16,
    color: colours.textPrimary,
    fontFamily: 'InstrumentSans_400Regular',
    backgroundColor: colours.surfaceMuted,
    minHeight: 56,
  },
  button: {
    backgroundColor: colours.accentWarm,
    borderRadius: radii.pill,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colours.textOnBrand,
  },
  helpSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colours.borderSubtle,
  },
});
