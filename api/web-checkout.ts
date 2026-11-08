/**
 * Starts a Stripe Checkout Session for an event drafted on the web.
 *
 * The browser sends only which draft and which package. Everything that
 * decides what is charged — the price, the currency, who is paying, which
 * event it is for — is looked up here and written into the session by us, so
 * Stripe hands back a record the browser never had a chance to edit.
 *
 * Hosted Checkout rather than an embedded form: it carries Apple Pay, Google
 * Pay, Link and cards with 3-D Secure, and it keeps card data off our pages.
 */
import {
  getStripe,
  getSupabaseAdmin,
  handleConfigError,
  readJsonBody,
  requireUser,
  returnOrigin,
  type ApiRequest,
  type ApiResponse,
} from './_lib/web-checkout';

/** The database's refusals, as the HTTP answers the browser understands. */
const QUOTE_REFUSALS: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: 'event_not_found' },
  '42501': { status: 403, error: 'not_your_event' },
  '23505': { status: 409, error: 'event_already_published' },
  '22023': { status: 400, error: 'unknown_plan' },
};

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
    const { user } = auth;

    const body = readJsonBody(request);
    const celebrationId = typeof body.celebrationId === 'string' ? body.celebrationId : '';
    const planKey = typeof body.planKey === 'string' ? body.planKey : '';
    if (!celebrationId || !planKey) {
      response.status(400).json({ error: 'celebration_and_plan_required' });
      return;
    }

    // Asked of the database before Stripe is involved: that the draft exists,
    // that this host may publish it, and what its package costs. Charging a
    // host for an event they cannot then publish would be the worst outcome.
    const { data: quoteRows, error: quoteError } = await supabase.rpc('web_checkout_quote', {
      p_celebration_id: celebrationId,
      p_user_id: user.id,
      p_plan_key: planKey,
    });

    if (quoteError) {
      const refusal = QUOTE_REFUSALS[quoteError.code ?? ''];
      if (refusal) {
        response.status(refusal.status).json({ error: refusal.error });
        return;
      }
      throw new Error(`web_checkout_quote: ${quoteError.message}`);
    }

    const quote = (Array.isArray(quoteRows) ? quoteRows[0] : quoteRows) as
      | { title: string; plan_key: string; plan_name: string; price_minor_units: number; currency: string }
      | undefined;
    if (!quote) throw new Error('web_checkout_quote returned nothing');

    const origin = returnOrigin(request);
    const metadata = {
      celebration_id: celebrationId,
      user_id: user.id,
      plan_key: quote.plan_key,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(quote.currency).toLowerCase(),
            unit_amount: quote.price_minor_units,
            product_data: {
              name: `${quote.plan_name} package`,
              description: `For “${quote.title}”`,
            },
          },
        },
      ],
      customer_email: user.email ?? undefined,
      client_reference_id: celebrationId,
      metadata,
      payment_intent_data: { metadata },
      // Lets the host finish later from the same link without the session
      // lingering for a full day against a draft they may have abandoned.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      success_url: `${origin}/host/created?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/host/new?checkout=cancelled`,
    });

    if (!session.url) throw new Error('checkout_session_without_url');

    response.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    if (handleConfigError('web-checkout', error, response)) return;
    console.error('[web-checkout]', error?.message);
    response.status(502).json({ error: 'checkout_unavailable' });
  }
}
