/**
 * Shared server half of web checkout.
 *
 * Files under `api/_lib` are not routes — Vercel skips paths that start with
 * an underscore — so this is imported by the three endpoints that need it:
 *
 *   web-checkout         creates a Checkout Session for a draft event
 *   web-checkout-status  the return page asking whether its payment landed
 *   stripe-webhook       Stripe telling us, whether or not the host came back
 *
 * The rule all three keep: nothing the browser says about a payment is
 * believed. A session id from the browser is only ever a key to look the
 * session up *from Stripe*, and what Stripe returns is what decides.
 */
import Stripe from 'stripe';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export class ConfigError extends Error {}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ConfigError('missing_supabase_credentials');
  return createClient(url, key, { auth: { persistSession: false } });
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ConfigError('missing_stripe_secret_key');
  stripeClient ??= new Stripe(key, { appInfo: { name: 'Stills' }, ...localStripeApi() });
  return stripeClient;
}

/**
 * Points the client at a local stand-in for Stripe's API, for exercising the
 * whole checkout round trip on a laptop. Never honoured in production.
 */
function localStripeApi(): Partial<Stripe.StripeConfig> {
  const base = process.env.STRIPE_API_BASE;
  if (!base || process.env.VERCEL_ENV === 'production') return {};
  const url = new URL(base);
  return {
    host: url.hostname,
    port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    protocol: url.protocol === 'https:' ? 'https' : 'http',
  };
}

/** The signed-in host behind a request, from their Supabase access token. */
export async function requireUser(
  supabase: SupabaseClient,
  request: ApiRequest,
): Promise<{ user: User; accessToken: string } | null> {
  const header = request.headers.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  if (!authorization?.startsWith('Bearer ')) return null;
  const accessToken = authorization.slice('Bearer '.length);
  const { data } = await supabase.auth.getUser(accessToken);
  return data?.user ? { user: data.user, accessToken } : null;
}

export function readJsonBody(request: ApiRequest): Record<string, unknown> {
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body || '{}');
    } catch {
      return {};
    }
  }
  return (request.body as Record<string, unknown>) ?? {};
}

const PRODUCTION_ORIGIN = 'https://stills.events';

/**
 * Where Stripe sends the host back to.
 *
 * Never taken from the request on its own word in production: a return URL an
 * attacker could set is a phishing page with our Checkout in front of it. The
 * browser's origin is honoured only when it is one we serve, or on a preview
 * or local build where it is the only sensible answer.
 */
export function returnOrigin(request: ApiRequest): string {
  const configured = process.env.WEB_CHECKOUT_ORIGIN ?? PRODUCTION_ORIGIN;
  const header = request.headers.origin;
  const origin = Array.isArray(header) ? header[0] : header;
  if (!origin) return configured;

  const allowed = new Set([configured, PRODUCTION_ORIGIN, 'https://withstills.com']);
  if (allowed.has(origin)) return origin;

  const isProduction = process.env.VERCEL_ENV === 'production';
  if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (!isProduction && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return origin;

  return configured;
}

/** What our server wrote into the session when it created it. */
export interface CheckoutMetadata {
  celebrationId: string;
  userId: string;
  planKey: string;
}

export function readCheckoutMetadata(session: Stripe.Checkout.Session): CheckoutMetadata | null {
  const metadata = session.metadata ?? {};
  const celebrationId = metadata.celebration_id;
  const userId = metadata.user_id;
  const planKey = metadata.plan_key;
  if (!celebrationId || !userId || !planKey) return null;
  return { celebrationId, userId, planKey };
}

export type FinaliseResult =
  | { status: 'complete'; celebrationId: string; eventCode: string | null; planKey: string }
  | { status: 'awaiting_payment' }
  | { status: 'expired' }
  | { status: 'not_ours' };

/**
 * Turns a paid Checkout Session into a published event with its package.
 *
 * Safe to call any number of times for the same session — the webhook and the
 * return page both do, and Stripe retries the webhook — because
 * `complete_web_checkout` converges on the same state.
 */
export async function finaliseCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<FinaliseResult> {
  const metadata = readCheckoutMetadata(session);
  if (!metadata) return { status: 'not_ours' };

  if (session.status === 'expired') return { status: 'expired' };
  // `complete` with `unpaid` is a delayed method (a bank debit) still
  // clearing; `async_payment_succeeded` arrives at the webhook when it does.
  if (session.status !== 'complete' || session.payment_status !== 'paid') {
    return { status: 'awaiting_payment' };
  }

  const { data, error } = await supabase.rpc('complete_web_checkout', {
    p_celebration_id: metadata.celebrationId,
    p_user_id: metadata.userId,
    p_plan_key: metadata.planKey,
    p_checkout_session_id: session.id,
    p_amount_minor_units: session.amount_total ?? 0,
    p_currency: (session.currency ?? '').toUpperCase(),
  });

  if (error) throw new Error(`complete_web_checkout: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as
    | { celebration_id: string; event_code: string | null; plan_key: string }
    | undefined;

  return {
    status: 'complete',
    celebrationId: row?.celebration_id ?? metadata.celebrationId,
    eventCode: row?.event_code ?? null,
    planKey: row?.plan_key ?? metadata.planKey,
  };
}

export function handleConfigError(scope: string, error: unknown, response: ApiResponse): boolean {
  if (error instanceof ConfigError) {
    console.error(`[${scope}] configuration`, error.message);
    response.status(500).json({ error: 'server_misconfigured' });
    return true;
  }
  return false;
}
