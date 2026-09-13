import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { fetchMyProfile, firstNameFrom, firstNameFromValue, profileKeys, updateDisplayName } from '@/services/profile';
import { colours, layout, radii, spacing } from '@/design';
import { useAuth } from '@/features/auth/context';
import { resetToAuthenticatedRoot } from '@/lib/navigation/session-root';

/**
 * Used both to complete onboarding and to edit the profile name later.
 */
export default function YourNameScreen() {
  const router = useRouter();
  const { redirect, returnTo } = useLocalSearchParams<{ redirect?: string; returnTo?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState(() => firstNameFromValue(user?.displayName) ?? '');
  const hasEditedName = useRef(false);

  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
  });

  useEffect(() => {
    if (hasEditedName.current) return;
    const savedName = firstNameFrom(profile) ?? firstNameFromValue(user?.displayName);
    if (savedName) setName(savedName);
  }, [profile, user?.displayName]);

  const targetPath = (redirect as never) || '/home';
  const savedFirstName = firstNameFromValue(name);

  const save = useMutation({
    mutationFn: () => updateDisplayName(name),
    onSuccess: async () => {
      if (savedFirstName) {
        queryClient.setQueryData(profileKeys.me(), (current: typeof profile) =>
          current
            ? {
                ...current,
                display_name: savedFirstName,
                onboarding_completed_at: new Date().toISOString(),
              }
            : current,
        );
      }
      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      if (returnTo === 'profile') {
        router.replace('/home?openProfile=1' as never);
      } else {
        resetToAuthenticatedRoot(router, targetPath);
      }
    },
  });

  const trimmed = name.trim();

  function handleBack() {
    if (returnTo === 'profile') {
      router.replace('/home?openProfile=1' as never);
      return;
    }
    router.back();
  }

  return (
    <Screen
      scrollable={false}
      contentStyle={styles.screenContent}
      stickyActionSeparator={false}
      fixedHeader={
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeftIcon size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerBalance} pointerEvents="none" />
        </View>
      }
      stickyAction={
        <Button
          label="Save"
          loading={save.isPending}
          disabled={trimmed.length === 0}
          disabledReason="Enter your first name"
          haptic
          onPress={() => save.mutate()}
        />
      }
    >
      <View style={styles.content}>
        <AppText variant="displayLarge" align="center">
          What should we call you?
        </AppText>

        <View style={styles.inputArea}>
          <TextField
            placeholder="Priya"
            value={name}
            onChangeText={(next) => {
              hasEditedName.current = true;
              setName(next);
            }}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={() => trimmed.length > 0 && save.mutate()}
            editorial
            hideBorderWhenUnfocused
            autoFocus
          />
          {save.error ? (
            <AppText variant="bodySmall" tone="error" align="center">
              Could not save your name. Please try again.
            </AppText>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colours.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBalance: {
    width: 44,
    height: 44,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxReadableWidth,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  inputArea: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
