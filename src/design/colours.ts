/**
 * Semantic colour tokens — "Ink & Ivory".
 *
 * A near-black canvas with warm off-white type. See `docs/brand-system.md` for
 * the directions considered and `docs/colour-accessibility.md` for measured
 * contrast ratios (verified numerically, enforced by `npm run check:contrast`).
 *
 * Two decisions that keep this from being a generic dark theme:
 *
 * 1. **Nothing is pure.** The canvas is `#0B0B0C`, not `#000000`, and the type
 *    is `#F5F2ED`, not `#FFFFFF`. Pure black next to pure white glares, crushes
 *    photographic shadows, and smears on OLED during scroll. A hair of warmth in
 *    both is most of what separates elegant from stark.
 * 2. **The primary action is ivory, not a colour.** A saturated accent button on
 *    black is the generic dark-SaaS move. An ivory fill with ink text is quieter
 *    and reads as considered.
 *
 * Rules that bind consumers of this module:
 *
 * - Never import a raw hex value into a component. Import a semantic token.
 * - Never communicate selection, error, locked state or success through colour
 *   alone — always pair with an icon, text, weight or shape change.
 * - Photography supplies the colour in this product. Chrome recedes.
 *
 * The light palette this replaced is preserved in git history and remains a
 * valid second theme; every component reads semantic tokens, so reintroducing
 * it is a provider change, not a screen change.
 */

export interface ColourPalette {
  /** App canvas. Near-black with a trace of warmth, never pure `#000`. */
  background: string;
  /** Default card / sheet surface. */
  surface: string;
  /** Raised surface (sheets, popovers). On dark, elevation reads as a lighter
   *  fill — a shadow is invisible against near-black. */
  surfaceRaised: string;
  /** Recessed / inset fill for wells, disabled fields, skeletons. */
  surfaceMuted: string;

  textPrimary: string;
  textSecondary: string;
  /** Text drawn on top of `brandPrimary` / `brandPressed` — ink on ivory. */
  textOnBrand: string;

  /** The ivory used for primary actions and the brand mark. */
  brandPrimary: string;
  brandPressed: string;
  /** Subtle raised tint for selected states. */
  brandSoft: string;

  /**
   * Champagne. Reserved for genuinely celebratory moments — publication
   * success, reveal unlock, Memory Book. Never for ordinary CTAs. On this
   * canvas it measures 11.45:1, so unlike the light theme it is safe at body
   * size; the restriction here is editorial, not technical.
   */
  accentWarm: string;

  /** Decorative hairlines and dividers. Not a control boundary. */
  borderSubtle: string;
  /** Control boundaries (inputs, option cards). Meets 3:1 non-text contrast. */
  borderStrong: string;
  /** Focus indicator. */
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
  /** Gradient stops laid under text on full-bleed imagery, top to bottom. */
  imageScrim: readonly [string, string, string];
}

export const colours: ColourPalette = {
  background: '#0B0B0C',
  surface: '#141416',
  surfaceRaised: '#1C1C1F',
  surfaceMuted: '#101012',

  textPrimary: '#F5F2ED',
  textSecondary: '#A29C94',
  textOnBrand: '#0B0B0C',

  brandPrimary: '#EFE9E0',
  brandPressed: '#D8D2C8',
  brandSoft: '#1E1E22',

  accentWarm: '#D9C39A',

  borderSubtle: '#232326',
  borderStrong: '#66666E',
  focusRing: '#EFE9E0',

  success: '#7FB08A',
  warning: '#D9A76A',
  error: '#E8776D',

  scrim: 'rgba(5, 5, 6, 0.72)',
  overlayLight: 'rgba(245, 242, 237, 0.86)',
  overlayDark: 'rgba(5, 5, 6, 0.62)',

  // Three stops rather than two: a plain linear fade leaves a visible band
  // across the middle of a photograph. Weighting the ramp toward the bottom
  // keeps the subject clear while guaranteeing the text below stays legible.
  imageScrim: ['rgba(11,11,12,0)', 'rgba(11,11,12,0.55)', 'rgba(11,11,12,0.96)'],
};

/**
 * Elevation.
 *
 * On a near-black canvas a drop shadow is invisible, so elevation is carried by
 * `surfaceRaised` and by hairline borders. These shadows remain for the few
 * places something sits above imagery, where a shadow still reads.
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
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  medium: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  high: {
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
} as const;

export type ElevationToken = keyof typeof elevation;
