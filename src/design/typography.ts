/**
 * Semantic typography scale.
 *
 * Display: Isolde Regular (Franko Luin, Omnibus Typografi) — the editorial
 * serif used for event names, cover titles and the app's larger moments.
 * Bundled from `assets/fonts/Isolde-Regular.ttf`. Covers Latin-1 in full,
 * accents included; only £ is missing and falls back to the system face.
 *
 * Text/UI: Instrument Sans (SIL OFL 1.1) — a neo-grotesque (NOT geometric) with
 * excellent legibility at 13–17pt, open apertures and tabular figures.
 *
 * The serif gives the product its editorial voice, while Instrument Sans keeps
 * controls, labels and dense UI readable.
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
  display: 'Isolde_400Regular',
  /** Isolde's true italic, from `assets/fonts/Isolde-Italic.ttf`. For short
   *  attributions — a name, never a sentence. */
  displayItalic: 'Isolde_400Italic',
  /**
   * Cormorant Garamond Medium Italic (SIL OFL 1.1), for figures that should
   * read as set rather than printed — the event page's stat numbers. Its
   * old-style italic numerals are the point; never use it for words.
   */
  numeralItalic: 'CormorantGaramond_500Medium_Italic',
  /**
   * The platform's own UI face — SF Pro on iOS, Roboto on Android, the
   * browser's system-ui on web. For small, neutral captions that should read
   * as part of the device rather than the brand (the stat strip's labels).
   */
  system: 'System',
  textRegular: 'InstrumentSans_400Regular',
  textMedium: 'InstrumentSans_500Medium',
  textSemiBold: 'InstrumentSans_600SemiBold',
  textBold: 'InstrumentSans_700Bold',
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;

/**
 * How much smaller the display face is set than the sizes written in this file.
 *
 * Every display size and leading in the app was tuned for Cormorant Garamond,
 * whose capitals stand at 0.625 em. Isolde's stand at 0.609 em, so it is set
 * very slightly larger to match. Scaling by the ratio of the two cap heights
 * keeps the designed sizes meaning what they were designed to mean, whichever
 * face is in use. Raise it for a bigger display face, lower it for a smaller.
 */
export const DISPLAY_OPTICAL_SCALE = 625 / 609;

/**
 * The tightest leading the display face can be set at without iOS clipping it.
 *
 * iOS anchors the baseline a descent's height above the bottom of the line.
 * Isolde declares a 0.28 em descent and its tallest ink (the accent on É)
 * reaches 0.82 em, so below about 1.12 em accents are cut off; 1.15 leaves a
 * little margin.
 */
const DISPLAY_MIN_LEADING = 1.15;

/**
 * A style set in the display face, corrected for Isolde.
 *
 * Applied centrally by `AppText`, so screens keep writing the sizes they
 * always have. Anything that bypasses `AppText` (the welcome screen's
 * animated text) runs its display styles through this directly.
 */
export function fitDisplayFace<T extends TextStyle>(style: T): T {
  if (style.fontFamily !== fontFamilies.display || typeof style.fontSize !== 'number') {
    return style;
  }
  const fontSize = Math.round(style.fontSize * DISPLAY_OPTICAL_SCALE * 2) / 2;
  const lineHeight = Math.ceil(
    Math.max(
      typeof style.lineHeight === 'number' ? style.lineHeight * DISPLAY_OPTICAL_SCALE : 0,
      fontSize * DISPLAY_MIN_LEADING,
    ),
  );
  return {
    ...style,
    fontSize,
    lineHeight,
    ...(typeof style.letterSpacing === 'number'
      ? { letterSpacing: style.letterSpacing * DISPLAY_OPTICAL_SCALE }
      : null),
  };
}

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
