/**
 * Server-side receipt verification.
 *
 * The client cannot be trusted to say what it bought, so nothing it sends is
 * taken at face value. The only thing it supplies is a transaction id; this
 * endpoint asks RevenueCat what that transaction actually is, and grants the
 * tier only if RevenueCat confirms it against Apple.
 *
 * RevenueCat rather than Apple directly because it already performs the
 * Apple-side verification (JWS signature, certificate chain, environment),
 * and the SDK is already the purchase path on device. The trade is a hard
 * dependency on RevenueCat for granting a paid entitlement — which is the
 * correct failure mode: if we cannot confirm a purchase, we do not grant it.
 *
 * The webhook in `revenuecat-webhook.ts` covers the same ground
 * asynchronously, so a client that dies between paying and calling this
 * endpoint still gets what it paid for.
 */
import { createClient } from '@supabase/supabase-js';

const REVENUECAT_API = 'https://api.revenuecat.com/v1';

type PurchasePlatform = 'apple_app_store' | 'google_play' | 'web';

function getConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const revenueCatKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!url || !key) throw new Error('missing_supabase_credentials');
  if (!revenueCatKey) throw new Error('missing_revenuecat_secret_key');
  return { url, key, revenueCatKey };
}

/**
 * The transactions RevenueCat holds for one app user.
 *
 * These tiers are consumables, so they land under `non_subscriptions` — a map
 * of product id to an array of purchase records, each carrying the store's
 * own transaction id. A subscription would need `entitlements` instead.
 */
async function fetchRevenueCatTransactions(
  appUserId: string,
  revenueCatKey: string,
): Promise<Map<string, { productId: string; purchasedAt: string }>> {
  const response = await fetch(
    `${REVENUECAT_API}/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${revenueCatKey}`, Accept: 'application/json' } },
  );

  if (response.status === 404) return new Map();
  if (!response.ok) {
    // A RevenueCat outage must not become a free tier. Throwing here surfaces
    // as a 502 and the client retries; the webhook is the other way in.
    throw new Error(`revenuecat_lookup_failed_${response.status}`);
  }

  const body = (await response.json()) as {
    subscriber?: { non_subscriptions?: Record<string, Array<{ id?: string; store_transaction_id?: string; purchase_date?: string }>> };
  };

  const found = new Map<string, { productId: string; purchasedAt: string }>();
  for (const [productId, records] of Object.entries(body.subscriber?.non_subscriptions ?? {})) {
    for (const record of records ?? []) {
      // RevenueCat exposes the store's transaction id as
      // `store_transaction_id`; `id` is RevenueCat's own. Index both so a
      // client reporting either one is recognised.
      for (const id of [record.store_transaction_id, record.id]) {
        if (id) found.set(id, { productId, purchasedAt: record.purchase_date ?? '' });
      }
    }
  }
  return found;
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let config;
  try {
    config = getConfig();
  } catch (error: any) {
    console.error('[verify-purchase] configuration', error?.message);
    response.status(500).json({ error: 'server_misconfigured' });
    return;
  }

  const authorization: string | undefined = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  const supabase = createClient(config.url, config.key, { auth: { persistSession: false } });

  const { data: userData } = await supabase.auth.getUser(authorization.slice('Bearer '.length));
  const user = userData?.user;
  if (!user) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body ?? {});
  const transactionId: string | undefined = body.transactionId;
  const platform: PurchasePlatform = body.platform === 'google_play' ? 'google_play' : 'apple_app_store';

  if (!transactionId || typeof transactionId !== 'string') {
    response.status(400).json({ error: 'transaction_id_required' });
    return;
  }

  // The purchase row must already exist and must belong to THIS user. Written
  // by `publish_celebration` / `upgrade_celebration_plan` before the client
  // gets here, so its absence means the transaction is not ours — and the
  // ownership check stops one user verifying another's transaction onto their
  // own event.
  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, celebration_id, purchased_by, platform, platform_product_id, status')
    .eq('platform', platform)
    .eq('platform_transaction_id', transactionId)
    .maybeSingle();

  if (!purchase) {
    response.status(404).json({ error: 'purchase_not_recorded' });
    return;
  }
  if (purchase.purchased_by !== user.id) {
    response.status(403).json({ error: 'not_your_purchase' });
    return;
  }
  if (purchase.status === 'verified') {
    response.status(200).json({ status: 'verified', alreadyVerified: true });
    return;
  }

  // RevenueCat is keyed by app user id, which the client sets to the Supabase
  // user id at sign-in (`Purchases.logIn`). Looking it up from the token
  // rather than from the request body is what stops a caller claiming
  // somebody else's purchases.
  let transactions: Map<string, { productId: string; purchasedAt: string }>;
  try {
    transactions = await fetchRevenueCatTransactions(user.id, config.revenueCatKey);
  } catch (error: any) {
    console.error('[verify-purchase] revenuecat', error?.message);
    response.status(502).json({ error: 'verification_unavailable' });
    return;
  }

  const match = transactions.get(transactionId);
  if (!match) {
    response.status(402).json({ error: 'purchase_not_verified' });
    return;
  }

  // The product RevenueCat confirms must be the product we recorded, or a
  // cheap transaction could be redeemed against an expensive tier.
  if (purchase.platform_product_id && match.productId !== purchase.platform_product_id) {
    console.error('[verify-purchase] product mismatch', {
      recorded: purchase.platform_product_id,
      verified: match.productId,
    });
    response.status(409).json({ error: 'product_mismatch' });
    return;
  }

  const { error: activateError } = await supabase.rpc('activate_verified_purchase', {
    p_platform: platform,
    p_platform_transaction_id: transactionId,
  });

  if (activateError) {
    console.error('[verify-purchase] activation', activateError.message);
    response.status(500).json({ error: 'activation_failed' });
    return;
  }

  response.status(200).json({ status: 'verified', celebrationId: purchase.celebration_id });
}
