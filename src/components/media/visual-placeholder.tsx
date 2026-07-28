import { View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import type { MediaBoxStyle } from '@/types/style';
import { getVisualAsset, type VisualAssetKey } from '@/config/visual-assets';

export interface VisualPlaceholderProps {
  assetKey: VisualAssetKey;
  /** Overrides the manifest aspect ratio when a screen needs a specific crop. */
  aspectRatio?: number;
  /**
   * Fills the parent instead of holding an aspect ratio. Use for edge-to-edge
   * heroes, where the parent's flex box — not the image proportions — decides
   * the height. Without this the manifest ratio wins and the placeholder
   * overflows its parent.
   */
  fill?: boolean;
  radius?: keyof typeof radii;
  style?: MediaBoxStyle;
  /** Shows the art-direction brief. Development aid, off in production builds. */
  showBrief?: boolean;
}

/**
 * Stands in for photography that has not been supplied yet.
 *
 * It reserves the exact box the real image will occupy, so replacing a
 * placeholder with a photograph never shifts the layout. It is visibly a
 * placeholder — a quiet paper-toned panel with the asset key — because a
 * convincing fake would let unsourced imagery reach production unnoticed.
 */
export function VisualPlaceholder({
  assetKey,
  aspectRatio,
  fill = false,
  radius = 'lg',
  style,
  showBrief = false,
}: VisualPlaceholderProps) {
  const asset = getVisualAsset(assetKey);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${asset.accessibilityLabel}. Placeholder image, not yet supplied.`}
      style={[
        fill
          ? { flex: 1, alignSelf: 'stretch' }
          : { aspectRatio: aspectRatio ?? asset.aspectRatio, width: '100%' },
        {
          backgroundColor: colours.surfaceMuted,
          borderRadius: radii[radius],
          borderWidth: layout.hairline,
          borderColor: colours.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.xs,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <AppText variant="eyebrow" tone="secondary" align="center">
        Image placeholder
      </AppText>
      <AppText variant="caption" tone="secondary" align="center">
        {assetKey}
      </AppText>
      {showBrief ? (
        <AppText variant="caption" tone="secondary" align="center" numberOfLines={4}>
          {asset.artDirection}
        </AppText>
      ) : null}
    </View>
  );
}
