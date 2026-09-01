import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LoadingState } from '@/components/feedback/loading-state';
import { Toast } from '@/components/feedback/toast';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import {
  celebrationKeys,
  listTrashedCelebrations,
  permanentlyDeleteCelebration,
  restoreCelebrationFromTrash,
  type TrashedCelebrationSummary,
} from '@/services/celebrations';
import { EventCardTile } from '@/features/celebrations/cards/event-card-tile';
import { listThemes, themeKeys } from '@/services/themes';
import { colours, layout, spacing } from '@/design';

/**
 * Trash.
 *
 * Deliberately built from the dashboard's own parts — the same event tile in
 * the same two-column grid, the same `Button`, the same `Toast`. A deleted
 * event is still the host's event, and giving it a bespoke card, bespoke
 * buttons and a bespoke banner made this read as a section bolted on from
 * somewhere else. The only thing unique to Trash is what sits *around* the
 * card: the deletion countdown and the two actions.
 */
export default function TrashScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: trashedEvents = [], isLoading } = useQuery({
    queryKey: celebrationKeys.trash(),
    queryFn: listTrashedCelebrations,
  });

  // Same accent resolution the dashboard uses, so a restored event's tile does
  // not change colour on the way back.
  const { data: themes = [] } = useQuery({
    queryKey: themeKeys.list(),
    queryFn: listThemes,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreCelebrationFromTrash,
    onSuccess: async () => {
      showMessage('Event restored');
      await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
    },
    onSettled: () => setRestoringId(null),
    onError: () => {
      Alert.alert('Restore failed', 'Could not restore the event. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: permanentlyDeleteCelebration,
    onSuccess: async () => {
      showMessage('Event permanently deleted');
      await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
    },
    onSettled: () => setDeletingId(null),
    onError: () => {
      Alert.alert('Delete failed', 'Could not permanently delete the event. Please try again.');
    },
  });

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  function showMessage(nextMessage: string) {
    setMessage(nextMessage);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage(null), 3200);
  }

  function confirmPermanentDelete(event: TrashedCelebrationSummary) {
    Alert.alert(
      'Permanently delete this event?',
      'This will permanently delete the event and its content. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => {
            setDeletingId(event.id);
            deleteMutation.mutate(event.id);
          },
        },
      ],
    );
  }

  const busy = restoreMutation.isPending || deleteMutation.isPending;

  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={styles.content}>
        <View style={styles.topNav}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeftIcon />
            <AppText style={styles.backText}>Back</AppText>
          </Pressable>
        </View>

        <View style={styles.headingBlock}>
          <AppText variant="displayLarge">Trash</AppText>
          <AppText variant="bodyLarge" tone="secondary">
            Events in Trash are permanently deleted after 7 days.
          </AppText>
        </View>

        {isLoading ? (
          <LoadingState label="Loading Trash" detail="Checking recently deleted events." />
        ) : trashedEvents.length > 0 ? (
          // The dashboard's two-column grid, so a tile is the same width here
          // as it is there rather than stretching edge to edge.
          <View style={styles.grid}>
            {[0, 1].map((column) => (
              <View key={column} style={styles.gridColumn}>
                {trashedEvents
                  .filter((_, index) => index % 2 === column)
                  .map((event, index) => (
                    <TrashEventCard
                      key={event.id}
                      event={event}
                      index={index}
                      themes={themes}
                      restoring={restoringId === event.id}
                      deleting={deletingId === event.id}
                      disabled={busy}
                      onRestore={() => {
                        setRestoringId(event.id);
                        restoreMutation.mutate(event.id);
                      }}
                      onDelete={() => confirmPermanentDelete(event)}
                    />
                  ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <AppText variant="heading" tone="secondary" align="center">
              Trash is empty
            </AppText>
          </View>
        )}
      </Screen>

      <Toast message={message} />
    </View>
  );
}

function TrashEventCard({
  event,
  index,
  themes,
  restoring,
  deleting,
  disabled,
  onRestore,
  onDelete,
}: {
  event: TrashedCelebrationSummary;
  index: number;
  themes: Parameters<typeof EventCardTile>[0]['themes'];
  restoring: boolean;
  deleting: boolean;
  disabled: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.cardGroup}>
      {/* The dashboard tile, unmodified apart from its eyebrow, which carries
          the countdown in place of the usual status. */}
      <EventCardTile
        celebration={event}
        index={index}
        themes={themes}
        eyebrowOverride={formatDeleteCountdown(event.deleteAfter).toUpperCase()}
      />

      <View style={styles.actions}>
        <Button
          label={restoring ? 'Restoring' : 'Restore'}
          variant="secondary"
          size="small"
          fullWidth
          loading={restoring}
          disabled={disabled}
          onPress={onRestore}
        />
        <Button
          label={deleting ? 'Deleting' : 'Delete permanently'}
          variant="destructive"
          size="small"
          fullWidth
          loading={deleting}
          disabled={disabled}
          haptic
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

function formatDeleteCountdown(deleteAfter: string) {
  const diffMs = new Date(deleteAfter).getTime() - Date.now();
  const days = Math.ceil(diffMs / 86_400_000);

  if (days <= 0) return 'Deletes today';
  if (days === 1) return 'Deletes tomorrow';
  return `Deletes in ${days} days`;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  topNav: {
    minHeight: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colours.textSecondary,
  },
  headingBlock: {
    gap: spacing.md,
    maxWidth: layout.maxReadableWidth,
  },
  // Mirrors `eventsGrid` / `gridColumn` on the dashboard exactly, so a tile is
  // the same width in Trash as it is there.
  grid: {
    flexDirection: 'row',
  },
  gridColumn: {
    flex: 1,
    gap: 16,
  },
  cardGroup: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.xs,
  },
  empty: {
    paddingVertical: spacing.giant,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
