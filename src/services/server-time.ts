import { SUPABASE_CONFIG, HAS_SUPABASE_CREDENTIALS } from '@/config/app-config';

/**
 * A clock that cannot be moved by the person reading it.
 *
 * The reveal is the one moment in this product where the device clock is not
 * good enough. A host who wants to see the photos early only has to change the
 * date in Settings, and every `Date.now()` comparison in the app agrees with
 * them. So the reveal reads from here instead: the offset between this device
 * and the server, applied to the local monotonic clock.
 *
 * This is a convenience, not the enforcement. The server is still the authority
 * — it decides what the gallery query returns. What this buys is that the UI
 * stops *claiming* the photos are ready before they are, which is the part the
 * user actually experiences.
 */

/** Server time minus device time, in milliseconds. */
let offsetMs = 0;

/** False until a sync has landed. Callers may want to degrade rather than lie. */
let synced = false;

/** In-flight sync, so concurrent callers share one request. */
let pending: Promise<boolean> | null = null;

/** A sync older than this is worth redoing. */
const STALE_AFTER_MS = 5 * 60 * 1000;
let lastSyncAt = 0;

/** How long to wait before giving up and staying on the device clock. */
const TIMEOUT_MS = 4000;

/**
 * Reads the server clock from the `Date` response header.
 *
 * Every HTTP server sends one, so this needs no custom endpoint and no schema
 * change. The round trip is halved and subtracted, on the assumption that the
 * response header was written at roughly the midpoint of the request — good to
 * well inside a second, which is far tighter than the minute-level granularity
 * a reveal time is set at.
 */
async function measureOffset(): Promise<boolean> {
  const url = SUPABASE_CONFIG.url;
  const anonKey = SUPABASE_CONFIG.anonKey;
  if (!HAS_SUPABASE_CREDENTIALS || !url || !anonKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const sentAt = Date.now();
    const response = await fetch(`${url}/auth/v1/health`, {
      method: 'HEAD',
      headers: { apikey: anonKey },
      signal: controller.signal,
    });
    const receivedAt = Date.now();

    const header = response.headers.get('date');
    if (!header) return false;

    const serverMs = new Date(header).getTime();
    if (!Number.isFinite(serverMs)) return false;

    offsetMs = serverMs - (sentAt + (receivedAt - sentAt) / 2);
    synced = true;
    lastSyncAt = receivedAt;
    return true;
  } catch {
    // Offline, blocked, or too slow. The device clock stands in; callers that
    // care check `isServerTimeTrusted()`.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Brings the offset up to date.
 *
 * Cheap to call repeatedly — it no-ops while a recent sync is still fresh and
 * shares a single request between concurrent callers.
 */
export function syncServerClock(force = false): Promise<boolean> {
  if (pending) return pending;
  if (!force && synced && Date.now() - lastSyncAt < STALE_AFTER_MS) {
    return Promise.resolve(true);
  }

  pending = measureOffset().finally(() => {
    pending = null;
  });
  return pending;
}

/** Server time in milliseconds. Falls back to the device clock before a sync. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/**
 * Whether `serverNow()` is actually server-derived.
 *
 * Without a backend configured this is always false, and the caller should not
 * treat a locally-computed "the reveal has passed" as sufficient to show
 * anything that was hidden.
 */
export function isServerTimeTrusted(): boolean {
  return synced;
}

/** Test seam. Resets the module to its pre-sync state. */
export function __resetServerClock(): void {
  offsetMs = 0;
  synced = false;
  pending = null;
  lastSyncAt = 0;
}
