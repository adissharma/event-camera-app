import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { colours, layout, spacing } from '@/design';

/**
 * Entry point for creation.
 *
 * A fresh draft goes straight to step 1 — an interstitial before the first
 * question is pure friction. A restored draft stops to ask, because silently
 * dropping someone into step 8 of an event they half-configured last week is
 * disorienting, and silently discarding that work is worse.
 */
export default function CreateEntryScreen() {
  const router = useRouter();
  const { draft, isRestoring, wasRestored, reset } = useCreationDraft();

  const hasProgress = wasRestored && draft.title.trim().length > 0;

  useEffect(() => {
    if (isRestoring) return;
    if (!hasProgress) router.replace('/create/name');
  }, [isRestoring, hasProgress, router]);

  if (isRestoring || !hasProgress) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      stickyAction={
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Carry on"
            haptic
            onPress={() => router.replace(`/create/${draft.furthestStep}` as never)}
          />
          <Button
            label="Start again"
            variant="quiet"
            onPress={async () => {
              await reset();
              router.replace('/create/name');
            }}
          />
        </View>
      }
    >
      <View style={{ gap: spacing.md, maxWidth: layout.maxReadableWidth }}>
        <AppText variant="eyebrow" tone="secondary">
          Unfinished event
        </AppText>
        <AppText variant="displayLarge">Pick up where you left off?</AppText>
        <AppText variant="bodyLarge" tone="secondary">
          You were setting up “{draft.title}”. Everything you chose is still here.
        </AppText>
      </View>
    </Screen>
  );
}
