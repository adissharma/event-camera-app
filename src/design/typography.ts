/**
 * Semantic typography scale.
 *
 * Display: Instrument Serif (SIL OFL 1.1) — a refined transitional serif with
 * high-but-not-Didone contrast, slightly narrow proportions and elegant
 * ballpoint terminals. It ships in a single regular weight, which is the right
 * constraint on a near-black canvas: white type optically gains weight against
 * black (halation), so a bold serif reads blunt where a regular reads sharp.
 *
 * Text/UI: Instrument Sans (SIL OFL 1.1) — a neo-grotesque (NOT geometric) with
 * excellent legibility at 13–17pt, open apertures and tabular figures.
 *
 * These are siblings from one superfamily. That is the rationale for the
 * pairing — shared skeleton and rhythm — rather than the reflexive
 * elegant-serif-plus-any-sans pattern the brief rules out.
 *
 * The `eyebrow` role is the deliberate counterweight to the serif: wide-tracked
 * uppercase sans micro-labels. It is what makes the system read as editorial
 * rather than as the nearest competitor's centred-serif-on-black.
 *
 * Rules:
 * 1. Never use the display face for small labels or long body copy.
 * 2. Prices, counts and dates use `numeric` so figures align in columns.
 * 3. All sizes scale with Dynamic Type, capped per role.
 */

import type { TextStyle } from 'react-native';

export const fontFamilies = {
  display: 'InstrumentSerif_400Regular',
  /** Used sparingly — a single emphasised word, never a whole line. */
  displayItalic: 'InstrumentSerif_400Regular_Italic',
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
  | 'fontFamily'
  | 'fontSize'
  | 'lineHeight'
  | 'letterSpacing'
  | 'fontVariant'
  | 'textTransform'
>;

/** Tabular figures keep prices and counts from shifting as values change. */
const tabular: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

export const typography: Record<string, TypeStyle> = {
  /**
   * Reserved for the welcome and success moments. One per screen, maximum.
   * Leading is deliberately tighter than the type size would normally take —
   * a display serif set loose reads as a document, set tight it reads as a
   * masthead.
   */
  displayHero: {
    fontFamily: fontFamilies.display,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -0.4,
  },
  /** Step headings in the creation flow. */
  displayLarge: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -0.3,
  },
  /** Event names, guest cover titles. */
  titleLarge: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.2,
  },
  titleMedium: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    lineHeight: 27,
  },
  /**
   * Wide-tracked uppercase micro-label. Section markers, step counters,
   * category labels. Short strings only — uppercase at this tracking becomes
   * hard to read beyond about four words.
   */
  eyebrow: {
    fontFamily: fontFamilies.textMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
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
    fontSize: 16,
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
    fontFamily: fontFamilies.textMedium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  /** Prices, dates, counters, remaining-photo figures. */
  numeric: {
    fontFamily: fontFamilies.textMedium,
    fontSize: 15,
    lineHeight: 20,
    ...tabular,
  },
  /**
   * Large numeric moments — the remaining-shot counter, the price on a plan.
   * Set in the serif, which is where its old-style figures earn their keep.
   */
  numericLarge: {
    fontFamily: fontFamilies.display,
    fontSize: 34,
    lineHeight: 38,
    ...tabular,
  },
};

export type TypographyToken = keyof typeof typography;

/**
 * Upper bound on OS font scaling, applied per role.
 *
 * Display roles cap lower than body roles: at very large accessibility sizes a
 * 46pt display line wraps into an unusable wall, whereas body copy benefits
 * from the full range. Body and label roles are intentionally NOT capped below
 * 1.6 so the app stays usable at large accessibility sizes.
 */
export const maxFontScale: Record<string, number> = {
  displayHero: 1.4,
  displayLarge: 1.5,
  titleLarge: 1.6,
  titleMedium: 1.7,
  eyebrow: 1.6,
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
