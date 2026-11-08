/**
 * Stripe webhook.
 *
 * Two jobs, the same two the RevenueCat webhook does for the App Store:
 *
 *  1. Grant what was paid for when the host never came back. A closed tab, a
 *     dead battery or a lost connection between paying and landing on the
 *     return page would otherwise leave a host charged with an unpublished
 *     draft. Stripe retries this webhook until it succeeds.
 *
 *  2. Take entitlements back on a refund or a lost dispute, which only ever
 *     arrive here.
 *
 * Authenticated by Stripe's signature over the raw body, so the body must be
 * read as bytes before anything parses it. Even then, the session is
 * re-retrieved from Stripe rather than trusted as delivered: the event is a
 * notification, Stripe's API is the record.
 *
 * Subscribe the endpoint to: checkout.session.completed,
 * checkout.session.async_payment_succeeded, charge.refunded,
 * charge.dispute.closed.
 */
import type Stripe from 'stripe';

import {
  finaliseCheckoutSession,
  getStripe,
  getSupabaseAdmin,
  handleConfigError,
  ConfigError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/web-checkout';

async function readRawBody(request: ApiRequest): Promise<Buffer> {
  // When a platform has already buffered the body, use those bytes as-is. A
  // parsed object cannot be re-serialised into the exact bytes Stripe signed.
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body);

  const chunks: Buffer[] = [];
  for await (const chunk of request as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/** The Checkout Session behind a charge, for refunds and disputes. */
async function sessionIdForPaymentIntent(
  stripe: Stripe,
  paymentIntent: string | Stripe.PaymentIntent | null,
): Promise<string | null> {
  const id = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;
  if (!id) return null;
  const sessions = await stripe.checkout.sessions.list({ payment_intent: id, limit: 1 });
  return sessions.data[0]?.id ?? null;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let event: Stripe.Event;
  let stripe: Stripe;
  try {
    stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ConfigError('missing_stripe_webhook_secret');

    const header = request.headers['stripe-signature'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) {
      response.status(400).json({ error: 'missing_signature' });
      return;
    }

    const raw = await readRawBody(request);
    try {
      event = stripe.webhooks.constructEvent(raw, signature, secret);
    } catch (error: any) {
      console.warn('[stripe-webhook] signature rejected', error?.message);
      response.status(400).json({ error: 'invalid_signature' });
      return;
    }
  } catch (error) {
    if (handleConfigError('stripe-webhook', error, response)) return;
    throw error;
  }

  try {
    const supabase = getSupabaseAdmin();

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
        const result = await finaliseCheckoutSession(supabase, session);
        response.status(200).json({ received: true, result: result.status });
        return;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        // A partial refund is a goodwill gesture, not a withdrawal of the
        // package. Only a full refund takes it back.
        if (!charge.refunded) {
          response.status(200).json({ received: true, ignored: 'partial_refund' });
          return;
        }
        const sessionId = await sessionIdForPaymentIntent(stripe, charge.payment_intent);
        if (sessionId) {
          const { error } = await supabase.rpc('reverse_purchase', {
            p_platform: 'web',
            p_platform_transaction_id: sessionId,
            p_status: 'refunded',
          });
          if (error) throw new Error(error.message);
        }
        response.status(200).json({ received: true, reversed: Boolean(sessionId) });
        return;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object;
        if (dispute.status !== 'lost') {
          response.status(200).json({ received: true, ignored: `dispute_${dispute.status}` });
          return;
        }
        const sessionId = await sessionIdForPaymentIntent(stripe, dispute.payment_intent);
        if (sessionId) {
          const { error } = await supabase.rpc('reverse_purchase', {
            p_platform: 'web',
            p_platform_transaction_id: sessionId,
            p_status: 'revoked',
          });
          if (error) throw new Error(error.message);
        }
        response.status(200).json({ received: true, reversed: Boolean(sessionId) });
        return;
      }

      default:
        // Acknowledged, never errored: a non-2xx makes Stripe retry an event
        // we will never act on.
        response.status(200).json({ received: true, ignored: event.type });
    }
  } catch (error: any) {
    if (handleConfigError('stripe-webhook', error, response)) return;
    // Non-2xx asks Stripe to retry, which is right for a transient failure.
    console.error('[stripe-webhook]', event.type, error?.message);
    response.status(500).json({ error: 'webhook_failed' });
  }
}
