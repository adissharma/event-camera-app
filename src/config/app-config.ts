/**
 * Environment-specific and product-default configuration.
 *
 * Identifiers here are TEMPORARY and must all change before launch — the
 * complete list is tracked in `docs/renaming.md`.
 *
 * Product defaults live here rather than in screens so that commercial and
 * behavioural rules are never hard-coded into UI. Anything a plan can vary is
 * defined in the entitlement catalogue instead — see `src/features/entitlements`.
 */

import Constants from 'expo-constants';

/** Reads a public Expo env var, falling back to `undefined` when unset. */
function env(key: string): string | undefined {
  const value =
    process.env[key] ??
    (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key];
  return value && value.length > 0 ? value : undefined;
}

export const SUPABASE_CONFIG = {
  url: env('EXPO_PUBLIC_SUPABASE_URL'),
  anonKey: env('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
} as const;

/**
 * True when real backend credentials are present. When false the app runs
 * against the typed development fallback so the whole host journey is still
 * exercisable — it is NOT a mock-only app, it is the same code path with an
 * in-memory adapter behind the same interfaces.
 */
export const HAS_SUPABASE_CREDENTIALS =
  Boolean(SUPABASE_CONFIG.url) && Boolean(SUPABASE_CONFIG.anonKey);

/** Temporary platform identifiers. All must change before launch. */
export const PLATFORM_IDENTIFIERS = {
  expoSlug: 'event-camera-app',
  iosBundleId: 'com.example.eventcamera',
  androidPackage: 'com.example.eventcamera',
  deepLinkScheme: 'eventcamera',
} as const;

/** Storage bucket names. Brand-neutral by design. */
export const STORAGE_BUCKETS = {
  covers: 'celebration-covers',
  media: 'event-media',
  qr: 'qr-assets',
} as const;

/**
 * MVP product defaults for a newly created event session.
 * Every one of these is overridable by the host during creation.
 */
export const EVENT_DEFAULTS = {
  shotLimitPerGuest: 20,
  cameraRollUploadLimit: 5,
  cameraRollUploadsAfterClose: true,
  allowMediaFromAnyDate: false,
  captureMode: 'camera_and_library',
  allowedMediaTypes: ['photo'],
  revealMode: 'scheduled',
  /** Hours after close, when reveal mode is scheduled. */
  revealDelayHours: 12,
  galleryVisibility: 'all_guests',
  guestDownloadsEnabled: true,
  moderationEnabled: false,
  pinRequired: false,
  photoTreatment: 'original',
  dateStampEnabled: false,
  sequenceNumber: 1,
} as const;

/** Selectable photo-limit options. `null` represents unlimited. */
export const PHOTO_LIMIT_OPTIONS: readonly (number | null)[] = [5, 10, 15, 25, null];

/** Locale and formatting. */
export const LOCALE_CONFIG = {
  locale: 'en-GB',
  currency: 'GBP',
  currencySymbol: '£',
  /** IANA zone used when the device zone cannot be resolved. */
  fallbackTimezone: 'Europe/London',
} as const;

/** Upload behaviour. Tuned for unstable venue networks. */
export const UPLOAD_CONFIG = {
  /** Above this size a photo uses TUS resumable upload instead of a PUT. */
  tusThresholdBytes: 5 * 1024 * 1024,
  maxConcurrentUploads: 3,
  maxAttempts: 6,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 60_000,
  /** Upload intents expire after this long; expired intents are re-requested. */
  intentTtlSeconds: 3_600,
  maxPhotoBytes: 50 * 1024 * 1024,
  permittedPhotoMimeTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'],
} as const;
