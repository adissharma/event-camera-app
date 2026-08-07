import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Alert,
  PanResponder,
  Animated,
  ActivityIndicator,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { colours, radii, spacing } from '@/design';
import { celebrationDetailKeys } from '@/services/celebration-detail';
import {
  CHALLENGE_BRIEFS as SHARED_CHALLENGE_BRIEFS,
  ChallengeIconSVG as SharedChallengeIconSVG,
} from '@/features/celebrations/challenge-icons';

// ── Models & Presets ──

type Challenge = {
  id: string;
  label: string;
  icon: string;
  instructions?: string;
  photo?: string | null;
};

/** Card pitch, shared by the layout and the drag maths so they cannot drift. */
const CARD_HEIGHT = 74;
const CARD_GAP = spacing.sm;
const ITEM_HEIGHT = CARD_HEIGHT + CARD_GAP;
const RECOMMENDED_TARGET = 5;
const MAX_CHALLENGES = 10;
const DRAG_SPRING_CONFIG = {
  toValue: 0,
  useNativeDriver: false,
  tension: 140,
  friction: 16,
} as const;

const DEFAULT_CHALLENGES: Challenge[] = [
  { id: 'c1', label: 'First Dance',      icon: 'firstDance' },
  { id: 'c2', label: 'Wedding Rings',    icon: 'rings' },
  { id: 'c3', label: 'Best Group Photo', icon: 'group' },
  { id: 'c4', label: 'Decor Details',    icon: 'decor' },
  { id: 'c5', label: 'Candlelight',      icon: 'candle' },
  { id: 'c6', label: 'Cake Moment',      icon: 'cake' },
  { id: 'c7', label: 'Bouquet Toss',     icon: 'bouquet' },
  { id: 'c8', label: 'Toasts & Cheers',  icon: 'champagne' },
  { id: 'c9', label: 'Gift Moment',      icon: 'gift' },
  { id: 'c10', label: 'Confetti Exit',   icon: 'confetti' },
];

function DragHandleIcon({ size = 20, color = 'rgba(255, 255, 255, 0.4)' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={6} r={1.5} fill={color} />
      <Circle cx={16} cy={6} r={1.5} fill={color} />
      <Circle cx={8} cy={12} r={1.5} fill={color} />
      <Circle cx={16} cy={12} r={1.5} fill={color} />
      <Circle cx={8} cy={18} r={1.5} fill={color} />
      <Circle cx={16} cy={18} r={1.5} fill={color} />
    </Svg>
  );
}

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

function ChallengeDragHandle({
  challengeId,
  onGrant,
  onMove,
  onRelease,
}: {
  challengeId: string;
  onGrant: (challengeId: string) => void;
  onMove: (challengeId: string, gestureState: PanResponderGestureState) => void;
  onRelease: (challengeId: string) => void;
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          onGrant(challengeId);
        },
        onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          onMove(challengeId, gestureState);
        },
        onPanResponderRelease: () => {
          onRelease(challengeId);
        },
        onPanResponderTerminate: () => {
          onRelease(challengeId);
        },
      }),
    [challengeId, onGrant, onMove, onRelease],
  );

  return (
    <View {...panResponder.panHandlers} style={S.dragHandle}>
      <DragHandleIcon />
    </View>
  );
}

// ── View All Challenges Screen Component ──

export default function ViewChallengesScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { draft } = useCreationDraft();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const challengesRef = useRef<Challenge[]>([]);
  const [cardTopMap, setCardTopMap] = useState<Record<string, Animated.Value>>({});
  const dragTop = useRef(new Animated.Value(0)).current;
  const dragStartTopRef = useRef(0);
  const activeDragIdRef = useRef<string | null>(null);

  function clampIndex(index: number, length: number): number {
    return Math.max(0, Math.min(index, Math.max(0, length - 1)));
  }

  function moveItem(list: Challenge[], fromIndex: number, toIndex: number): Challenge[] {
    if (fromIndex === toIndex) return list;

    const updated = [...list];
    const [item] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, item);
    return updated;
  }

  function syncCardTopMap(
    previous: Record<string, Animated.Value>,
    nextChallenges: Challenge[],
  ): Record<string, Animated.Value> {
    let changed = false;
    const next: Record<string, Animated.Value> = {};

    for (const [index, challenge] of nextChallenges.entries()) {
      const existing = previous[challenge.id];
      if (existing) {
        next[challenge.id] = existing;
      } else {
        next[challenge.id] = new Animated.Value(index * ITEM_HEIGHT);
        changed = true;
      }
    }

    if (Object.keys(previous).length !== Object.keys(next).length) {
      changed = true;
    }

    return changed ? next : previous;
  }

  const applyChallenges = useCallback((nextChallenges: Challenge[]) => {
    challengesRef.current = nextChallenges;
    setChallenges(nextChallenges);
    setCardTopMap((previous) => syncCardTopMap(previous, nextChallenges));
  }, []);

  // Load from AsyncStorage
  const loadChallenges = useCallback(async () => {
    try {
      const key = `__mock_challenges_${celebrationId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        applyChallenges(JSON.parse(stored) as Challenge[]);
      } else {
        applyChallenges([...DEFAULT_CHALLENGES]);
      }
    } catch {
      applyChallenges([...DEFAULT_CHALLENGES]);
    } finally {
      setLoading(false);
    }
  }, [applyChallenges, celebrationId]);

  // Re-read on every focus, not just on mount.
  //
  // Pushing the form leaves this screen mounted underneath, so a mount-only
  // effect never ran again on the way back and a newly created challenge was
  // written to storage but never appeared in the list.
  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [loadChallenges]),
  );

  // Save back to AsyncStorage
  const saveChallengesOrder = useCallback(async (nextList: Challenge[]) => {
    try {
      const key = `__mock_challenges_${celebrationId}`;
      await AsyncStorage.setItem(key, JSON.stringify(nextList));
      // Invalidate dashboard details
      queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebrationId)),
      });
    } catch {
      Alert.alert('Error', 'Failed to save reordered list.');
    }
  }, [celebrationId, queryClient]);

  useEffect(() => {
    challengesRef.current = challenges;
    for (const [index, challenge] of challenges.entries()) {
      const top = cardTopMap[challenge.id];
      if (!top) continue;
      if (challenge.id === activeDragIdRef.current) continue;

      Animated.spring(top, {
        ...DRAG_SPRING_CONFIG,
        toValue: index * ITEM_HEIGHT,
      }).start();
    }
  }, [cardTopMap, challenges]);

  const finishDrag = useCallback((id: string) => {
    const finalIndex = challengesRef.current.findIndex((challenge) => challenge.id === id);
    const finalTop = Math.max(0, finalIndex) * ITEM_HEIGHT;

    Animated.spring(dragTop, {
      ...DRAG_SPRING_CONFIG,
      toValue: finalTop,
    }).start(() => {
      const updated = [...challengesRef.current];
      const activeTop = cardTopMap[id];
      activeTop?.setValue(finalTop);

      setActiveDragId(null);
      activeDragIdRef.current = null;
      dragStartTopRef.current = 0;
      saveChallengesOrder(updated);
    });
  }, [cardTopMap, dragTop, saveChallengesOrder]);

  const handleDragGrant = useCallback((id: string) => {
    const currentIndex = challengesRef.current.findIndex((challenge) => challenge.id === id);
    if (currentIndex === -1) return;

    const startTop = currentIndex * ITEM_HEIGHT;
    activeDragIdRef.current = id;
    dragStartTopRef.current = startTop;
    dragTop.setValue(startTop);
    setActiveDragId(id);
    void Haptics.selectionAsync().catch(() => {});
  }, [dragTop]);

  const handleDragMove = useCallback((
    id: string,
    gestureState: PanResponderGestureState,
  ) => {
    if (activeDragIdRef.current !== id) return;

    const maxTop = Math.max(0, (challengesRef.current.length - 1) * ITEM_HEIGHT);
    const nextTop = Math.max(0, Math.min(dragStartTopRef.current + gestureState.dy, maxTop));
    dragTop.setValue(nextTop);

    const currentIndex = challengesRef.current.findIndex((challenge) => challenge.id === id);
    if (currentIndex === -1) return;

    const hoverIndex = clampIndex(Math.round(nextTop / ITEM_HEIGHT), challengesRef.current.length);
    if (hoverIndex === currentIndex) return;

    const reordered = moveItem(challengesRef.current, currentIndex, hoverIndex);
    applyChallenges(reordered);
    void Haptics.selectionAsync().catch(() => {});
  }, [applyChallenges, dragTop]);

  const handleDragRelease = useCallback((id: string) => {
    if (activeDragIdRef.current !== id) return;
    finishDrag(id);
  }, [finishDrag]);

  if (loading) {
    return (
      <Screen scrollable={false}>
        <View style={S.center}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  const countAdded = challenges.length;
  const recommendedCount = Math.min(countAdded, RECOMMENDED_TARGET);
  const progressRatio = recommendedCount / RECOMMENDED_TARGET;
  const limitReached = countAdded >= MAX_CHALLENGES;

  /* eslint-disable react-hooks/refs */
  return (
    <Screen scrollable={false}>
      {/* Header bar */}
      <View style={S.header}>
        <Pressable
          onPress={() => {
            router.back();
          }}
          style={S.backButton}
        >
          <BackChevron />
        </Pressable>
        <AppText variant="bodyLarge" style={S.headerTitle}>Challenges</AppText>
        <View style={{ width: 44 }} />
      </View>

      {/* Recommended progress card */}
      <View style={S.progressWrapper}>
        <View style={S.progressCard}>
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="titleMedium" style={S.progressTitle}>Make it more fun</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Add at least 5 challenges to give your guests plenty to capture.
            </AppText>
          </View>
          
          <View style={S.progressBarContainer}>
            <View style={[S.progressBar, { width: `${progressRatio * 100}%` }]} />
          </View>

          <AppText variant="caption" tone="secondary" style={S.progressLabel}>
            {recommendedCount} of 5 recommended challenges added
          </AppText>
        </View>
      </View>

      <View style={S.challengeCountWrap}>
        <AppText variant="titleSmall" style={S.challengeCountTitle}>
          {challenges.length} challenge{challenges.length === 1 ? '' : 's'} created
        </AppText>
      </View>

      {/* Challenges list */}
      <ScrollView
        scrollEnabled={activeDragId === null}
        contentContainerStyle={S.listContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[S.listInner, { height: Math.max(0, challenges.length * ITEM_HEIGHT - CARD_GAP) }]}>
          {challenges.map((c, index) => {
            const isDragging = activeDragId === c.id;

            return (
              <Animated.View
                key={c.id}
                style={[
                  S.card,
                  isDragging ? {
                    zIndex: 999,
                    backgroundColor: '#1E1E20',
                    top: dragTop,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.45,
                    shadowRadius: 12,
                    elevation: 8,
                    transform: [{ scale: 1.02 }],
                  } : {
                    top: cardTopMap[c.id] ?? index * ITEM_HEIGHT,
                  },
                ]}
              >
                <Pressable
                  onPress={() => router.push(`/celebration/${celebrationId}/challenges/${c.id}`)}
                  style={S.cardContent}
                >
                  <View style={S.iconBox}>
                    <SharedChallengeIconSVG type={c.icon} size={24} />
                  </View>
                  <View style={S.textGroup}>
                    <AppText style={S.challengeTitle}>{c.label}</AppText>
                    <AppText style={S.challengeInstr} numberOfLines={2}>
                      {c.instructions || SHARED_CHALLENGE_BRIEFS[c.icon]?.instr || 'No instructions provided.'}
                    </AppText>
                  </View>
                </Pressable>

                <ChallengeDragHandle
                  challengeId={c.id}
                  onGrant={handleDragGrant}
                  onMove={handleDragMove}
                  onRelease={handleDragRelease}
                />
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky Bottom button */}
      <View style={S.footer}>
        {limitReached ? (
          <AppText variant="caption" tone="warning" style={S.footerNote}>
            Limit reached. You can&apos;t add more than 10 challenges.
          </AppText>
        ) : null}
        <Button
          label="Add New Challenge"
          onPress={() => {
            if (limitReached) return;
            router.push(`/celebration/${celebrationId}/challenges/new`);
          }}
          haptic
          fullWidth
          disabled={limitReached}
          disabledReason="You can't add more than 10 challenges."
        />
      </View>
    </Screen>
  );
}

/* eslint-enable react-hooks/refs */

const S = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0C',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F22',
    backgroundColor: '#0B0B0C',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  progressWrapper: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#0B0B0C',
  },
  progressCard: {
    backgroundColor: '#161617',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#242426',
  },
  progressTitle: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#EFE9E0',
    borderRadius: 3,
  },
  progressLabel: {
    fontFamily: 'InstrumentSans_500Medium',
  },
  challengeCountWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: '#0B0B0C',
  },
  challengeCountTitle: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 110,
    backgroundColor: '#0B0B0C',
  },
  listInner: {
    position: 'relative',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121213',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#1F1F21',
    height: CARD_HEIGHT,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    height: '100%',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 19,
    backgroundColor: '#1E1E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  challengeInstr: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'InstrumentSans_400Regular',
  },
  dragHandle: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: '#0B0B0C',
    borderTopWidth: 1,
    borderTopColor: '#1F1F22',
  },
  footerNote: {
    marginBottom: spacing.sm,
  },
});
