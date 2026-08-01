import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { Reveal } from '@/components/feedback/reveal';
import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { colours, layout, radii, spacing } from '@/design';
import { celebrationDetailKeys } from '@/services/celebration-detail';

/**
 * Icon tile height: 24pt glyph + 8pt gap + one line of caption, plus even
 * padding above and below. Fixed so every tile packs its contents identically.
 */
const GRID_CELL_HEIGHT = 88;

/** Enforced by the field, the counter and the save guard from one place. */
const TITLE_MAX = 20;

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

const ICON_OPTIONS = [
  { type: 'firstDance', label: 'First Dance' },
  { type: 'rings',      label: 'Wedding Rings' },
  { type: 'group',      label: 'Group Photo' },
  { type: 'decor',      label: 'Decor Details' },
  { type: 'candle',     label: 'Candlelight' },
  { type: 'champagne',  label: 'Champagne' },
  { type: 'cake',       label: 'Wedding Cake' },
  { type: 'bouquet',    label: 'Bridal Party' },
  { type: 'gift',       label: 'Gifts Table' },
  { type: 'confetti',   label: 'Confetti' },
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
        <Path d="M12 9c0 0 3-1.5 3-4a2 2 0 0 0-4 0" stroke={c} strokeWidth={w} fill="none" fillRule="evenodd" clipRule="evenodd" />
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

// ── Add/Edit Challenge Form Component ──

export default function ChallengeFormScreen() {
  const { celebrationId, challengeId } = useLocalSearchParams<{ celebrationId: string; challengeId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isEdit = challengeId !== 'new';

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('confetti');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Validation errors
  const [titleError, setTitleError] = useState(false);
  const [instructionsError, setInstructionsError] = useState(false);

  // Load existing challenge if editing
  useEffect(() => {
    (async () => {
      try {
        const key = `__mock_challenges_${celebrationId}`;
        const stored = await AsyncStorage.getItem(key);
        const list: Challenge[] = stored ? JSON.parse(stored) : [...DEFAULT_CHALLENGES];
        
        if (isEdit) {
          const item = list.find((c) => c.id === challengeId);
          if (item) {
            setTitle(item.label);
            setInstructions(item.instructions || CHALLENGE_BRIEFS[item.icon]?.instr || '');
            setSelectedIcon(item.icon);
          } else {
            Alert.alert('Error', 'Challenge not found.');
            router.back();
          }
        }
      } catch {
        Alert.alert('Error', 'Failed to load challenge details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [celebrationId, challengeId, isEdit]);

  // Handle icon selection auto-fill instructions if instructions is empty/default
  const handleSelectIcon = (icon: string) => {
    setSelectedIcon(icon);
    void Haptics.selectionAsync().catch(() => {});
    // Auto-fill default prompt instructions if empty
    if (!instructions.trim()) {
      setInstructions(CHALLENGE_BRIEFS[icon]?.instr || '');
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
      const key = `__mock_challenges_${celebrationId}`;
      const stored = await AsyncStorage.getItem(key);
      const list: Challenge[] = stored ? JSON.parse(stored) : [...DEFAULT_CHALLENGES];

      if (isEdit) {
        // Edit challenge in place
        const updated = list.map((c) =>
          c.id === challengeId
            ? { ...c, label: title.trim(), icon: selectedIcon, instructions: instructions.trim() }
            : c
        );
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      } else {
        // Create new challenge
        const newChallenge: Challenge = {
          id: `c_${Date.now()}`,
          label: title.trim(),
          icon: selectedIcon,
          instructions: instructions.trim(),
          photo: null,
        };
        await AsyncStorage.setItem(key, JSON.stringify([...list, newChallenge]));
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

  // Filter icons by query
  const filteredIcons = ICON_OPTIONS.filter((icon) =>
    icon.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              // Doubles as the live character count when there is no error to
              // show, so the two never fight for the same line.
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
                Icon
              </AppText>

              <View style={S.searchContainer}>
                <SearchIcon />
                <TextInput
                  style={S.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search icons…"
                  placeholderTextColor={colours.textSecondary}
                  selectionColor={colours.brandPrimary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Search icons"
                />
              </View>

              {filteredIcons.length === 0 ? (
                <AppText variant="bodySmall" tone="secondary" style={{ paddingVertical: spacing.md }}>
                  No icons match “{searchQuery}”.
                </AppText>
              ) : (
                <View style={S.iconGrid}>
                  {filteredIcons.map((item) => {
                    const active = selectedIcon === item.type;
                    return (
                      <Pressable
                        key={item.type}
                        onPress={() => handleSelectIcon(item.type)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={item.label}
                        style={[S.gridCell, active && S.gridCellActive]}
                      >
                        {/* Nothing inside the cell changes on selection — no
                            colour, no size, no wrapper appearing. The tile's
                            own border and fill carry the whole state, so the
                            contents cannot shift. */}
                        <View style={S.cellIcon}>
                          <ChallengeIconSVG type={item.type} size={24} />
                        </View>
                        <AppText variant="caption" tone="secondary" numberOfLines={1}>
                          {item.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </Reveal>
      </View>
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

  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCell: {
    width: '31.5%',
    // A fixed height rather than `aspectRatio: 1`. Square cells were ~114pt
    // tall for a 24pt glyph, and that surplus is what made small glyphs look
    // top-heavy with the label stranded at the bottom of the tile.
    height: GRID_CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
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
  /**
   * Hugs the glyph at its own size, so the gap to the label is identical in
   * every cell. The old 40pt circle padded a 24pt glyph by 8pt a side and was
   * also what turned the selected icon white.
   */
  cellIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
