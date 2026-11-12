import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { colours, spacing, useMotion } from '@/design';
import { ChallengeIconSVG } from '@/features/celebrations/challenge-icons';

/**
 * The host's empty state for the event page's challenge strip.
 *
 * The strip is a row of round tiles, one per challenge. With none added, it
 * shows what the row will become: a few faded example tiles, drawn exactly
 * like real ones, then a dashed tile with a plus where the first real one
 * goes. A line underneath says what they are. Every part opens the same
 * flow, so wherever the host taps, they get there.
 *
 * The examples breathe slowly, out of step with each other. That separates
 * them from a locked tile, which is dimmed but still, and it draws the eye
 * without anything bouncing. Reduce Motion holds them still.
 */
export const EMPTY_STRIP_EXAMPLES = ['🥹', '🥂', '💃'] as const;

const GHOST_LOW = 0.22;
const GHOST_HIGH = 0.4;
const BREATH_MS = 2200;

function PlusIcon({ size = 20, color = colours.textOnBrand }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function tap(onPress: () => void) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  onPress();
}

/** One faded example tile. `renderTile` draws the real tile shell around it. */
export function ChallengeGhostTile({
  emoji,
  order,
  size,
  onPress,
  renderTile,
}: {
  emoji: string;
  /** Position among the examples; offsets the breathing so they don't pulse together. */
  order: number;
  size: number;
  onPress: () => void;
  renderTile: (children: ReactNode) => ReactNode;
}) {
  const { reduceMotion } = useMotion();
  const opacity = useSharedValue(GHOST_HIGH - order * 0.06);

  useEffect(() => {
    if (reduceMotion) return;
    const high = GHOST_HIGH - order * 0.06;
    opacity.value = withDelay(
      order * 500,
      withRepeat(
        withSequence(
          withTiming(GHOST_LOW, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
          withTiming(high, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, order, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Pressable
      onPress={() => tap(onPress)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[S.tile, { width: size }]}
    >
      <Animated.View style={style}>
        {renderTile(<ChallengeIconSVG type={emoji} size={22} />)}
      </Animated.View>
    </Pressable>
  );
}

/** The dashed slot where the host's first challenge will go. */
export function ChallengeAddTile({
  size,
  onPress,
  badge,
}: {
  size: number;
  onPress: () => void;
  /** Drawn over the tile, e.g. a padlock when challenges need an upgrade. */
  badge?: ReactNode;
}) {
  return (
    <Pressable
      onPress={() => tap(onPress)}
      accessibilityRole="button"
      accessibilityLabel="Add photo challenges"
      accessibilityHint="Prompts for guests to capture during your event"
      style={({ pressed }) => [S.tile, { width: size }, pressed && S.pressed]}
    >
      <View style={[S.slot, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={S.plus}>
          <PlusIcon />
        </View>
      </View>
      {badge}
    </Pressable>
  );
}

/** The line under the strip that says what the empty tiles are for. */
export function ChallengesEmptyCaption({
  onPress,
  onDismiss,
}: {
  onPress: () => void;
  /** Hides the examples and this line for good, leaving just the add tile. */
  onDismiss: () => void;
}) {
  return (
    <View style={S.captionRow}>
      <Pressable
        onPress={() => tap(onPress)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={S.caption}
      >
        <AppText variant="labelLarge" align="center" style={S.captionTitle}>
          Add photo challenges
        </AppText>
        <AppText variant="caption" tone="secondary" align="center">
          Little moments for guests to look out for
        </AppText>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Hide challenge suggestions"
        style={({ pressed }) => [S.dismiss, pressed && S.pressed]}
      >
        <CloseIcon />
      </Pressable>
    </View>
  );
}

function CloseIcon({ size = 12, color = 'rgba(245, 242, 237, 0.7)' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Whether the host has closed the suggestions on this event.
 *
 * Per event and per device: a host who closes it for one event may still
 * want the nudge on their next one. Until the stored answer arrives it counts
 * as closed, so the suggestions never flash up and then vanish.
 */
export function useChallengesEmptyDismissed(celebrationId: string) {
  const key = `__challenges_empty_dismissed:${celebrationId}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((value) => {
        if (alive) setDismissed(value === '1');
      })
      .catch(() => {
        if (alive) setDismissed(false);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    AsyncStorage.setItem(key, '1').catch(() => {});
  }, [key]);

  return [dismissed, dismiss] as const;
}

const S = StyleSheet.create({
  tile: {
    alignItems: 'center',
    overflow: 'visible',
  },
  pressed: {
    opacity: 0.75,
  },
  slot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(239, 233, 224, 0.55)',
    backgroundColor: 'rgba(239, 233, 224, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colours.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionRow: {
    marginTop: -spacing.xxs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  caption: {
    alignItems: 'center',
    gap: 2,
  },
  dismiss: {
    position: 'absolute',
    right: spacing.base,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionTitle: {
    color: colours.textPrimary,
  },
});
