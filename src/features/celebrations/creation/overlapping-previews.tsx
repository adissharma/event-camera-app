import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { ColorMatrix, type Matrix as NativeMatrix } from 'react-native-color-matrix-image-filters';

import { DisposablePhoto } from '@/components/media/disposable-photo';
import { PremiumImage } from '@/components/media/premium-image';
import { getVisualAsset, type VisualAssetKey } from '@/config/visual-assets';
import { TREATMENT_VISUALS, normalisePhotoTreatment } from '@/features/media/photo-treatment';
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

  const resolved = normalisePhotoTreatment(treatment);

  /**
   * All three renderers stay mounted. Swapping between PremiumImage, a native
   * colour-matrix tree and a Skia canvas made the selected image disappear for
   * a frame while the new renderer decoded its source. Keeping them warm and
   * changing only opacity makes treatment changes atomic and flicker-free.
   *
   * Disposable still uses the same component as the real gallery, while the
   * other treatments retain PremiumImage's focal-point-aware crop.
   */
  function card(assetKey: VisualAssetKey, seedKey: string) {
    const { source } = getVisualAsset(assetKey);
    if (!source) return null;

    const originalVisible = resolved === 'original';
    const monochromeVisible = resolved === 'black_and_white';
    const disposableVisible = resolved === 'disposable';

    return (
      <View style={styles.image}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden={!originalVisible}
          importantForAccessibility={originalVisible ? 'auto' : 'no-hide-descendants'}
          style={[styles.layer, originalVisible ? styles.visible : styles.hidden]}
        >
          <PremiumImage
            assetKey={assetKey}
            aspectRatio={9 / 16}
            radius="lg"
            transitionMs={0}
            style={styles.image}
          />
        </View>

        <View
          pointerEvents="none"
          accessibilityElementsHidden={!monochromeVisible}
          importantForAccessibility={monochromeVisible ? 'auto' : 'no-hide-descendants'}
          style={[styles.layer, monochromeVisible ? styles.visible : styles.hidden]}
        >
          <ColorMatrix
            matrix={TREATMENT_VISUALS.black_and_white.colorMatrix as unknown as NativeMatrix}
            style={styles.image}
          >
            <PremiumImage
              assetKey={assetKey}
              aspectRatio={9 / 16}
              radius="lg"
              transitionMs={0}
              style={styles.image}
            />
          </ColorMatrix>
        </View>

        <View
          pointerEvents="none"
          accessibilityElementsHidden={!disposableVisible}
          importantForAccessibility={disposableVisible ? 'auto' : 'no-hide-descendants'}
          style={[styles.layer, disposableVisible ? styles.visible : styles.hidden]}
        >
          <DisposablePhoto
            source={source}
            seedKey={seedKey}
            dateStampEnabled
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      {/* Left Card: Hindu Wedding */}
      <Animated.View
        style={[styles.card, leftCardStyle, { width: cardWidth, height: cardHeight, zIndex: 1 }]}
      >
        {card('hindu_wedding', 'preview-hindu')}
      </Animated.View>

      {/* Right Card: Christian Wedding */}
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
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  visible: {
    opacity: 1,
  },
  hidden: {
    opacity: 0,
  },
});
