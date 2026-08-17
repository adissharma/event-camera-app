import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ShaderCardBackground } from '@/components/ui/shader-card-background';
import { colours, layout, radii, spacing } from '@/design';

function ChallengesGlyph({ size = 26, color = '#F5D6A0' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChallengesEmptyState({ onPress }: { onPress: () => void }) {
  return (
    <ShaderCardBackground style={S.card} borderRadius={radii.xl}>
      <View style={S.badge}>
        <ChallengesGlyph />
      </View>

      <AppText variant="titleMedium" style={S.title}>
        Add photo challenges
      </AppText>
      <AppText variant="bodySmall" style={S.body} align="center">
        Give your guests fun moments and prompts to capture throughout your event.
      </AppText>

      <Button
        label="Add challenges"
        size="medium"
        onPress={onPress}
        style={S.cta}
        haptic
      />
    </ShaderCardBackground>
  );
}

const S = StyleSheet.create({
  card: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 214, 160, 0.12)',
    borderColor: 'rgba(245, 214, 160, 0.25)',
    borderWidth: layout.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  title: {
    color: colours.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    maxWidth: 280,
    color: 'rgba(245, 242, 237, 0.72)',
    marginBottom: spacing.xs,
  },
  cta: {
    minWidth: 190,
  },
});
