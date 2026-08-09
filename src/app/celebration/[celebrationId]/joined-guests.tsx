import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { CloseIcon } from '@/components/ui/icons';
import { colours, radii, spacing, layout } from '@/design';
import { isBackendConfigured, requireSupabase } from '@/lib/supabase/client';
import {
  celebrationDetailKeys,
  fetchCelebrationDetail,
  fetchJoinedGuests,
  type JoinedGuest,
} from '@/services/celebration-detail';

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const value = parts[0].slice(0, 2).toUpperCase();
    return value || '?';
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export default function JoinedGuestsScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const sessionId = detailQuery.data?.primarySession?.id ?? null;

  const guestsQuery = useQuery({
    queryKey: sessionId ? celebrationDetailKeys.joinedGuests(sessionId) : ['celebrations', 'joined-guests', 'idle'],
    queryFn: () => fetchJoinedGuests(String(sessionId), String(celebrationId)),
    enabled: Boolean(sessionId),
    refetchInterval: isBackendConfigured ? 10000 : false,
  });

  useEffect(() => {
    if (!isBackendConfigured || !sessionId || !celebrationId) return;

    const client = requireSupabase();
    const channel = client
      .channel(`joined-guests-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guest_sessions',
          filter: `event_session_id=eq.${sessionId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: celebrationDetailKeys.joinedGuests(sessionId) });
          void queryClient.invalidateQueries({ queryKey: celebrationDetailKeys.detail(String(celebrationId)) });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [celebrationId, queryClient, sessionId]);

  const guests = guestsQuery.data ?? [];
  const joinedCount = guests.length;
  if (detailQuery.isLoading || guestsQuery.isLoading) {
    return (
      <Screen>
        <View style={S.loadingRoot}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Screen>
        <View style={S.emptyState}>
          <AppText variant="displaySmall">Something went wrong</AppText>
          <AppText variant="bodySmall" tone="secondary" align="center">
            We couldn&apos;t load the guest list for this event.
          </AppText>
          <Pressable onPress={() => router.back()} style={S.backLink}>
            <AppText variant="bodySmall" tone="secondary">Go back</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (guestsQuery.isError) {
    return (
      <Screen>
        <View style={S.emptyState}>
          <AppText variant="displaySmall">Couldn&apos;t load guests</AppText>
          <AppText variant="bodySmall" tone="secondary" align="center">
            We hit a problem loading the joined guest list.
          </AppText>
          <Pressable onPress={() => void guestsQuery.refetch()} style={S.backLink}>
            <AppText variant="bodySmall" tone="secondary">Try again</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable={false}>
      <View style={S.root}>
        <View style={S.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [S.closeButton, pressed && S.closeButtonPressed]}
          >
            <CloseIcon size={18} color={colours.textPrimary} />
          </Pressable>
          <View style={S.titleRow}>
            <AppText variant="titleLarge" style={S.title}>
              Joined Guests
            </AppText>
            <AppText variant="titleLarge" style={S.titleCount}>
              ({joinedCount})
            </AppText>
          </View>
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={guests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={S.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={S.emptyState}>
              <AppText variant="titleMedium">No guests yet</AppText>
              <AppText variant="bodySmall" tone="secondary" align="center">
                As people join the event, their names will appear here.
              </AppText>
            </View>
          }
          renderItem={({ item }: { item: JoinedGuest }) => {
            const initials = initialsFor(item.displayName);

            return (
              <View style={S.row}>
                <View style={S.initialsBadge} accessible accessibilityLabel={`${item.displayName} initials ${initials}`}>
                  <AppText style={S.initialsText}>{initials}</AppText>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="bodyLarge" numberOfLines={1} style={S.rowName}>
                    {item.displayName}
                  </AppText>
                </View>
              </View>
            );
          }}
        />
      </View>
    </Screen>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  titleCount: {
    flexShrink: 0,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colours.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  closeButtonPressed: {
    opacity: 0.85,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    padding: spacing.md,
  },
  initialsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.brandPrimary,
  },
  initialsText: {
    color: colours.textOnBrand,
    fontFamily: 'InstrumentSans_700Bold',
    fontSize: 14,
    letterSpacing: 0.6,
  },
  rowName: {
    color: colours.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  backLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
