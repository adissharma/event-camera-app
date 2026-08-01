import { useCallback, useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Alert,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { colours, layout, radii, spacing } from '@/design';
import { celebrationDetailKeys } from '@/services/celebration-detail';

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

const DEFAULT_CHALLENGES: Challenge[] = [
  { id: 'c1', label: 'First Dance',      icon: 'firstDance' },
  { id: 'c2', label: 'Wedding Rings',    icon: 'rings' },
  { id: 'c3', label: 'Best Group Photo', icon: 'group' },
  { id: 'c4', label: 'Decor Details',    icon: 'decor' },
  { id: 'c5', label: 'Candlelight',      icon: 'candle' },
];

const CHALLENGE_BRIEFS: Record<string, { desc: string; instr: string }> = {
  firstDance: { desc: '', instr: "Wait for the music to slow, find a clear angle of the dancefloor, and snap a candid reaction or wide frame of their dip!" },
  rings: { desc: '', instr: "Look for a moment when they rest their hands together on a table, or ask to snap a macro shot of the rings catching the light." },
  group: { desc: '', instr: "Squeeze everyone close together, make sure all faces are visible and well-lit, and capture the joy of the celebration!" },
  decor: { desc: '', instr: "Shoot from a low angle to emphasize the candle arrangements, or frame the menu cards and place cards in soft focus." },
  candle: { desc: '', instr: "Turn off your camera flash, steady your hands, and capture the flickering flames lighting up the guests' smiles." },
  champagne: { desc: '', instr: "Snap the glasses clinking mid-air, or capture the bubbles in the glass offset by the background bokeh." },
  cake: { desc: '', instr: "Frame the entire cake showing the floral decorations, or snap the couple sharing the first bite!" },
  bouquet: { desc: '', instr: "Find the bridal party laughing together, or get a close-up of the delicate floral arrangements." },
  gift: { desc: '', instr: "Highlight the guest book, the envelope box, or the handwritten signs." },
  confetti: { desc: '', instr: "Pre-focus on the aisle, wait for the couple to walk through the shower of petals, and snap a high-energy shot!" }
};

// ── SVG Icons ──

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

function ChallengeIconSVG({ type, size = 24 }: { type: string; size?: number }) {
  const c = '#FFFFFF';
  const w = 1.6;
  const lc = 'round' as const;
  const lj = 'round' as const;

  const icons: Record<string, React.ReactNode> = {
    firstDance: (
      <>
        <Circle cx={8} cy={5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={16} cy={5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M8 7c-1.5.5-2 1.5-2 3L5 14l1.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 7c1.5.5 2 1.5 2 3l.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M16 7c1.5.5 2 1.5 2 3l1 4-1.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M16 7c-1.5.5-2 1.5-2 3l-.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M10 10l4 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    rings: (
      <>
        <Path d="M6 12a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M9 12a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    group: (
      <>
        <Circle cx={12} cy={5} r={2.2} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={5.5} cy={7.5} r={1.8} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={18.5} cy={7.5} r={1.8} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M8 21c0-3.5 1.8-5 4-5s4 1.5 4 5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M3 21c0-2.5 1-4 2.5-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M21 21c0-2.5-1-4-2.5-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    decor: (
      <>
        <Path d="M12 21V11" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M12 11c0 0-5-3.5-5-7a5 5 0 0 1 10 0c0 3.5-5 7-5 7z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 15c-3 1.5-5.5 0-5.5 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M12 15c3 1.5 5.5 0 5.5 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    candle: (
      <>
        <Path d="M12 3c0 0-1.5 1.5-1.5 3.5S11.2 9 12 9s1.5-.8 1.5-2.5S12 3 12 3z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Rect x={9} y={9} width={6} height={12} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M9.5 13.5h5" stroke={c} strokeWidth={0.8} strokeLinecap={lc} strokeDasharray="1 1.5" />
      </>
    ),
    champagne: (
      <>
        <Path d="M9 3h6L13 12h-2L9 3z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 12v7" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M8.5 19h7" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M11 7.5v.5M13 6v.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    cake: (
      <>
        <Rect x={7} y={6} width={10} height={5} rx={0.5} stroke={c} strokeWidth={w} fill="none" />
        <Rect x={4} y={11} width={16} height={8} rx={0.5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 3.5v2.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M11 3.5c0 0 .5-1 1-1s1 1 1 1" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 11v8M12 11v8M16 11v8" stroke={c} strokeWidth={0.6} strokeLinecap={lc} />
      </>
    ),
    bouquet: (
      <>
        <Circle cx={12} cy={6} r={2.5} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={7} cy={9.5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={17} cy={9.5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 8.5V18M8.5 11.5V18M15.5 11.5V18" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M8 17.5h8" stroke={c} strokeWidth={1.5} fill="none" strokeLinecap={lc} />
      </>
    ),
    gift: (
      <>
        <Rect x={4} y={9} width={16} height={11} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 9v11" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M4 13h16" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M12 9c0 0-3-1.5-3-4a2 2 0 0 1 4 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 9c0 0 3-1.5 3-4a2 2 0 0 0-4 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} fillRule="evenodd" clipRule="evenodd" />
      </>
    ),
    confetti: (
      <>
        <Path d="M12 3l1 4-3.5-2.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M20 8l-3.5 1.5 1-3.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M18 16l-4-1 2.5-3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 20l-.5-4 3.5 2" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M4 13l3-2.5-.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Circle cx={12} cy={12} r={2} stroke={c} strokeWidth={w} fill="none" />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icons[type] ?? icons.confetti}
    </Svg>
  );
}

// ── View All Challenges Screen Component ──

export default function ViewChallengesScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag and drop states
  const [activeDragIdx, setActiveDragIdx] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const currentDragIdxRef = useRef<number | null>(null);
  const challengesRef = useRef<Challenge[]>([]);

  // Keep ref in sync for gestural thread
  useEffect(() => {
    challengesRef.current = challenges;
  }, [challenges]);

  // Load from AsyncStorage
  const loadChallenges = async () => {
    try {
      const key = `__mock_challenges_${celebrationId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setChallenges(JSON.parse(stored) as Challenge[]);
      } else {
        setChallenges([...DEFAULT_CHALLENGES]);
      }
    } catch {
      setChallenges([...DEFAULT_CHALLENGES]);
    } finally {
      setLoading(false);
    }
  };

  // Re-read on every focus, not just on mount.
  //
  // Pushing the form leaves this screen mounted underneath, so a mount-only
  // effect never ran again on the way back and a newly created challenge was
  // written to storage but never appeared in the list.
  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [celebrationId]),
  );

  // Save back to AsyncStorage
  const saveChallengesOrder = async (nextList: Challenge[]) => {
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
  };

  // Drag handle PanResponder.
  //
  // Derived from the card metrics rather than approximated: the drag maps a
  // pixel offset onto a row count, so a stride that disagrees with the real
  // card pitch drifts further out of step the further the host drags.
  const ITEM_HEIGHT = CARD_HEIGHT + CARD_GAP;

  const makePanResponder = (index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        currentDragIdxRef.current = index;
        setActiveDragIdx(index);
        dragY.setValue(0);
        void Haptics.selectionAsync().catch(() => {});
      },
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(gestureState.dy);

        const currentIdx = currentDragIdxRef.current;
        if (currentIdx === null) return;

        // Calculate potential index shifts
        const dragShift = Math.round(gestureState.dy / ITEM_HEIGHT);
        const targetIdx = currentIdx + dragShift;

        if (targetIdx !== currentIdx && targetIdx >= 0 && targetIdx < challengesRef.current.length) {
          // Perform swap in local state
          const updated = [...challengesRef.current];
          const [draggedItem] = updated.splice(currentIdx, 1);
          updated.splice(targetIdx, 0, draggedItem);
          
          setChallenges(updated);
          currentDragIdxRef.current = targetIdx;
          
          // Compensate Animated Y value by offset so dragging doesn't jump
          dragY.setValue(gestureState.dy - dragShift * ITEM_HEIGHT);
          void Haptics.selectionAsync().catch(() => {});
        }
      },
      onPanResponderRelease: () => {
        setActiveDragIdx(null);
        currentDragIdxRef.current = null;
        dragY.setValue(0);
        // Save new state
        saveChallengesOrder(challengesRef.current);
      },
      onPanResponderTerminate: () => {
        setActiveDragIdx(null);
        currentDragIdxRef.current = null;
        dragY.setValue(0);
      },
    });
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

  const countAdded = challenges.length;
  const progressRatio = Math.min(1, countAdded / 5);

  return (
    <Screen scrollable={false}>
      {/* Header bar */}
      <View style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backButton}>
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
            {countAdded} of 5 recommended challenges added
          </AppText>
        </View>
      </View>

      {/* Challenges list */}
      <ScrollView
        scrollEnabled={activeDragIdx === null}
        contentContainerStyle={S.listContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'relative' }}>
          {challenges.map((c, index) => {
            const isDragging = activeDragIdx === index;
            const pResponder = makePanResponder(index);

            return (
              <Animated.View
                key={c.id}
                style={[
                  S.card,
                  isDragging && {
                    zIndex: 999,
                    backgroundColor: '#1E1E20',
                    transform: [{ translateY: dragY }],
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.45,
                    shadowRadius: 12,
                    elevation: 8,
                  },
                ]}
              >
                <Pressable
                  onPress={() => router.push(`/celebration/${celebrationId}/challenges/${c.id}`)}
                  style={S.cardContent}
                >
                  <View style={S.iconBox}>
                    <ChallengeIconSVG type={c.icon} size={22} />
                  </View>
                  <View style={S.textGroup}>
                    <AppText style={S.challengeTitle}>{c.label}</AppText>
                    <AppText style={S.challengeInstr} numberOfLines={2}>
                      {c.instructions || CHALLENGE_BRIEFS[c.icon]?.instr || 'No instructions provided.'}
                    </AppText>
                  </View>
                </Pressable>

                {/* Drag handle */}
                <View {...pResponder.panHandlers} style={S.dragHandle}>
                  <DragHandleIcon />
                </View>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky Bottom button */}
      <View style={S.footer}>
        <Button
          label="Add New Challenge"
          onPress={() => router.push(`/celebration/${celebrationId}/challenges/new`)}
          haptic
          fullWidth
        />
      </View>
    </Screen>
  );
}

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
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 110,
    backgroundColor: '#0B0B0C',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121213',
    borderRadius: radii.md,
    marginBottom: CARD_GAP,
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
    width: 38,
    height: 38,
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
});
