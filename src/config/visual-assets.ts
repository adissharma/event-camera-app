/**
 * Central visual asset manifest.
 *
 * Replacing imagery must require changing THIS mapping only — never a screen.
 *
 * Every entry carries art-direction metadata so that whoever sources the real
 * photography knows the crop, the focal point and the emotional brief, and so
 * that `PremiumImage` can crop intelligently rather than centre-cropping
 * through someone's face.
 *
 * No production imagery has been supplied yet, so every key currently resolves
 * to `undefined` and renders as a `VisualPlaceholder`. That is deliberate:
 * generic AI-generated wedding photography must not ship in production.
 */

export interface VisualAsset {
  /** Width ÷ height. Drives the reserved box so layout never jumps. */
  aspectRatio: number;
  /** Focal point in 0–1 unit coordinates, used to bias the crop. */
  focalPoint: { x: number; y: number };
  /** Art direction brief for whoever sources the real photograph. */
  artDirection: string;
  /** Screen-reader description. Required — never decorative-only. */
  accessibilityLabel: string;
  /** Where this asset appears, so unused keys are obvious. */
  intendedScreen: string;
  /** `require()` of the real asset once supplied. */
  source?: number;
}

export const VISUAL_ASSETS = {
  welcome_hero: {
    aspectRatio: 3 / 4,
    focalPoint: { x: 0.5, y: 0.38 },
    artDirection:
      'Candid, warm, slightly imperfect. A guest holding a phone up at a celebration, other guests soft behind. Available light, not studio flash. Must read across cultures — avoid ceremony-specific dress as the subject.',
    accessibilityLabel: 'A guest photographing friends at a celebration',
    intendedScreen: 'Welcome',
  },
  onboarding_candid: {
    aspectRatio: 4 / 5,
    focalPoint: { x: 0.5, y: 0.42 },
    artDirection:
      'Two or three guests mid-laugh, caught rather than posed. Slight motion blur is welcome. Warm interior light.',
    accessibilityLabel: 'Guests laughing together at an event',
    intendedScreen: 'Onboarding — the candid promise',
  },
  onboarding_multi_event: {
    aspectRatio: 4 / 5,
    focalPoint: { x: 0.5, y: 0.5 },
    artDirection:
      'A grid or spread suggesting several separate occasions — daytime and evening, indoor and outdoor. Communicates "more than one function" without naming a tradition.',
    accessibilityLabel: 'Photographs from several different celebrations',
    intendedScreen: 'Onboarding — multiple functions',
  },
  onboarding_guest: {
    aspectRatio: 4 / 5,
    focalPoint: { x: 0.5, y: 0.45 },
    artDirection:
      'A guest scanning a QR card on a table. The card is legible but not the hero. No app UI visible.',
    accessibilityLabel: 'A guest scanning a QR code at a table',
    intendedScreen: 'Onboarding — how guests join',
  },
  create_event_cover: {
    aspectRatio: 3 / 4,
    focalPoint: { x: 0.5, y: 0.4 },
    artDirection:
      'The default editorial cover offered when a host has not chosen their own image. Beautiful but neutral — string lights, a table, a room — no identifiable faces, so it flatters any celebration.',
    accessibilityLabel: 'A softly lit celebration venue',
    intendedScreen: 'Create — live cover editor default',
    source: require('../../assets/images/placeholders/create_event_cover.png'),
  },
  success_hero: {
    aspectRatio: 1,
    focalPoint: { x: 0.5, y: 0.5 },
    artDirection:
      'Quiet and confident rather than triumphant. Reads well behind a QR card overlay.',
    accessibilityLabel: 'A celebration scene',
    intendedScreen: 'Publication success',
  },
  dashboard_fallback: {
    aspectRatio: 16 / 9,
    focalPoint: { x: 0.5, y: 0.5 },
    artDirection:
      'Used when a host has published without a cover image. Must be calm enough to sit under an event title without competing.',
    accessibilityLabel: 'Default event cover',
    intendedScreen: 'Event dashboard',
  },
  theme_editorial: {
    aspectRatio: 3 / 4,
    focalPoint: { x: 0.5, y: 0.4 },
    artDirection: 'Theme preview: clean editorial, generous margins, restrained type.',
    accessibilityLabel: 'Editorial theme preview',
    intendedScreen: 'Theme carousel',
  },
  theme_film: {
    aspectRatio: 3 / 4,
    focalPoint: { x: 0.5, y: 0.4 },
    artDirection: 'Theme preview: warm analogue cast, soft grain, gentle vignette.',
    accessibilityLabel: 'Film theme preview',
    intendedScreen: 'Theme carousel',
  },
  theme_emerald: {
    aspectRatio: 3 / 4,
    focalPoint: { x: 0.5, y: 0.4 },
    artDirection: 'Theme preview: deep green ground with warm metallic-free highlights.',
    accessibilityLabel: 'Emerald theme preview',
    intendedScreen: 'Theme carousel',
  },
  theme_floral: {
    aspectRatio: 3 / 4,
    focalPoint: { x: 0.5, y: 0.4 },
    artDirection:
      'Theme preview: botanical without becoming a wedding-stationery cliché. Photographic, not illustrated.',
    accessibilityLabel: 'Floral theme preview',
    intendedScreen: 'Theme carousel',
  },
  hindu_wedding: {
    aspectRatio: 9 / 16,
    focalPoint: { x: 0.5, y: 0.5 },
    artDirection: 'Candid Hindu wedding portrait',
    accessibilityLabel: 'Candid Hindu wedding photo',
    intendedScreen: 'Treatment selection carousel',
    source: require('../../assets/images/placeholders/hindu_wedding.png'),
  },
  christian_wedding: {
    aspectRatio: 9 / 16,
    focalPoint: { x: 0.5, y: 0.5 },
    artDirection: 'Candid Christian wedding portrait',
    accessibilityLabel: 'Candid Christian wedding photo',
    intendedScreen: 'Treatment selection carousel',
    source: require('../../assets/images/placeholders/christian_wedding.png'),
  },
} as const satisfies Record<string, VisualAsset>;

export type VisualAssetKey = keyof typeof VISUAL_ASSETS;

export function getVisualAsset(key: VisualAssetKey): VisualAsset {
  return VISUAL_ASSETS[key];
}

/* ------------------------------------------------------------------------- */

export interface MotionAsset {
  source: number;
  /** Key in `VISUAL_ASSETS` shown if the video fails or is unavailable. */
  fallbackAssetKey: VisualAssetKey;
  accessibilityLabel: string;
  intendedScreen: string;
  /** Provenance and licence. Recorded for the same reason the fonts are. */
  licence: {
    source: string;
    url: string;
    author: string;
    licence: string;
    commercialUse: boolean;
    attributionRequired: boolean;
  };
  /** Bundled file size, so the effect on app size stays visible. */
  approxBytes: number;
  isPlaceholder: boolean;
}

/**
 * Motion assets bundled with the app.
 *
 * Same rule as photography: replacing one means editing THIS mapping, never a
 * screen.
 *
 * Keep this list very short. Every entry ships inside the binary and is paid
 * for in download size by every user.
 */
export const MOTION_ASSETS = {
  welcome_ambient: {
    source: require('../../assets/video/welcome-hero.mp4'),
    fallbackAssetKey: 'welcome_hero',
    accessibilityLabel: 'Sparklers held in the dark at a celebration',
    intendedScreen: 'Welcome',
    licence: {
      source: 'Pexels',
      url: 'https://www.pexels.com/video/a-person-holding-a-sparkler-in-the-dark-19492425/',
      author: 'Beyza Koeken',
      licence: 'Pexels License — free to use',
      commercialUse: true,
      attributionRequired: false,
    },
    approxBytes: 1_318_552,
    // Stock footage standing in for real event footage. It is atmospheric and
    // correctly licensed, but it is not this product's own material and should
    // be replaced before launch — see docs/visual-assets.md.
    isPlaceholder: true,
  },
} as const satisfies Record<string, MotionAsset>;

export type MotionAssetKey = keyof typeof MOTION_ASSETS;

export function getMotionAsset(key: MotionAssetKey): MotionAsset {
  return MOTION_ASSETS[key];
}
