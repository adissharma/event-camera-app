import {
  DEFAULT_RETRY_POLICY,
  exponentialDelay,
  isRetryableStatus,
  retryAfterMs,
  retryDelayMs,
  shouldRetry,
  type RetryPolicy,
} from './retry';

const policy: RetryPolicy = { baseDelayMs: 1000, maxDelayMs: 60_000, maxAttempts: 6 };

describe('upload retry', () => {
  describe('exponential growth', () => {
    it('doubles each attempt', () => {
      expect(exponentialDelay(1, policy)).toBe(1000);
      expect(exponentialDelay(2, policy)).toBe(2000);
      expect(exponentialDelay(3, policy)).toBe(4000);
      expect(exponentialDelay(4, policy)).toBe(8000);
    });

    it('caps at maxDelayMs, so a long queue never stalls for hours', () => {
      // Uncapped, attempt 20 would be roughly 6 days.
      expect(retryDelayMs(20, policy, () => 1)).toBe(policy.maxDelayMs);
    });
  });

  describe('jitter', () => {
    it('samples the full window, not a narrow band', () => {
      expect(retryDelayMs(3, policy, () => 0)).toBe(0);
      expect(retryDelayMs(3, policy, () => 1)).toBe(4000);
      expect(retryDelayMs(3, policy, () => 0.5)).toBe(2000);
    });

    it('spreads retries so a roomful of phones does not resend in lockstep', () => {
      // The failure mode this prevents: 300 guests on one saturated access
      // point, all failing at the same instant, all retrying at the same
      // instant, keeping the network down.
      const samples = Array.from({ length: 500 }, (_, i) =>
        retryDelayMs(4, policy, () => i / 500),
      );
      const unique = new Set(samples);
      expect(unique.size).toBeGreaterThan(100);
      expect(Math.min(...samples)).toBeLessThan(1000);
      expect(Math.max(...samples)).toBeGreaterThan(7000);
    });

    it('never returns a negative delay', () => {
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        expect(retryDelayMs(attempt, policy, () => 0)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('attempt budget', () => {
    it('stops at the configured maximum', () => {
      expect(shouldRetry(1, policy)).toBe(true);
      expect(shouldRetry(5, policy)).toBe(true);
      expect(shouldRetry(6, policy)).toBe(false);
      expect(shouldRetry(7, policy)).toBe(false);
    });

    it('uses the shared upload configuration by default', () => {
      expect(DEFAULT_RETRY_POLICY.maxAttempts).toBeGreaterThan(1);
    });
  });

  describe('which failures are worth retrying', () => {
    it('retries when the request never completed', () => {
      // Offline, DNS failure, timeout — the most retryable case there is.
      expect(isRetryableStatus(null)).toBe(true);
      expect(isRetryableStatus(undefined)).toBe(true);
    });

    it('retries transient server and throttling responses', () => {
      expect(isRetryableStatus(500)).toBe(true);
      expect(isRetryableStatus(503)).toBe(true);
      expect(isRetryableStatus(429)).toBe(true);
      expect(isRetryableStatus(408)).toBe(true);
    });

    it('does not retry a client error that will fail identically forever', () => {
      // Retrying these just burns a guest's battery and data.
      expect(isRetryableStatus(400)).toBe(false);
      expect(isRetryableStatus(401)).toBe(false);
      expect(isRetryableStatus(403)).toBe(false);
      expect(isRetryableStatus(404)).toBe(false);
      expect(isRetryableStatus(413)).toBe(false);
    });

    it('does not retry success', () => {
      expect(isRetryableStatus(200)).toBe(false);
      expect(isRetryableStatus(204)).toBe(false);
    });
  });

  describe('Retry-After', () => {
    it('reads a delay in seconds', () => {
      expect(retryAfterMs('30')).toBe(30_000);
      expect(retryAfterMs('0')).toBe(0);
    });

    it('reads an HTTP date', () => {
      const now = Date.parse('2026-07-28T12:00:00Z');
      expect(retryAfterMs('Tue, 28 Jul 2026 12:00:30 GMT', now)).toBe(30_000);
    });

    it('clamps a past date to zero rather than going negative', () => {
      const now = Date.parse('2026-07-28T12:00:00Z');
      expect(retryAfterMs('Tue, 28 Jul 2026 11:59:00 GMT', now)).toBe(0);
    });

    it('returns null when absent or unparseable, so backoff applies instead', () => {
      expect(retryAfterMs(null)).toBeNull();
      expect(retryAfterMs(undefined)).toBeNull();
      expect(retryAfterMs('soon')).toBeNull();
    });
  });
});
