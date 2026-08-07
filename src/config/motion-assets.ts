import type { VisualAssetKey } from './visual-assets';

/**
 * Motion assets bundled with the app.
 *
 * Same rule as photography: replacing one means editing THIS mapping, never a
 * screen.
 *
 * Keep this list very short. Every entry ships inside the binary and is paid
 * for in download size by every user.
 *
 * ── Why this is a separate module from `visual-assets` ──
 * `require()` of a video is a module-scope side effect: any module that
 * transitively imports this file makes the bundler include the video file,
 * whether or not the video is ever played. `visual-assets` is imported by
 * `premium-image` and `visual-placeholder`, which the guest screens use, so
 * keeping the motion registry in that file pulled 1.3 MB of footage into the
 * App Clip. Splitting it means only `background-video` — a full-app-only
 * component — carries that cost.
 *
 * Do not re-export this module from `visual-assets`; that would restore the
 * import edge this split exists to break.
 */

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
