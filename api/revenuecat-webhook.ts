/**
 * RevenueCat webhook.
 *
 * Two jobs, both of which the synchronous `verify-purchase` endpoint cannot do:
 *
 *  1. Grant what was paid for when the client never made it back. A phone
 *     that dies, loses signal, or is force-quit between Apple taking the
 *     money and our endpoint being called would otherwise leave a host
 *     charged and un-upgraded. RevenueCat retries this webhook, so the grant
 *     eventually lands on its own.
 *
 *  2. Take entitlements back. Refunds and revocations only ever arrive here —
 *     there is no client involved in a refund, and nothing else would ever
 *     notice one.
 *
 * The body is untrusted input from the public internet. It is authenticated
 * by a shared secret in the Authorization header (set on both sides in the
 * RevenueCat dashboard), and even then the transaction is re-checked against
 * a purchase row we wrote ourselves rather than acted on as described.
 */
import { createClient } from '@supabase/supabase-js';

type PurchasePlatform = 'apple_app_store' | 'google_play' | 'web';

/** RevenueCat's store names mapped onto ours. */
function mapStore(store: unknown): PurchasePlatform | null {
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'apple_app_store';
    case 'PLAY_STORE':
      return 'google_play';
    default:
      return null;
  }
}

function getConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!url || !key) throw new Error('missing_supabase_credentials');
  if (!secret) throw new Error('missing_revenuecat_webhook_secret');
  return { url, key, secret };
}

/** Events that take an entitlement away, mapped to how we record the reversal. */
const REVERSALS: Record<string, 'refunded' | 'revoked'> = {
  CANCELLATION: 'refunded',
  REFUND: 'refunded',
  REFUND_REVERSED: 'revoked',
  EXPIRATION: 'revoked',
  SUBSCRIPTION_PAUSED: 'revoked',
};

/** Events that grant. Consumables arrive as NON_RENEWING_PURCHASE. */
const GRANTS = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'UNCANCELLATION']);

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let config;
  try {
    config = getConfig();
  } catch (error: any) {
    console.error('[revenuecat-webhook] configuration', error?.message);
    response.status(500).json({ error: 'server_misconfigured' });
    return;
  }

  // Constant-length comparison is not worth reaching for here — the secret is
  // compared whole and a mismatch reveals nothing about it — but the check
  // must happen before anything in the body is read as meaningful.
  if (request.headers.authorization !== `Bearer ${config.secret}`) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body ?? {});
  const event = body?.event ?? {};
  const type: string = String(event.type ?? '');
  const platform = mapStore(event.store);
  const transactionId: string | undefined =
    event.transaction_id ?? event.original_transaction_id ?? undefined;

  if (!platform || !transactionId) {
    // Acknowledged rather than errored: RevenueCat sends event types we do
    // not act on (TEST, TRANSFER, and others), and returning non-2xx would
    // have it retry them forever.
    response.status(200).json({ ignored: true, reason: 'unactionable_event' });
    return;
  }

  const supabase = createClient(config.url, config.key, { auth: { persistSession: false } });

  try {
    if (GRANTS.has(type)) {
      // `activate_verified_purchase` refuses a transaction with no purchase
      // row, which is what keeps a webhook for some other app's product from
      // granting anything here.
      const { error } = await supabase.rpc('activate_verified_purchase', {
        p_platform: platform,
        p_platform_transaction_id: transactionId,
        p_price_minor_units: typeof event.price_in_purchased_currency === 'number'
          ? Math.round(event.price_in_purchased_currency * 100)
          : null,
        p_currency: typeof event.currency === 'string' ? event.currency : null,
      });
      if (error) {
        // A transaction we have no row for is not our problem to retry.
        if (error.message?.includes('no purchase recorded')) {
          response.status(200).json({ ignored: true, reason: 'unknown_transaction' });
          return;
        }
        throw new Error(error.message);
      }
      response.status(200).json({ status: 'granted' });
      return;
    }

    const reversal = REVERSALS[type];
    if (reversal) {
      const { error } = await supabase.rpc('reverse_purchase', {
        p_platform: platform,
        p_platform_transaction_id: transactionId,
        p_status: reversal,
      });
      if (error) throw new Error(error.message);
      response.status(200).json({ status: reversal });
      return;
    }

    response.status(200).json({ ignored: true, reason: `unhandled_type_${type}` });
  } catch (error: any) {
    // Non-2xx asks RevenueCat to retry, which is what we want for a
    // transient database or network failure.
    console.error('[revenuecat-webhook]', type, error?.message);
    response.status(500).json({ error: 'webhook_failed' });
  }
}
