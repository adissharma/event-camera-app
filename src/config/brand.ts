/**
 * Central brand configuration.
 *
 * The public product name is NOT final. `Koto` is a temporary working name and
 * fallback label only.
 *
 * Every user-visible reference to the brand must resolve through this module.
 * Nothing in screens, migrations, table names, buckets, RPC names, analytics
 * event names, error messages, share templates, QR templates, legal copy or
 * documentation examples may hard-code a brand name.
 *
 * See `docs/renaming.md` for the complete rename checklist.
 */

export const BRAND_CONFIG = {
  appName: 'Koto',
  shortName: 'Koto',
  tagline: 'Every guest. Every angle.',
  supportEmail: 'support@example.com',
  websiteUrl: 'https://example.com',
  guestDomain: 'https://example.com',
} as const;

export type BrandConfig = typeof BRAND_CONFIG;

/**
 * Brand asset manifest.
 *
 * Only populate a variant that ACTUALLY exists as a supplied file. Never invent
 * a light or mark variant that the founder has not provided — `BrandLogo` falls
 * back to an accessible text lockup instead.
 */
export const BRAND_ASSETS: {
  logoPrimary: number | undefined;
  logoLight: number | undefined;
  logoMark: number | undefined;
} = {
  // No logo has been supplied yet. `BrandLogo` renders a clearly labelled
  // placeholder lockup until a real asset is dropped into assets/brand/.
  logoPrimary: undefined,
  logoLight: undefined,
  logoMark: undefined,
};

/** True when a real logo asset exists; drives placeholder vs. image rendering. */
export const HAS_BRAND_LOGO = BRAND_ASSETS.logoPrimary !== undefined;
