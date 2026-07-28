import { useState } from 'react';
import { View } from 'react-native';
import { Image, type ImageContentPosition } from 'expo-image';

import { colours, radii } from '@/design';
import type { MediaBoxStyle } from '@/types/style';
import { getVisualAsset, type VisualAssetKey } from '@/config/visual-assets';
import { VisualPlaceholder } from './visual-placeholder';

export interface PremiumImageProps {
  /** Manifest key. Supplies aspect ratio, focal point and accessibility label. */
  assetKey?: VisualAssetKey;
  /** A host-supplied image (cover upload) that is not in the manifest. */
  uri?: string;
  /** Overrides the manifest label. Required when using `uri`. */
  accessibilityLabel?: string;
  aspectRatio?: number;
  focalPoint?: { x: number; y: number };
  radius?: keyof typeof radii;
  style?: MediaBoxStyle;
  /** Crossfade duration. Keep short — this is a micro-interaction. */
  transitionMs?: number;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Photography primitive.
 *
 * Three things it does that a bare `Image` does not:
 *
 * 1. **Reserves the box before loading**, so nothing reflows when the image
 *    arrives.
 * 2. **Honours a focal point** — crops bias toward the subject instead of the
 *    geometric centre, which is what causes careless face crops.
 * 3. **Falls back to a labelled placeholder** rather than an empty grey box when
 *    no source exists or the load fails.
 */
export function PremiumImage({
  assetKey,
  uri,
  accessibilityLabel,
  aspectRatio,
  focalPoint,
  radius = 'lg',
  style,
  transitionMs = 220,
  priority = 'normal',
}: PremiumImageProps) {
  const [failed, setFailed] = useState(false);
  const asset = assetKey ? getVisualAsset(assetKey) : undefined;

  const source = uri ?? asset?.source;
  const ratio = aspectRatio ?? asset?.aspectRatio ?? 3 / 4;
  const point = focalPoint ?? asset?.focalPoint ?? { x: 0.5, y: 0.5 };
  const label = accessibilityLabel ?? asset?.accessibilityLabel ?? 'Photograph';

  // No source, or the source failed — show the placeholder at the same size.
  if (!source || failed) {
    return assetKey ? (
      <VisualPlaceholder assetKey={assetKey} aspectRatio={ratio} radius={radius} style={style} />
    ) : (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label}. Image unavailable.`}
        style={[
          {
            aspectRatio: ratio,
            width: '100%',
            backgroundColor: colours.surfaceMuted,
            borderRadius: radii[radius],
          },
          style,
        ]}
      />
    );
  }

  // expo-image expresses focal point as a content position in percentages.
  const contentPosition: ImageContentPosition = {
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
  };

  return (
    <Image
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      source={source}
      contentFit="cover"
      contentPosition={contentPosition}
      transition={transitionMs}
      priority={priority}
      onError={() => setFailed(true)}
      // A paper-toned placeholder while decoding reads as premium; a grey box
      // reads as broken.
      placeholderContentFit="cover"
      style={[
        {
          aspectRatio: ratio,
          width: '100%',
          borderRadius: radii[radius],
          backgroundColor: colours.surfaceMuted,
        },
        style,
      ]}
    />
  );
}
