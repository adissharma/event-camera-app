import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colours, maxFontScale, typography, type TypographyToken } from '@/design';

export interface AppTextProps extends RNTextProps {
  /** Semantic role. Drives family, size, leading and font-scale cap. */
  variant?: TypographyToken;
  /** Semantic colour. Defaults to `textPrimary`. */
  tone?: 'primary' | 'secondary' | 'onBrand' | 'brand' | 'error' | 'success' | 'warning';
  align?: TextStyle['textAlign'];
}

const toneToColour: Record<NonNullable<AppTextProps['tone']>, string> = {
  primary: colours.textPrimary,
  secondary: colours.textSecondary,
  onBrand: colours.textOnBrand,
  brand: colours.brandPrimary,
  error: colours.error,
  success: colours.success,
  warning: colours.warning,
};

/**
 * The only text primitive in the app.
 *
 * Components never set `fontFamily`, `fontSize` or a raw colour directly — they
 * pick a semantic variant and tone. This is what keeps the type system from
 * drifting into competing visual systems.
 *
 * Each variant carries its own `maxFontSizeMultiplier` so Dynamic Type scales
 * body copy generously while preventing display sizes from wrapping into an
 * unreadable wall at the largest accessibility settings.
 */
export const AppText = forwardRef<RNText, AppTextProps>(function AppText(
  { variant = 'body', tone = 'primary', align, style, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontScale[variant] ?? 2}
      style={[typography[variant], { color: toneToColour[tone] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
});
