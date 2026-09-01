import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { fetchMyProfile, firstNameFrom, firstNameFromValue, profileKeys, updateDisplayName } from '@/services/profile';
import { layout, spacing } from '@/design';
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

  return (
    <Screen
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
      <View style={{ gap: spacing.xl, maxWidth: layout.maxReadableWidth }}>
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" tone="secondary">
            One quick thing
          </AppText>
          <AppText variant="displayLarge">What should we call you?</AppText>
          <AppText variant="bodyLarge" tone="secondary">
            We use it to suggest names for your events. Nothing else.
          </AppText>
        </View>

        <TextField
          label="Your first name"
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
          autoFocus
        />
        {save.error ? (
          <AppText variant="bodySmall" tone="error">Could not save your name. Please try again.</AppText>
        ) : null}
      </View>
    </Screen>
  );
}
