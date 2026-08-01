import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/text';
import { PremiumImage } from '@/components/media/premium-image';
import { colours, spacing, radii } from '@/design';
import type { PhotoTreatment } from '@/types/database';

export interface OverlappingPreviewsProps {
  treatment: PhotoTreatment;
}

export function OverlappingPreviews({ treatment }: OverlappingPreviewsProps) {
  const { height: screenHeight } = useWindowDimensions();

  // Responsive sizing based on device screen height
  let cardHeight = 250;
  let overlapMargin = -60;
  let animTravel = 26;

  if (screenHeight < 740) {
    cardHeight = 200;
    overlapMargin = -50;
    animTravel = 20;
  } else if (screenHeight > 850) {
    cardHeight = 310;
    overlapMargin = -85;
    animTravel = 34;
  }

  const cardWidth = Math.round(cardHeight * (9 / 16));
  const containerHeight = cardHeight + 30;

  // Shared values for the slide out bounce animation
  const animValue = useSharedValue(0);

  useEffect(() => {
    // Animate from 0 to 1 with spring physics for a nice bounce on mount
    animValue.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 90 }));
  }, [animValue]);

  // Hindu Wedding (Left Card) Animated Styles
  const leftCardStyle = useAnimatedStyle(() => {
    const translateX = -animTravel * animValue.value;
    const rotate = `${-5 * animValue.value}deg`;
    return {
      transform: [{ translateX }, { rotate }],
    };
  });

  // Christian Wedding (Right Card, Overlapping) Animated Styles
  const rightCardStyle = useAnimatedStyle(() => {
    const translateX = animTravel * animValue.value;
    const rotate = `${5 * animValue.value}deg`;
    return {
      transform: [{ translateX }, { rotate }],
    };
  });

  // Format a realistic retro date stamp using the current year (e.g. '26  07  29)
  const now = new Date();
  const YY = String(now.getFullYear()).slice(-2);
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const dateString = `'${YY}  ${MM}  ${DD}`;

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      {/* Left Card: Hindu Wedding */}
      <Animated.View style={[styles.card, leftCardStyle, { width: cardWidth, height: cardHeight, zIndex: 1 }]}>
        <PremiumImage
          assetKey="hindu_wedding"
          aspectRatio={9 / 16}
          radius="lg"
          style={styles.image}
        />
        {/* Filters */}
        {treatment === 'black_and_white' && (
          <View style={[StyleSheet.absoluteFill, styles.filterBW]} />
        )}
        {treatment === 'warm_film' && (
          <View style={[StyleSheet.absoluteFill, styles.filterWarm]} />
        )}
        {treatment === 'disposable' && (
          <View style={[StyleSheet.absoluteFill, styles.filterDisposable]} />
        )}
        {treatment === 'disposable' && (
          <View style={styles.dateStampContainer}>
            <AppText style={styles.dateStampText}>{dateString}</AppText>
          </View>
        )}
      </Animated.View>

      {/* Right Card: Christian Wedding */}
      <Animated.View style={[styles.card, rightCardStyle, { width: cardWidth, height: cardHeight, zIndex: 2, marginLeft: overlapMargin }]}>
        <PremiumImage
          assetKey="christian_wedding"
          aspectRatio={9 / 16}
          radius="lg"
          style={styles.image}
        />
        {/* Filters */}
        {treatment === 'black_and_white' && (
          <View style={[StyleSheet.absoluteFill, styles.filterBW]} />
        )}
        {treatment === 'warm_film' && (
          <View style={[StyleSheet.absoluteFill, styles.filterWarm]} />
        )}
        {treatment === 'disposable' && (
          <View style={[StyleSheet.absoluteFill, styles.filterDisposable]} />
        )}
        {treatment === 'disposable' && (
          <View style={styles.dateStampContainer}>
            <AppText style={styles.dateStampText}>{dateString}</AppText>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.xs,
  },
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colours.surface,
    borderWidth: 1.5,
    borderColor: colours.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  filterBW: {
    backgroundColor: 'rgba(128, 128, 128, 0.95)',
    mixBlendMode: 'color',
  },
  filterWarm: {
    backgroundColor: 'rgba(255, 160, 0, 0.16)',
    mixBlendMode: 'multiply',
  },
  filterDisposable: {
    backgroundColor: 'rgba(255, 230, 200, 0.05)',
    mixBlendMode: 'overlay',
  },
  dateStampContainer: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  dateStampText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#ff7300',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
});
