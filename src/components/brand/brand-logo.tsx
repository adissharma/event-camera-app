import { Image } from 'expo-image';
import { View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { BRAND_ASSETS, BRAND_CONFIG } from '@/config/brand';
import { colours, layout, radii, spacing } from '@/design';
import type { MediaBoxStyle } from '@/types/style';

export interface BrandLogoProps {
  /** `primary` on light surfaces, `light` on imagery, `mark` where space is tight. */
  variant?: 'primary' | 'light' | 'mark';
  /** Rendered height in points. Width follows the asset's own proportions. */
  height?: number;
  style?: MediaBoxStyle;
}

/**
 * The single place the brand mark is rendered.
 *
 * Guarantees, so that replacing the logo never requires a screen-level edit:
 *
 * - Aspect ratio is preserved. The logo is never stretched or skewed.
 * - No shadow, outline or recolouring is applied.
 * - A variant that was not supplied falls back to the primary asset rather than
 *   being invented — an inverted or cropped mark is a design decision for the
 *   person who made the logo, not for this component.
 * - With no asset at all, an accessible, clearly-labelled text lockup is shown.
 *   A fabricated final logo is never rendered.
 */
export function BrandLogo({ variant = 'primary', height = 28, style }: BrandLogoProps) {
  const source =
    (variant === 'light' ? BRAND_ASSETS.logoLight : undefined) ??
    (variant === 'mark' ? BRAND_ASSETS.logoMark : undefined) ??
    BRAND_ASSETS.logoPrimary;

  if (source === undefined) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${BRAND_CONFIG.appName} — placeholder logo`}
        style={[
          {
            height,
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
            borderRadius: radii.sm,
            borderWidth: layout.hairline,
            borderStyle: 'dashed',
            borderColor: variant === 'light' ? colours.overlayLight : colours.borderStrong,
            alignSelf: 'flex-start',
          },
          style,
        ]}
      >
        <AppText
          variant="labelLarge"
          tone={variant === 'light' ? 'onBrand' : 'primary'}
          style={{ letterSpacing: 0.5 }}
        >
          {BRAND_CONFIG.shortName}
        </AppText>
      </View>
    );
  }

  return (
    <Image
      accessible
      accessibilityRole="image"
      accessibilityLabel={BRAND_CONFIG.appName}
      source={source}
      contentFit="contain"
      style={[{ height, aspectRatio: undefined, width: undefined }, style]}
    />
  );
}
