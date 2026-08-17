import { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { isBackendConfigured } from '@/lib/supabase/client';
import { celebrationDetailKeys } from '@/services/celebration-detail';
import {
  listChallenges,
  replaceChallenges,
  legacyChallengesKey,
} from '@/services/challenges';
import { ChallengesEmptyState } from '@/features/celebrations/challenges-empty-state';
import { colours, layout, radii, spacing } from '@/design';
import Svg, { Path } from 'react-native-svg';

type Challenge = {
  id: string;
  label: string;
  icon: string;
  /**
   * Carried through this screen untouched. It is not edited here, but this
   * step saves the whole list back, so omitting it would blank the host's
   * guest instructions every time they reordered or added a challenge.
   */
  instructions?: string;
  photo?: string | null;
};

function TrashIcon({ size = 18, color = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PlusIcon({ size = 16, color = colours.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ChallengesStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { draft } = useCreationDraft();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draft.editCelebrationId) {
      (async () => {
        const celebrationId = String(draft.editCelebrationId);
        try {
          if (isBackendConfigured) {
            const remote = await listChallenges(celebrationId);
            if (remote) {
              setChallenges(
                remote.map((item) => ({
                  id: item.id,
                  label: item.label,
                  icon: item.icon,
                  instructions: item.instructions ?? undefined,
                  photo: item.photoUri,
                })) as Challenge[],
              );
              return;
            }
          }
        } catch (error) {
          console.error('[create/challenges] failed to load challenges', error);
        }

        const stored = await AsyncStorage.getItem(legacyChallengesKey(celebrationId));
        if (stored) {
          try {
            setChallenges(JSON.parse(stored) as Challenge[]);
          } catch {}
        }
      })();
    }
  }, [draft.editCelebrationId]);

  function handleDelete(id: string) {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  }

  // This screen is only ever reached from an editing/settings context, so it
  // mirrors Settings → Challenges: straight to the packs browser, no intro.
  function handleAddChallenge() {
    if (!draft.editCelebrationId) return;
    router.push(`/celebration/${draft.editCelebrationId}/challenges/packs` as never);
  }

  async function handleSave() {
    if (!draft.editCelebrationId) {
      // Creation flow fallback
      router.back();
      return;
    }

    setSaving(true);
    try {
      const celebrationId = String(draft.editCelebrationId);
      if (isBackendConfigured) {
        await replaceChallenges(
          celebrationId,
          challenges.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            instructions: item.instructions ?? null,
            photoUri: item.photo ?? null,
          })),
        );
        queryClient.invalidateQueries({
          queryKey: celebrationDetailKeys.detail(celebrationId),
        });
      } else {
        await AsyncStorage.setItem(
          legacyChallengesKey(celebrationId),
          JSON.stringify(challenges),
        );
      }
      router.replace(`/celebration/${draft.editCelebrationId}/edit`);
    } catch (error) {
      console.error('[create/challenges] failed to save challenges', error);
      Alert.alert('Error', 'Failed to save challenges.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      stickyAction={
        <View style={{ gap: spacing.sm }}>
          <Button
            label={draft.editCelebrationId ? 'Save' : 'Done'}
            loading={saving}
            haptic
            onPress={handleSave}
          />
          <Button
            label="Cancel"
            variant="quiet"
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" tone="secondary">
            Guest Prompts
          </AppText>
          <AppText variant="displayLarge">Manage Challenges</AppText>
          <AppText variant="bodyLarge" tone="secondary">
            Challenges encourage your guests to look out for key moments and photograph them.
          </AppText>
        </View>

        {challenges.length === 0 ? (
          <ChallengesEmptyState onPress={handleAddChallenge} />
        ) : (
          <View style={styles.card}>
            <Pressable onPress={handleAddChallenge} style={styles.row}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={styles.plusCircle}>
                  <PlusIcon size={16} color="#0B0B0C" />
                </View>
                <AppText variant="labelLarge" style={styles.addText}>Add new challenge...</AppText>
              </View>
            </Pressable>

            {challenges.map((c, idx) => (
              <View key={c.id}>
                <View style={styles.separator} />
                <View style={styles.row}>
                  <View style={styles.rowLabelContainer}>
                    <AppText variant="labelLarge" style={styles.rowLabel}>{c.label}</AppText>
                    {c.photo ? (
                      <AppText variant="bodySmall" style={[styles.rowValue, { color: colours.brandPrimary }]}>
                        Completed
                      </AppText>
                    ) : (
                      <AppText variant="bodySmall" style={styles.rowValue}>Not captured yet</AppText>
                    )}
                  </View>
                  <Pressable onPress={() => handleDelete(c.id)} style={styles.deleteButton}>
                    <TrashIcon />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  rowLabelContainer: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colours.textPrimary,
  },
  rowValue: {
    color: colours.textSecondary,
  },
  addText: {
    color: colours.textPrimary,
  },
  plusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colours.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: spacing.xs,
  },
  separator: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
    marginHorizontal: spacing.base,
  },
});
