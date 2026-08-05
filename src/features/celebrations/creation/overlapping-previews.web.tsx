import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { DisposablePhoto } from '@/components/media/disposable-photo';
import { PremiumImage } from '@/components/media/premium-image';
import { getVisualAsset, type VisualAssetKey } from '@/config/visual-assets';
import { TREATMENT_VISUALS, normalisePhotoTreatment } from '@/features/media/photo-treatment';
import { colours, spacing, radii } from '@/design';
import type { PhotoTreatment } from '@/types/database';

export interface OverlappingPreviewsProps {
  treatment: PhotoTreatment;
}

/**
 * Web sibling of `overlapping-previews.tsx` — same reason `treated-photo.tsx`
 * has one: the default file imports `react-native-color-matrix-image-filters`
 * directly, a native-only package that throws Metro's web bundler the moment
 * it's reachable, regardless of whether `<ColorMatrix>` is ever actually
 * rendered. `black_and_white` is reproduced with a CSS `filter` on a
 * wrapping `View` instead, which cascades to the image the same way the
 * native colour matrix does visually.
 */
export function OverlappingPreviews({ treatment }: OverlappingPreviewsProps) {
  const { height: screenHeight } = useWindowDimensions();

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

  const animValue = useSharedValue(0);

  useEffect(() => {
    animValue.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 90 }));
  }, [animValue]);

  const leftCardStyle = useAnimatedStyle(() => {
    const translateX = -animTravel * animValue.value;
    const rotate = `${-5 * animValue.value}deg`;
    return {
      transform: [{ translateX }, { rotate }],
    };
  });

  const rightCardStyle = useAnimatedStyle(() => {
    const translateX = animTravel * animValue.value;
    const rotate = `${5 * animValue.value}deg`;
    return {
      transform: [{ translateX }, { rotate }],
    };
  });

  const resolved = normalisePhotoTreatment(treatment);
  const visual = TREATMENT_VISUALS[resolved];

  function card(assetKey: VisualAssetKey, seedKey: string) {
    if (resolved === 'disposable') {
      const { source } = getVisualAsset(assetKey);
      if (!source) return null;
      return (
        <DisposablePhoto
          source={source}
          seedKey={seedKey}
          dateStampEnabled
          style={styles.image}
          resizeMode="cover"
        />
      );
    }

    const image = (
      <PremiumImage assetKey={assetKey} aspectRatio={9 / 16} radius="lg" style={styles.image} />
    );

    return visual.colorMatrix ? (
      // `filter` is a react-native-web-only style extension that passes
      // straight through to the DOM node and cascades to the image inside
      // it; RN's `ViewStyle` type doesn't know about it, hence the loose cast.
      <View style={[styles.image, { filter: 'grayscale(1)' }] as any}>{image}</View>
    ) : (
      image
    );
  }

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <Animated.View
        style={[styles.card, leftCardStyle, { width: cardWidth, height: cardHeight, zIndex: 1 }]}
      >
        {card('hindu_wedding', 'preview-hindu')}
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          rightCardStyle,
          { width: cardWidth, height: cardHeight, zIndex: 2, marginLeft: overlapMargin },
        ]}
      >
        {card('christian_wedding', 'preview-christian')}
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
});
