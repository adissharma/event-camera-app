import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { colours, layout, radii, spacing } from '@/design';
import { celebrationDetailKeys } from '@/services/celebration-detail';
import { isBackendConfigured } from '@/lib/supabase/client';
import { createChallenge, legacyChallengesKey, listChallenges } from '@/services/challenges';
import { ChallengeIconSVG, normalizeChallengeIconValue } from '@/features/celebrations/challenge-icons';
import { findChallengePack } from '@/features/celebrations/challenge-packs';

/** Mirrors the cap enforced in `challenges/[challengeId].tsx`. */
const MAX_CHALLENGES = 10;

function BackChevron({ size = 18, color = colours.textSecondary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ChallengePackPreviewScreen() {
  const { celebrationId, packId } = useLocalSearchParams<{ celebrationId: string; packId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const pack = findChallengePack(String(packId));

  async function handleAdd() {
    if (!pack) return;
    setAdding(true);
    try {
      const celebrationIdStr = String(celebrationId);

      let existingLabels = new Set<string>();
      let existingCount = 0;

      if (isBackendConfigured) {
        const remote = await listChallenges(celebrationIdStr);
        existingLabels = new Set((remote ?? []).map((c) => c.label.trim().toLowerCase()));
        existingCount = remote?.length ?? 0;
      } else {
        const stored = await AsyncStorage.getItem(legacyChallengesKey(celebrationIdStr));
        const parsed = stored ? (JSON.parse(stored) as { label: string }[]) : [];
        existingLabels = new Set(parsed.map((c) => c.label.trim().toLowerCase()));
        existingCount = parsed.length;
      }

      const duplicates = pack.challenges.filter((c) => existingLabels.has(c.label.trim().toLowerCase()));
      const toAdd = pack.challenges.filter((c) => !existingLabels.has(c.label.trim().toLowerCase()));

      const room = Math.max(0, MAX_CHALLENGES - existingCount);
      const overflow = Math.max(0, toAdd.length - room);
      const finalToAdd = toAdd.slice(0, room);

      if (finalToAdd.length === 0) {
        Alert.alert(
          duplicates.length > 0 ? 'Already added' : 'Challenge limit reached',
          duplicates.length > 0
            ? `Every challenge in ${pack.name} has already been added to this event.`
            : "You can't add more than 10 challenges to an event.",
        );
        setAdding(false);
        return;
      }

      if (isBackendConfigured) {
        let sortOrder = existingCount;
        for (const challenge of finalToAdd) {
          await createChallenge(celebrationIdStr, {
            label: challenge.label,
            icon: normalizeChallengeIconValue(challenge.icon),
            instructions: challenge.instructions,
            sortOrder: sortOrder++,
          });
        }
        queryClient.invalidateQueries({ queryKey: celebrationDetailKeys.detail(celebrationIdStr) });
      } else {
        const stored = await AsyncStorage.getItem(legacyChallengesKey(celebrationIdStr));
        const parsed = stored ? (JSON.parse(stored) as any[]) : [];
        const appended = [
          ...parsed,
          ...finalToAdd.map((challenge) => ({
            id: `c${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: challenge.label,
            icon: normalizeChallengeIconValue(challenge.icon),
            instructions: challenge.instructions,
          })),
        ];
        await AsyncStorage.setItem(legacyChallengesKey(celebrationIdStr), JSON.stringify(appended));
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const notices: string[] = [];
      if (duplicates.length > 0) {
        notices.push(`Already had: ${duplicates.map((d) => d.label).join(', ')}.`);
      }
      if (overflow > 0) {
        notices.push(`${overflow} challenge${overflow === 1 ? '' : 's'} skipped — an event can have up to 10.`);
      }

      if (notices.length > 0) {
        Alert.alert('Challenges added', notices.join(' '), [
          { text: 'OK', onPress: () => router.replace(`/celebration/${celebrationId}/challenges`) },
        ]);
      } else {
        router.replace(`/celebration/${celebrationId}/challenges`);
      }
    } catch (error) {
      console.error('[challenge-packs] failed to add pack', error);
      Alert.alert('Error', 'Failed to add these challenges.');
    } finally {
      setAdding(false);
    }
  }

  if (!pack) {
    return (
      <Screen>
        <AppText variant="bodyLarge">That pack couldn't be found.</AppText>
      </Screen>
    );
  }

  return (
    <Screen
      scrollable={false}
      stickyAction={<Button label="Add these challenges" loading={adding} haptic onPress={handleAdd} />}
    >
      <FlatList
        data={pack.challenges}
        keyExtractor={(item) => item.label}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.xl, marginBottom: spacing.lg }}>
            <View style={S.topNav}>
              <Pressable
                onPress={() => router.back()}
                style={S.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <BackChevron />
                <AppText style={S.backBtnText}>Back</AppText>
              </Pressable>
            </View>

            <View style={{ gap: spacing.xs, alignItems: 'center' }}>
              <View style={S.packIconCircle}>
                <AppText style={{ fontSize: 28 }}>{pack.icon}</AppText>
              </View>
              <AppText variant="displayLarge" align="center">{pack.name}</AppText>
              <AppText variant="bodyLarge" tone="secondary" align="center">
                {pack.description}
              </AppText>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={S.challengeRow}>
            <View style={S.challengeIconCircle}>
              <ChallengeIconSVG type={item.icon} size={22} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="labelLarge" style={{ color: colours.textPrimary }}>
                {item.label}
              </AppText>
              <AppText variant="bodySmall" tone="secondary">
                {item.instructions}
              </AppText>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const S = StyleSheet.create({
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    marginLeft: -4,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: 'InstrumentSans_500Medium',
    color: colours.textSecondary,
  },
  packIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colours.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    padding: spacing.base,
  },
  challengeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colours.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
