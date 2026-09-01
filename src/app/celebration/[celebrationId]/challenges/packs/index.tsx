import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import {
  CHALLENGE_PACKS,
  CHALLENGE_PACK_CATEGORIES,
  type ChallengePack,
  type ChallengePackCategory,
} from '@/features/celebrations/challenge-packs';

function BackChevron({ size = 18, color = colours.textSecondary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRight({ size = 18, color = colours.textSecondary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ChallengePacksScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const [category, setCategory] = useState<ChallengePackCategory>('weddings');

  const visiblePacks = useMemo(
    () => CHALLENGE_PACKS.filter((pack) => pack.category === category),
    [category],
  );

  function openPack(pack: ChallengePack) {
    router.push(`/celebration/${celebrationId}/challenges/packs/${pack.id}` as never);
  }

  function createOwn() {
    router.push(`/celebration/${celebrationId}/challenges/new` as never);
  }

  return (
    <Screen edgeToEdge={false} scrollable={false}>
      <FlatList
        data={visiblePacks}
        keyExtractor={(pack) => pack.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
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

            <View style={{ gap: spacing.xs }}>
              <AppText variant="eyebrow" tone="secondary">Guest Prompts</AppText>
              <AppText variant="displayLarge">Challenge Packs</AppText>
              <AppText variant="bodyLarge" tone="secondary">
                Pick a set of prompts to help guests notice the moments worth capturing.
              </AppText>
            </View>

            <Pressable onPress={createOwn} style={S.customRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="labelLarge" style={{ color: colours.textPrimary }}>
                  Create your own challenge
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Write a custom prompt from scratch.
                </AppText>
              </View>
              <ChevronRight />
            </Pressable>

            <View style={S.tabs} accessibilityRole="tablist">
              {CHALLENGE_PACK_CATEGORIES.map((option) => {
                const selected = option.id === category;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                    onPress={() => setCategory(option.id)}
                    style={[S.tab, selected && S.tabSelected]}
                  >
                    <AppText variant="label" tone={selected ? 'onBrand' : 'secondary'} numberOfLines={1}>
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openPack(item)} style={S.packCard}>
            <View style={S.packIconCircle}>
              <AppText style={{ fontSize: 24 }}>{item.icon}</AppText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="labelLarge" style={{ color: colours.textPrimary }}>
                {item.name}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
                {item.description}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" style={{ marginTop: 2 }}>
                {item.challenges.length} challenges
              </AppText>
            </View>
            <ChevronRight />
          </Pressable>
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
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    padding: spacing.base,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colours.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
  },
  tabSelected: {
    backgroundColor: colours.brandPrimary,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    padding: spacing.base,
  },
  packIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colours.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
