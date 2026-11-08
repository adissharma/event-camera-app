import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { resolveCoverTemplate } from '@/features/celebrations/cover-templates';
import { GuestJoinScreen } from '@/features/celebrations/join/guest-join-screen';
import { useCountdown } from '@/features/celebrations/join/use-countdown';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  clearPublicationResult,
  getPublicationResult,
} from '@/features/celebrations/creation/publication-result';
import { celebrationKeys } from '@/services/celebrations';
import { fetchGuestEventPreview, guestSessionKeys } from '@/services/guest-session';
import { colours, layout } from '@/design';

/**
 * What the host sees the moment their event exists: the invitation their
 * guests will land on, exactly as they will see it, with "Go to the event" in
 * place of the name field and join button.
 *
 * It is `GuestJoinScreen` itself, fed by the same preview the guest route
 * reads, so the accent and shot count are the guests' own rather than a guess.
 */
export default function SuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { reset } = useCreationDraft();

  // Read once. The draft is cleared on mount, and the result is cleared on
  // unmount — neither can be a dependency of the render that follows.
  const [result] = useState(getPublicationResult);

  const { data: preview, isLoading } = useQuery({
    queryKey: guestSessionKeys.preview(String(result?.eventCode)),
    queryFn: () => fetchGuestEventPreview(String(result?.eventCode)),
    enabled: Boolean(result?.eventCode),
    retry: false,
  });

  // Same resolver as every other cover surface, so the first screen a host
  // sees after publishing shows the photograph they actually chose.
  const coverSource = useCoverSource(result?.coverStoragePath);
  const countdown = useCountdown(result?.endsAt ?? null);

  useEffect(() => {
    void reset();
    void queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return () => clearPublicationResult();
  }, [reset, queryClient]);

  if (!result) {
    return (
      <View style={[S.root, S.centred, { padding: layout.gutter }]}>
        <AppText variant="bodyLarge" tone="secondary" align="center">
          This event has already been created.
        </AppText>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[S.root, S.centred]}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  // The event exists whatever this read returned, so a failed preview still
  // gets the host to it, with the one unknown figure left blank.
  const shotsLeftLabel = !preview
    ? '—'
    : preview.shotLimit === null
    ? '∞'
    : String(Math.max(0, preview.shotLimit - preview.shotsUsed));

  return (
    <GuestJoinScreen
      template={resolveCoverTemplate(result.themeSlug)}
      coverSource={coverSource}
      title={result.eventName}
      countdownLabel={countdown}
      shotsLeftLabel={shotsLeftLabel}
      accent={preview?.themeAccent ?? colours.accentWarm}
      showNameInput={false}
      ctaLabel="Go to the event"
      onJoin={() => router.replace(`/celebration/${result.celebrationId}` as never)}
    />
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },
  centred: { alignItems: 'center', justifyContent: 'center' },
});
