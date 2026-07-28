/**
 * Semantic colour tokens — "Paper & Evergreen".
 *
 * Chosen after the reference and asset audit. See `docs/brand-system.md` for the
 * three directions that were considered and `docs/colour-accessibility.md` for
 * measured contrast ratios (all verified numerically, not estimated).
 *
 * Rules that bind consumers of this module:
 *
 * 1. Never import a raw hex value into a component. Import a semantic token.
 * 2. Never communicate selection, error, locked state or success through colour
 *    alone — always pair with an icon, text, weight or shape change.
 * 3. Photography supplies the colour in this product. Chrome recedes.
 *
 * Dark mode is not required for the MVP, but the shape of this module is a flat
 * semantic map so a second palette can be swapped in behind a theme provider
 * without touching a single component.
 */

export interface ColourPalette {
  /** App canvas. Warm paper, not clinical white and not beige. */
  background: string;
  /** Default card / sheet surface. */
  surface: string;
  /** Raised surface (sheets, popovers) — same fill, separated by shadow. */
  surfaceRaised: string;
  /** Recessed / inset fill for wells, disabled fields, skeletons. */
  surfaceMuted: string;

  textPrimary: string;
  textSecondary: string;
  /** Text drawn on top of `brandPrimary` / `brandPressed`. */
  textOnBrand: string;

  brandPrimary: string;
  brandPressed: string;
  /** Low-chroma brand tint for selected states and quiet emphasis. */
  brandSoft: string;

  /**
   * Reserved for genuinely celebratory moments only — publication success,
   * reveal unlock, Memory Book. Never for ordinary CTAs or decoration.
   * Contrast is 3.68:1, so it is valid for large text and UI shapes but MUST
   * NOT be used for body-size text.
   */
  accentWarm: string;

  /** Decorative hairlines and dividers. Not a control boundary. */
  borderSubtle: string;
  /** Control boundaries (inputs, option cards). Meets 3:1 non-text contrast. */
  borderStrong: string;
  /** Focus indicator. Meets 3:1 against the canvas. */
  focusRing: string;

  success: string;
  warning: string;
  error: string;

  /** Scrim beneath modals and sheets. */
  scrim: string;
  /** Overlay wash for legible text on light photography. */
  overlayLight: string;
  /** Overlay wash for legible text on dark photography. */
  overlayDark: string;
}

export const colours: ColourPalette = {
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#F1ECE3',

  textPrimary: '#1B1A17',
  textSecondary: '#6A635A',
  textOnBrand: '#F7FBF8',

  brandPrimary: '#1F5148',
  brandPressed: '#163A34',
  brandSoft: '#E3EDE9',

  accentWarm: '#B4712C',

  borderSubtle: '#E6DFD4',
  borderStrong: '#8F8474',
  focusRing: '#1F5148',

  success: '#256B4E',
  warning: '#8A5512',
  error: '#B3261E',

  scrim: 'rgba(27, 26, 23, 0.48)',
  overlayLight: 'rgba(250, 247, 242, 0.82)',
  overlayDark: 'rgba(20, 19, 17, 0.55)',
};

/**
 * Elevation is expressed as shadow, never as a different surface fill, so that
 * raised surfaces keep the same contrast relationship with their text.
 */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  low: {
    shadowColor: '#1B1A17',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  medium: {
    shadowColor: '#1B1A17',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  high: {
    shadowColor: '#1B1A17',
    shadowOpacity: 0.16,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const;

export type ElevationToken = keyof typeof elevation;
