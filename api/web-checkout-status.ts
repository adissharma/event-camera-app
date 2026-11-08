/**
 * The return page asking whether its payment has landed.
 *
 * Stripe redirects the host back with the Checkout Session id in the URL. That
 * id is only a key: this endpoint retrieves the session from Stripe itself,
 * checks it belongs to the signed-in host, and finalises it. The webhook does
 * the same independently, so a host who closes the tab straight after paying
 * still gets a published event — this just means the host who stays sees it
 * without waiting on the webhook.
 */
import {
  finaliseCheckoutSession,
  getStripe,
  getSupabaseAdmin,
  handleConfigError,
  readCheckoutMetadata,
  readJsonBody,
  requireUser,
  type ApiRequest,
  type ApiResponse,
} from './_lib/web-checkout';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const stripe = getStripe();

    const auth = await requireUser(supabase, request);
    if (!auth) {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }

    const body = readJsonBody(request);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      response.status(400).json({ error: 'session_id_required' });
      return;
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error: any) {
      if (error?.statusCode === 404) {
        response.status(404).json({ error: 'session_not_found' });
        return;
      }
      throw error;
    }

    // One host cannot learn about, or finalise, another host's checkout by
    // guessing its id.
    const metadata = readCheckoutMetadata(session);
    if (!metadata || metadata.userId !== auth.user.id) {
      response.status(403).json({ error: 'not_your_checkout' });
      return;
    }

    const result = await finaliseCheckoutSession(supabase, session);
    response.status(200).json(result);
  } catch (error: any) {
    if (handleConfigError('web-checkout-status', error, response)) return;
    console.error('[web-checkout-status]', error?.message);
    response.status(502).json({ error: 'status_unavailable' });
  }
}
