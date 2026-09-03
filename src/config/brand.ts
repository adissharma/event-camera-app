/**
 * Central brand configuration.
 *
 * Every user-visible product name should resolve through this module.
 *
 * Every user-visible reference to the brand must resolve through this module.
 * Nothing in screens, migrations, table names, buckets, RPC names, analytics
 * event names, error messages, share templates, QR templates, legal copy or
 * documentation examples may hard-code a brand name.
 *
 * See `docs/renaming.md` for the complete rename checklist.
 */

export const BRAND_CONFIG = {
  appName: 'Stills.',
  shortName: 'Stills.',
  tagline: 'Every guest. Every angle.',
  supportEmail: 'support@example.com',
  websiteUrl: 'https://example.com',
  /**
   * The canonical production origin. Every generated link — invitations, QR
   * codes, share links, the verification endpoint — is built from this, so
   * moving domains is a one-line change here rather than a hunt.
   *
   * Must match the Universal Link / App Link domain in `app.json`.
   */
  guestDomain: 'https://withstills.com',
} as const;

/**
 * Origins we used to publish links from.
 *
 * Every QR code already printed, every invitation already sent and every
 * link already pasted into a group chat carries one of these, and a domain
 * move must not turn those into dead paper. The scanner accepts them
 * alongside the canonical host, and `app.json` keeps their Universal Link
 * and App Link entries so an old link still opens the app rather than the
 * browser.
 *
 * Nothing is ever GENERATED from this list — it is read-only history. Add to
 * it when the canonical domain changes; remove an entry only when you are
 * willing to break every link that used it.
 */
export const LEGACY_GUEST_DOMAINS = [
  'https://event-camera-app-navy.vercel.app',
] as const;

export type BrandConfig = typeof BRAND_CONFIG;

/**
 * Brand asset manifest.
 *
 * Only populate a variant that ACTUALLY exists as a supplied file. Never invent
 * a light or mark variant that the founder has not provided — `BrandLogo` falls
 * back to an accessible text lockup instead.
 */
export const BRAND_ASSETS: {
  logoPrimary: any;
  logoLight: any;
  logoMark: any;
} = {
  logoPrimary: require('../../assets/brand/logo.png'),
  logoLight: require('../../assets/brand/logo.png'),
  logoMark: require('../../assets/brand/logo.png'),
};

/** True when a real logo asset exists; drives placeholder vs. image rendering. */
export const HAS_BRAND_LOGO = BRAND_ASSETS.logoPrimary !== undefined;
