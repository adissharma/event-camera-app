import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { ShaderCardBackground } from '@/components/ui/shader-card-background';
import { colours, radii, spacing } from '@/design';

/** Height of the guestbook selector tile (CHIP_D) */
const GUESTBOOK_TILE_HEIGHT = 60;

function PlusIcon({ size = 11, color = colours.textOnBrand }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export interface ChallengesEmptyCardProps {
  onPress: () => void;
  /** Whether the card is rendered alongside the guestbook chip */
  hasSiblingChip?: boolean;
  /** Match the responsive selector tile size used by the gallery row. */
  tileSize?: number;
  style?: StyleProp<ViewStyle>;
}

export const ChallengesEmptyCard = memo(function ChallengesEmptyCard({
  onPress,
  hasSiblingChip = false,
  tileSize = GUESTBOOK_TILE_HEIGHT,
  style,
}: ChallengesEmptyCardProps) {
  const { width: windowWidth } = useWindowDimensions();

  // Size to span the remaining width with identical 16px padding on all sides
  // Left padding (16) + Guestbook tile + Middle gap (16) + Card + Right padding (16) = windowWidth
  const cardWidth = hasSiblingChip
    ? windowWidth - (16 * 2) - 14 - tileSize
    : undefined;

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Add photo challenges"
      style={({ pressed }) => [
        S.wrapper,
        { height: tileSize },
        cardWidth ? { width: cardWidth } : { flex: 1, width: '100%' },
        pressed && S.pressed,
        style,
      ]}
    >
      <ShaderCardBackground style={[S.cardBackground, { height: tileSize }]} borderRadius={radii.lg}>
        <View style={S.row}>
          {/* Clean Text */}
          <View style={S.textContainer}>
            <AppText variant="labelLarge" style={S.title} numberOfLines={1}>
              Add photo challenges
            </AppText>
            <AppText variant="caption" style={S.subtitle} numberOfLines={1}>
              Give guests prompts to capture
            </AppText>
          </View>

          {/* Action CTA */}
          <View style={S.actionPill}>
            <PlusIcon />
            <AppText variant="labelSmall" style={S.actionText}>
              Add
            </AppText>
          </View>
        </View>
      </ShaderCardBackground>
    </Pressable>
  );
});

const S = StyleSheet.create({
  wrapper: {
    height: GUESTBOOK_TILE_HEIGHT,
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  cardBackground: {
    height: GUESTBOOK_TILE_HEIGHT,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.sm + 2,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  title: {
    color: colours.textPrimary,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  subtitle: {
    color: 'rgba(245, 242, 237, 0.65)',
    fontSize: 11,
    lineHeight: 14,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colours.brandPrimary,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  actionText: {
    color: colours.textOnBrand,
    fontWeight: '600',
    fontSize: 11,
  },
});
