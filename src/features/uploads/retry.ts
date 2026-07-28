import { UPLOAD_CONFIG } from '@/config/app-config';

/**
 * Retry scheduling for uploads.
 *
 * Exponential backoff with full jitter. The jitter is not decoration: a venue
 * has a few hundred guests on one saturated access point, and every phone that
 * failed at the same moment would otherwise retry at the same moment, producing
 * a thundering herd that keeps the network down.
 *
 * "Full jitter" — a uniform sample from [0, cappedDelay] — is used rather than
 * a fixed ±10% band because it spreads retries across the whole window.
 */

export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: UPLOAD_CONFIG.baseRetryDelayMs,
  maxDelayMs: UPLOAD_CONFIG.maxRetryDelayMs,
  maxAttempts: UPLOAD_CONFIG.maxAttempts,
};

/** The uncapped, un-jittered delay. Exposed for testing and reasoning. */
export function exponentialDelay(attempt: number, policy = DEFAULT_RETRY_POLICY): number {
  return policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
}

/**
 * Delay before `attempt` (1-based).
 *
 * `random` is injectable so tests are deterministic rather than flaky.
 */
export function retryDelayMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  const capped = Math.min(exponentialDelay(attempt, policy), policy.maxDelayMs);
  return Math.round(random() * capped);
}

export function shouldRetry(attempt: number, policy = DEFAULT_RETRY_POLICY): boolean {
  return attempt < policy.maxAttempts;
}

/**
 * Whether a failure is worth retrying at all.
 *
 * Retrying a 403 or a 413 is pure waste — it will fail identically every time,
 * while consuming the user's battery and data. 408, 429 and 5xx are transient.
 * A null status means the request never completed (offline, DNS, timeout),
 * which is the most retryable case there is.
 */
export function isRetryableStatus(status: number | null | undefined): boolean {
  if (status === null || status === undefined) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

/** Honours a server `Retry-After` header, in seconds or as an HTTP date. */
export function retryAfterMs(header: string | null | undefined, now = Date.now()): number | null {
  if (!header) return null;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    // A past date must not produce a negative delay.
    return Math.max(0, date - now);
  }
  return null;
}
