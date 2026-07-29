import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { profileKeys, updateDisplayName } from '@/services/profile';
import { layout, spacing } from '@/design';

/**
 * Asked once, immediately after the code is verified.
 *
 * The only reason this exists is to personalise the event-name suggestions —
 * "Priya's birthday" rather than a generic list. That is a real payoff for one
 * short question, and it is the last thing standing between sign-in and the
 * app, so it must be skippable: a host who taps past it loses suggestions, not
 * access.
 */
export default function YourNameScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const save = useMutation({
    mutationFn: () => updateDisplayName(name),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      router.replace('/home');
    },
  });

  const trimmed = name.trim();

  return (
    <Screen
      stickyAction={
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Continue"
            loading={save.isPending}
            disabled={trimmed.length === 0}
            disabledReason="Enter your first name, or skip"
            haptic
            onPress={() => save.mutate()}
          />
          <Button label="Skip" variant="quiet" onPress={() => router.replace('/home')} />
        </View>
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
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={() => trimmed.length > 0 && save.mutate()}
          editorial
          autoFocus
        />
      </View>
    </Screen>
  );
}
