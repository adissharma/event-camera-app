import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  SectionList,
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { Reveal } from '@/components/feedback/reveal';
import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { colours, layout, radii, spacing } from '@/design';
import { celebrationDetailKeys } from '@/services/celebration-detail';
import { isBackendConfigured } from '@/lib/supabase/client';
import {
  listChallenges,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  legacyChallengesKey,
} from '@/services/challenges';
import {
  ChallengeIconSVG,
  type ChallengeIconOption,
  CHALLENGE_ICON_SECTIONS,
  OPENMOJI_LIBRARY_COUNT,
  normalizeChallengeIconValue,
  resolveChallengeBrief,
} from '@/features/celebrations/challenge-icons';

/** Compact square tile height for the emoji-only picker grid. */
const GRID_CELL_HEIGHT = 84;

/** Enforced by the field, the counter and the save guard from one place. */
const TITLE_MAX = 20;
const MAX_CHALLENGES = 10;
const GRID_COLUMNS = 3;
const INITIAL_VISIBLE_ITEMS = GRID_COLUMNS * 2;
const PAGE_SIZE = GRID_COLUMNS * 5;

// ── Models & Presets ──

type Challenge = {
  id: string;
  label: string;
  icon: string;
  instructions?: string;
  photo?: string | null;
};

const DEFAULT_CHALLENGES: Challenge[] = [
  { id: 'c1', label: 'First Dance',      icon: 'firstDance' },
  { id: 'c2', label: 'Wedding Rings',    icon: 'rings' },
  { id: 'c3', label: 'Best Group Photo', icon: 'group' },
  { id: 'c4', label: 'Decor Details',    icon: 'decor' },
  { id: 'c5', label: 'Candlelight',      icon: 'candle' },
];

// ── SVG Icons ──

function BackChevron({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SearchIcon({ size = 16, color = 'rgba(255, 255, 255, 0.4)' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={2} />
      <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function OverflowDotsIcon({ size = 20, color = 'rgba(255, 255, 255, 0.75)' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={12} r={1.8} fill={color} />
      <Circle cx={12} cy={12} r={1.8} fill={color} />
      <Circle cx={18} cy={12} r={1.8} fill={color} />
    </Svg>
  );
}

/**
 * The current challenge list, server-backed where a backend exists and local
 * only on the offline development path. Returned in this screen's own
 * `Challenge` shape so both branches below read the same way.
 */
async function loadChallengeList(celebrationId: string): Promise<Challenge[]> {
  if (isBackendConfigured) {
    const remote = await listChallenges(celebrationId);
    if (remote) {
      return remote.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        instructions: item.instructions ?? undefined,
        photo: item.photoUri,
      }));
    }
  }

  const stored = await AsyncStorage.getItem(legacyChallengesKey(celebrationId));
  return stored ? (JSON.parse(stored) as Challenge[]) : [...DEFAULT_CHALLENGES];
}

// ── Add/Edit Challenge Form Component ──

export default function ChallengeFormScreen() {
  const { celebrationId, challengeId } = useLocalSearchParams<{ celebrationId: string; challengeId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isEdit = challengeId !== 'new';

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(normalizeChallengeIconValue('confetti'));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Validation errors
  const [titleError, setTitleError] = useState(false);
  const [instructionsError, setInstructionsError] = useState(false);

  // Load existing challenge if editing
  useEffect(() => {
    (async () => {
      try {
        const list = await loadChallengeList(String(celebrationId));

        if (isEdit) {
          const item = list.find((c) => c.id === challengeId);
          if (item) {
            setTitle(item.label);
            const normalizedIcon = normalizeChallengeIconValue(item.icon);
            setInstructions(item.instructions || resolveChallengeBrief(item.icon)?.instr || '');
            setSelectedIcon(normalizedIcon);
          } else {
            Alert.alert('Error', 'Challenge not found.');
            router.back();
          }
        } else if (list.length >= MAX_CHALLENGES) {
          Alert.alert('Limit reached', "You can't add more than 10 challenges.");
          router.back();
          return;
        }
      } catch {
        Alert.alert('Error', 'Failed to load challenge details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [celebrationId, challengeId, isEdit, router]);

  const handleSelectIcon = (icon: string) => {
    setSelectedIcon(icon);
    void Haptics.selectionAsync().catch(() => {});
    if (!instructions.trim()) {
      setInstructions(resolveChallengeBrief(icon)?.instr || '');
    }
  };

  const handleDeleteChallenge = async () => {
    if (!isEdit) return;

    setMenuVisible(false);

    try {
      const submissionsKey = `__mock_challenge_submissions_${celebrationId}_${challengeId}`;
      const storedSubmissions = await AsyncStorage.getItem(submissionsKey);
      const submissions = storedSubmissions ? (JSON.parse(storedSubmissions) as unknown[]) : [];
      const photoCount = submissions.length;

      Alert.alert(
        'Delete challenge?',
        photoCount > 0
          ? `This challenge has ${photoCount} guest photo${photoCount === 1 ? '' : 's'}. Deleting it will remove the challenge and those photos from the event.`
          : 'Deleting this challenge will remove it from the event.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Challenge',
            style: 'destructive',
            onPress: async () => {
              try {
                if (isBackendConfigured) {
                  await deleteChallenge(String(challengeId));
                } else {
                  const key = legacyChallengesKey(String(celebrationId));
                  const stored = await AsyncStorage.getItem(key);
                  const list: Challenge[] = stored ? JSON.parse(stored) : [...DEFAULT_CHALLENGES];
                  await AsyncStorage.setItem(
                    key,
                    JSON.stringify(list.filter((item) => item.id !== challengeId)),
                  );
                }
                await AsyncStorage.removeItem(submissionsKey);

                queryClient.invalidateQueries({
                  queryKey: celebrationDetailKeys.detail(String(celebrationId)),
                });

                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                router.replace(`/celebration/${celebrationId}/challenges`);
              } catch {
                Alert.alert('Error', 'Failed to delete challenge.');
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert('Error', 'Failed to check challenge submissions.');
    }
  };

  const handleSave = async () => {
    let hasError = false;
    if (!title.trim()) {
      setTitleError(true);
      hasError = true;
    } else {
      setTitleError(false);
    }

    if (!instructions.trim()) {
      setInstructionsError(true);
      hasError = true;
    } else {
      setInstructionsError(false);
    }

    if (hasError) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setSaving(true);
    try {
      const list = await loadChallengeList(String(celebrationId));

      if (isEdit) {
        if (isBackendConfigured) {
          await updateChallenge(String(challengeId), {
            label: title.trim(),
            icon: selectedIcon,
            instructions: instructions.trim(),
          });
        } else {
          const updated = list.map((c) =>
            c.id === challengeId
              ? { ...c, label: title.trim(), icon: selectedIcon, instructions: instructions.trim() }
              : c,
          );
          await AsyncStorage.setItem(
            legacyChallengesKey(String(celebrationId)),
            JSON.stringify(updated),
          );
        }
      } else {
        if (list.length >= MAX_CHALLENGES) {
          Alert.alert('Limit reached', "You can't add more than 10 challenges.");
          return;
        }

        if (isBackendConfigured) {
          await createChallenge(String(celebrationId), {
            label: title.trim(),
            icon: selectedIcon,
            instructions: instructions.trim(),
            // Appended to the end of the host's existing order.
            sortOrder: list.length,
          });
        } else {
          const newChallenge: Challenge = {
            id: `c_${Date.now()}`,
            label: title.trim(),
            icon: selectedIcon,
            instructions: instructions.trim(),
            photo: null,
          };
          await AsyncStorage.setItem(
            legacyChallengesKey(String(celebrationId)),
            JSON.stringify([...list, newChallenge]),
          );
        }
      }

      // Sync React Query cache
      queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebrationId)),
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save challenge.');
    } finally {
      setSaving(false);
    }
  };

  const searchQueryTrimmed = searchQuery.trim().toLowerCase();
  const hasSearch = searchQueryTrimmed.length > 0;

  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      CHALLENGE_ICON_SECTIONS.map((section) => [
        section.key,
        Math.min(section.data.length, INITIAL_VISIBLE_ITEMS),
      ]),
    ) as Record<string, number>,
  );

  const visibleSections = useMemo(() => {
    const sections: {
      key: string;
      title: string;
      data: ChallengeIconOption[][];
      total: number;
    }[] = CHALLENGE_ICON_SECTIONS
      .map((section) => {
        const matched = hasSearch
          ? section.data.filter((item) => item.searchText.includes(searchQueryTrimmed))
          : section.data;
        const data = hasSearch
          ? matched
          : matched.slice(0, visibleCounts[section.key] ?? PAGE_SIZE);
        const rows: ChallengeIconOption[][] = [];

        for (let index = 0; index < data.length; index += GRID_COLUMNS) {
          rows.push(data.slice(index, index + GRID_COLUMNS));
        }

        return {
          ...section,
          data: rows,
          total: matched.length,
        };
      })
      .filter((section) => section.data.length > 0);

    return sections;
  }, [hasSearch, searchQueryTrimmed, visibleCounts]);

  const expandSection = (sectionKey: string) => {
    const section = CHALLENGE_ICON_SECTIONS.find((item) => item.key === sectionKey);
    if (!section) return;

    setVisibleCounts((current) => ({
      ...current,
      [sectionKey]: Math.min((current[sectionKey] ?? PAGE_SIZE) + PAGE_SIZE, section.data.length),
    }));
  };

  if (loading) {
    return (
      <Screen scrollable={false}>
        <View style={S.center}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scrollable={false}
      stickyActionFollowsKeyboard={false}
      // Sticky, exactly as the creation steps do it: the primary action never
      // scrolls away and never ends up under the keyboard.
      stickyAction={
        <Button
          label={isEdit ? 'Save Changes' : 'Create Challenge'}
          onPress={handleSave}
          loading={saving}
          haptic
        />
      }
    >
      <SectionList
        sections={visibleSections}
        keyExtractor={(item, index) => `${item.map((option) => option.type).join('|')}-${index}`}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.xl }}>
            <View style={S.topNav}>
              <Pressable
                onPress={() => router.back()}
                style={S.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <BackChevron size={18} color={colours.textSecondary} />
                <AppText style={S.backBtnText}>Back</AppText>
              </Pressable>
              {isEdit ? (
                <Pressable
                  onPress={() => setMenuVisible(true)}
                  style={S.menuBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Challenge options"
                >
                  <OverflowDotsIcon />
                </Pressable>
              ) : (
                <View style={S.menuBtn} />
              )}
            </View>

            <Reveal index={0} style={{ gap: spacing.md, maxWidth: layout.maxReadableWidth }}>
              <AppText variant="displayLarge">
                {isEdit ? 'Edit this challenge' : 'Set a challenge'}
              </AppText>
              <AppText variant="bodyLarge" tone="secondary">
                Give your guests something specific to look for. A clear brief gets
                far better photographs than an open invitation.
              </AppText>
            </Reveal>

            <Reveal index={1}>
              <View style={{ gap: spacing.lg }}>
                <TextField
                  label="Challenge name"
                  placeholder="e.g. Wedding Rings"
                  value={title}
                  onChangeText={(txt) => {
                    setTitle(txt.slice(0, TITLE_MAX));
                    if (txt.trim()) setTitleError(false);
                  }}
                  maxLength={TITLE_MAX}
                  error={titleError ? 'Give the challenge a name' : undefined}
                  hint={`${title.length} of ${TITLE_MAX} characters`}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                <TextField
                  label="Guest instructions"
                  placeholder="Tell guests what to capture, and how…"
                  value={instructions}
                  onChangeText={(txt) => {
                    setInstructions(txt);
                    if (txt.trim()) setInstructionsError(false);
                  }}
                  error={instructionsError ? 'Tell guests what to capture' : undefined}
                  hint="Shown to guests when they open this challenge."
                  multiline
                  numberOfLines={4}
                  inputStyle={S.textArea}
                  autoCapitalize="sentences"
                />

                <View style={{ gap: spacing.sm }}>
                  <AppText variant="label" tone="secondary">
                    Emoji
                  </AppText>

                  <View style={S.searchContainer}>
                    <SearchIcon />
                    <TextInput
                      style={S.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={`Search ${OPENMOJI_LIBRARY_COUNT} emojis`}
                      placeholderTextColor={colours.textSecondary}
                      selectionColor={colours.brandPrimary}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                      accessibilityLabel="Search emojis"
                    />
                  </View>
                </View>
              </View>
            </Reveal>
          </View>
        }
        ListEmptyComponent={
          <AppText variant="bodySmall" tone="secondary" style={{ paddingVertical: spacing.md }}>
            No emojis match “{searchQuery}”.
          </AppText>
        }
        renderSectionHeader={({ section }) => (
          <View style={S.sectionHeader}>
            <AppText variant="titleSmall">{section.title}</AppText>
            <AppText variant="caption" tone="secondary">
              {section.data.reduce((sum, row) => sum + row.length, 0)} shown
              {section.total > section.data.reduce((sum, row) => sum + row.length, 0)
                ? ` of ${section.total}`
                : ''}
            </AppText>
          </View>
        )}
        renderSectionFooter={({ section }) => {
          const shown = section.data.reduce((sum, row) => sum + row.length, 0);
          if (hasSearch || section.total <= shown) {
            return null;
          }

          return (
            <Pressable style={S.loadMoreBtn} onPress={() => expandSection(section.key)}>
              <AppText variant="bodySmall" tone="brand" style={S.loadMoreText}>
                Load More in this category
              </AppText>
            </Pressable>
          );
        }}
        renderItem={({ item }) => {
          return (
            <View style={S.iconRow}>
              {item.map((option) => {
                const active = selectedIcon === option.type;
                return (
                  <Pressable
                    key={option.type}
                    onPress={() => handleSelectIcon(option.type)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={option.label}
                    style={[S.gridCell, active && S.gridCellActive]}
                  >
                    <View style={S.cellIcon}>
                      <ChallengeIconSVG type={option.type} size={28} />
                    </View>
                    <AppText variant="caption" tone="secondary" numberOfLines={2} align="center">
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
              {item.length < GRID_COLUMNS
                ? Array.from({ length: GRID_COLUMNS - item.length }, (_, index) => (
                    <View key={`spacer-${index}`} style={S.gridSpacer} />
                  ))
                : null}
            </View>
          );
        }}
      />

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={S.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={S.menuSheet}>
            {isEdit ? (
              <Pressable style={S.menuOption} onPress={handleDeleteChallenge}>
                <AppText style={S.menuDeleteText}>Delete Challenge</AppText>
              </Pressable>
            ) : null}
            <Pressable style={[S.menuOption, S.menuCancelOption]} onPress={() => setMenuVisible(false)}>
              <AppText style={S.menuCancelText}>Cancel</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const S = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Back affordance, matching the creation steps rather than a title bar.
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    marginBottom: -spacing.md,
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
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
  },

  /** Room for several lines, with text starting at the top on Android too. */
  textArea: {
    minHeight: 108,
    textAlignVertical: 'top',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: layout.minTouchTarget,
    borderRadius: radii.lg,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
  },
  searchInput: {
    flex: 1,
    color: colours.textPrimary,
    fontSize: 15,
    fontFamily: 'InstrumentSans_400Regular',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  loadMoreBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  loadMoreText: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  gridSpacer: {
    width: '31.5%',
    minHeight: GRID_CELL_HEIGHT,
  },
  gridCell: {
    width: '31.5%',
    minHeight: GRID_CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colours.surface,
    // Always 2pt. Growing the border on selection shrinks the content box and
    // nudges everything inside it — which is the movement on select. Only the
    // colour changes now.
    borderWidth: 2,
    borderColor: colours.borderStrong,
  },
  gridCellActive: {
    borderColor: colours.brandPrimary,
    backgroundColor: colours.brandSoft,
  },
  cellIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: spacing.md,
  },
  menuSheet: {
    alignSelf: 'flex-end',
    minWidth: 180,
    backgroundColor: colours.surfaceRaised,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  menuOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  menuDeleteText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    color: '#EF4444',
  },
  menuCancelOption: {
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
  },
  menuCancelText: {
    fontFamily: 'InstrumentSans_500Medium',
    color: colours.textSecondary,
  },
});
