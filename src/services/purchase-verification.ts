/**
 * Asks the server to verify a store purchase.
 *
 * The client no longer grants itself anything: `publish_celebration` and
 * `upgrade_celebration_plan` record what was bought but leave it inactive,
 * and only the server — after checking the transaction with RevenueCat —
 * turns that into an entitlement.
 *
 * Failing here does NOT mean the host lost their money. The purchase is
 * recorded, and RevenueCat's webhook grants it independently, so a failure
 * is a delay rather than a loss. That is worth saying plainly in the copy: a
 * host who has just been charged and sees an error needs to know the money
 * is not gone.
 */
import { Platform } from 'react-native';

import { BRAND_CONFIG } from '@/config/brand';
import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';
import type { PurchaseReceipt } from '@/features/payments/types';

/**
 * The client's platform names mapped onto the database's `purchase_platform`
 * enum.
 *
 * They are deliberately not the same set: the client distinguishes the
 * development provider from real web, and the database does not have a
 * 'development' value. Passing the client's name straight through fails the
 * whole call with an enum error — which is exactly what happened, and it
 * surfaced to the host as "payment went through but the upgrade could not be
 * applied" rather than as anything pointing at a type mismatch.
 */
export type DatabasePurchasePlatform = 'apple_app_store' | 'google_play' | 'web';

export function toDatabasePlatform(platform: PurchaseReceipt['platform']): DatabasePurchasePlatform {
  switch (platform) {
    case 'apple_app_store':
    case 'google_play':
      return platform;
    default:
      // 'development' and 'web' alike: no store, nothing to verify against.
      return 'web';
  }
}

export class VerificationError extends Error {
  constructor(
    message: string,
    readonly code: 'unauthenticated' | 'not_recorded' | 'not_verified' | 'unavailable' | 'network',
    /** Whether the webhook is still expected to grant this on its own. */
    readonly recoverable: boolean,
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

/** How long to keep asking before handing the wait to the webhook. */
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Where the verification endpoint lives.
 *
 * Relative on web, where the app is served from the same origin as the API,
 * and absolute on native, where there is no origin to be relative to — a
 * bare `/api/...` from a phone resolves to nothing and the purchase would
 * appear to fail every time.
 */
const VERIFY_URL =
  Platform.OS === 'web'
    ? '/api/verify-purchase'
    : `${BRAND_CONFIG.guestDomain}/api/verify-purchase`;

/**
 * Verifies one transaction, retrying the races worth retrying.
 *
 * RevenueCat can take a moment to see a transaction the device has only just
 * completed, so `not_verified` is retried a couple of times before giving up.
 * A `not_recorded` or ownership failure is not retried: those do not become
 * true by waiting.
 */
export async function verifyPurchase(receipt: PurchaseReceipt): Promise<void> {
  // The development provider produces no store transaction, and the server
  // grants those directly under its own switch — there is nothing to verify.
  if (receipt.platform === 'development' || receipt.platform === 'web') return;

  if (!isBackendConfigured) return;
  const client = requireSupabase();

  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new VerificationError('You need to be signed in to complete this purchase.', 'unauthenticated', true);
  }

  let lastError: VerificationError | null = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          transactionId: receipt.platformTransactionId,
          platform: receipt.platform,
        }),
      });
    } catch {
      lastError = new VerificationError(
        'We could not reach the server to confirm your purchase. It will be applied shortly.',
        'network',
        true,
      );
      if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }

    if (response.ok) return;

    if (response.status === 401 || response.status === 403) {
      throw new VerificationError('This purchase belongs to a different account.', 'unauthenticated', false);
    }
    if (response.status === 404) {
      throw new VerificationError('We have no record of this purchase.', 'not_recorded', false);
    }

    // 402 (the store has not confirmed it yet) and 502 (RevenueCat
    // unreachable) are both worth another go.
    lastError = new VerificationError(
      'Your purchase is still being confirmed. It will be applied shortly.',
      response.status === 402 ? 'not_verified' : 'unavailable',
      true,
    );
    if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }

  throw lastError ?? new VerificationError('Could not confirm your purchase.', 'unavailable', true);
}
