import { forwardRef } from 'react';
import { Platform, StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colours, fitDisplayFace, fontFamilies, maxFontScale, typography, type TypographyToken } from '@/design';

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
/**
 * Gives display-face text its parent's full width on Android.
 *
 * Android sizes shrink-wrapped text (a title in an `alignItems: 'center'` or
 * `'flex-start'` column) to its measured one-line width, then draws the display
 * face a hair wider than that. A title that only just fits on one line is
 * drawn as two, and its last word falls into a line the layout never made room
 * for: "Robin's birthday" showed as "Robin's" on both the package screen and
 * the event page. Stretching leaves the drawn line its slack; `textAlign`
 * still places the words, so nothing moves. An explicit `alignSelf` wins.
 */
function fitAndroidWidth(style: TextStyle): TextStyle {
  if (Platform.OS !== 'android') return style;
  if (style.fontFamily !== fontFamilies.display || style.alignSelf != null) return style;
  return { ...style, alignSelf: 'stretch' };
}

export const AppText = forwardRef<RNText, AppTextProps>(function AppText(
  { variant = 'body', tone = 'primary', align, style, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontScale[variant] ?? 2}
      // Flattened so the display-face correction sees the final family, size
      // and leading, whichever of the variant or the override supplied them.
      style={fitAndroidWidth(
        fitDisplayFace(
          StyleSheet.flatten([
            typography[variant],
            { color: toneToColour[tone] },
            align ? { textAlign: align } : null,
            style,
          ]),
        ),
      )}
      {...rest}
    />
  );
});
