/**
 * Semantic typography scale.
 *
 * Display: Fraunces (SIL OFL 1.1) — a soft, low-contrast old-style with genuine
 * warmth and a beautiful ampersand. Chosen over the obvious "elegant serif"
 * options because it reads considered rather than default, and because it sits
 * at the opposite end of the serif spectrum from the high-contrast Didone the
 * nearest competitor uses. See `docs/typography.md`.
 *
 * Text/UI: Instrument Sans (SIL OFL 1.1) — a neo-grotesque (NOT geometric) with
 * excellent legibility at 14–18pt, open apertures and tabular figures.
 *
 * Rules:
 * 1. Never use the display face for small labels or long body copy.
 * 2. Prices, counts and dates use `numeric` so figures align in columns.
 * 3. All sizes scale with Dynamic Type — see `useScaledTypography`.
 */

import type { TextStyle } from 'react-native';

export const fontFamilies = {
  displayRegular: 'Fraunces_400Regular',
  displayMedium: 'Fraunces_500Medium',
  displaySemiBold: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  textRegular: 'InstrumentSans_400Regular',
  textMedium: 'InstrumentSans_500Medium',
  textSemiBold: 'InstrumentSans_600SemiBold',
  textBold: 'InstrumentSans_700Bold',
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;

/**
 * Fallbacks used before fonts load and on any platform where the embedded file
 * is unavailable. Keeping these explicit avoids a flash of an unrelated face.
 */
export const fontFallbacks = {
  display: 'serif',
  text: 'System',
} as const;

type TypeStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'fontVariant'
>;

/** Tabular figures keep prices and counts from shifting as values change. */
const tabular: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

export const typography: Record<string, TypeStyle> = {
  /** Reserved for the welcome and success moments. One per screen, maximum. */
  displayHero: {
    fontFamily: fontFamilies.displaySemiBold,
    // 40/44 rather than 44/48: measured on a 375pt screen, 44pt pushed a
    // five-word statement to three lines and crowded the primary action.
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  /** Step headings in the creation flow. */
  displayLarge: {
    fontFamily: fontFamilies.displaySemiBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  /** Event names, guest cover titles. */
  titleLarge: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  titleMedium: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
  /** Section headings inside a screen. Text face — not display. */
  heading: {
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  bodyLarge: {
    fontFamily: fontFamilies.textRegular,
    fontSize: 17,
    lineHeight: 25,
  },
  body: {
    fontFamily: fontFamilies.textRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: fontFamilies.textRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  labelLarge: {
    fontFamily: fontFamilies.textMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  /** Visible field labels. Never placeholder-only. */
  label: {
    fontFamily: fontFamilies.textMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  caption: {
    fontFamily: fontFamilies.textRegular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  button: {
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
  },
  /** Prices, dates, counters, remaining-photo figures. */
  numeric: {
    fontFamily: fontFamilies.textMedium,
    fontSize: 15,
    lineHeight: 20,
    ...tabular,
  },
  /** Large numeric moments — the remaining-shot counter, the price on a plan. */
  numericLarge: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
    ...tabular,
  },
};

export type TypographyToken = keyof typeof typography;

/**
 * Upper bound on OS font scaling, applied per role.
 *
 * Display roles are capped lower than body roles: at very large accessibility
 * sizes a 44pt display line wraps into an unusable wall, whereas body copy
 * benefits from the full range. Body and label roles are intentionally NOT
 * capped below 1.6 so the app stays usable at large accessibility sizes.
 */
export const maxFontScale: Record<string, number> = {
  displayHero: 1.4,
  displayLarge: 1.5,
  titleLarge: 1.6,
  titleMedium: 1.7,
  heading: 1.8,
  bodyLarge: 2,
  body: 2,
  bodySmall: 2,
  labelLarge: 2,
  label: 2,
  caption: 2,
  button: 1.8,
  numeric: 1.8,
  numericLarge: 1.5,
};
