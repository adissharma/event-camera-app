/**
 * Analytics abstraction.
 *
 * No provider SDK is imported anywhere else in the app. Swapping PostHog for
 * something else, or disabling analytics entirely for a privacy-sensitive
 * deployment, is a change to this file only.
 *
 * The redaction below is the important part. This product handles a wedding:
 * guest names, event titles, access tokens and PINs all pass through code near
 * these calls, and any of them ending up in a third-party analytics pipeline
 * would be a privacy incident rather than a bug. So the transport refuses to
 * send anything that looks sensitive, instead of relying on every future call
 * site to remember.
 */

export type AnalyticsEvent =
  // Onboarding and auth
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'sign_in_started'
  | 'sign_in_completed'
  | 'sign_out'
  // Creation
  | 'event_creation_started'
  | 'event_creation_step_completed'
  | 'event_creation_abandoned'
  | 'inspiration_pack_selected'
  | 'theme_selected'
  | 'cover_upload_started'
  | 'cover_upload_completed'
  | 'cover_upload_failed'
  | 'plan_selected'
  // Commerce
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'purchase_restored'
  // Publication and sharing
  | 'event_created'
  | 'event_published'
  | 'qr_shared'
  | 'guest_link_copied'
  | 'guest_preview_opened'
  | 'event_edited'
  | 'event_archived'
  // Media pipeline
  | 'upload_started'
  | 'upload_completed'
  | 'upload_resumed'
  | 'upload_failed'
  | 'upload_verification_failed'
  | 'processing_completed';

/** Only primitives. A nested object is where free text hides. */
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export interface AnalyticsTransport {
  capture(event: AnalyticsEvent, properties: AnalyticsProperties): void;
  identify(userId: string, properties?: AnalyticsProperties): void;
  reset(): void;
}

/**
 * Property keys that must never leave the device.
 *
 * Matched case-insensitively as substrings, so `guest_access_token`,
 * `signedUrl` and `eventTitle` are all caught. Deliberately aggressive: losing
 * a metric is recoverable, leaking a guest's name is not.
 */
const FORBIDDEN_KEY_PATTERNS = [
  // Credentials
  'token', 'secret', 'password', 'pin',
  // Identity
  'email', 'phone', 'name', 'address', 'location',
  // Locators — a guest link is a bearer credential
  'url', 'link', 'slug', 'path',
  // Free text. Anything a human typed can contain anything at all, so the
  // whole category is refused rather than enumerated. `supporting_line` slipped
  // through an earlier, narrower list and was caught by a test.
  'title', 'message', 'caption', 'note', 'description',
  'line', 'text', 'content', 'body', 'comment', 'query', 'search',
];

/** Values that look like a credential or a URL, whatever the key is called. */
function looksSensitive(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return true;
  // 32+ hex characters: an access token or a public slug.
  if (/^[0-9a-f]{32,}$/i.test(value)) return true;
  // A JWT.
  if (/^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(value)) return true;
  return false;
}

export function redact(properties: AnalyticsProperties): AnalyticsProperties {
  const safe: AnalyticsProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    const lowerKey = key.toLowerCase();

    if (FORBIDDEN_KEY_PATTERNS.some((pattern) => lowerKey.includes(pattern))) {
      continue;
    }
    if (looksSensitive(value)) {
      continue;
    }
    safe[key] = value;
  }

  return safe;
}

/** Logs to the console. The default until a provider is configured. */
export const consoleTransport: AnalyticsTransport = {
  capture(event, properties) {
    if (__DEV__) {
      console.log(`[analytics] ${event}`, properties);
    }
  },
  identify() {},
  reset() {},
};

/** Discards everything. For tests and privacy-sensitive deployments. */
export const noopTransport: AnalyticsTransport = {
  capture() {},
  identify() {},
  reset() {},
};

let transport: AnalyticsTransport = consoleTransport;

export function setAnalyticsTransport(next: AnalyticsTransport): void {
  transport = next;
}

/**
 * Records an event.
 *
 * Properties are redacted here rather than at the call site, so a future
 * contributor cannot leak a guest name by forgetting.
 */
export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  transport.capture(event, redact(properties));
}

/**
 * Associates events with a user.
 *
 * The user id is a UUID that means nothing outside our database. No email or
 * display name is ever attached.
 */
export function identify(userId: string, properties: AnalyticsProperties = {}): void {
  transport.identify(userId, redact(properties));
}

export function resetAnalytics(): void {
  transport.reset();
}
