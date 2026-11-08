/**
 * The browser's half of creating and paying for an event on the web.
 *
 *   1. `prepareWebEvent`  creates the server draft (once) and uploads the cover
 *   2. `startCheckout`    asks our server for a Stripe Checkout page, then the
 *                         browser goes there
 *   3. `checkCheckout`    the return page asking our server whether it landed
 *
 * Free events skip 2 and 3 and publish straight away with
 * `publishFreeWebEvent`, the same call the app makes for the free tier.
 *
 * Nothing here can grant a package. The browser only ever names a draft and a
 * plan; the server decides the price and Stripe confirms the payment.
 */
import { requireSupabase } from '@/lib/supabase/client';
import type { CreationDraft } from '@/features/celebrations/draft/types';
import { buildGuestUrl, createServerDraft, PublicationError, uploadCover } from './publication';

const HANDOFF_PREFIX = 'stills:web-created:';

/**
 * What the confirmation page needs and cannot get back from the server.
 *
 * The guest link's token exists in plaintext only at the moment the draft is
 * created — the database keeps a digest — and the browser is about to leave
 * for Stripe. Kept in this browser's storage so the page Stripe returns to can
 * still show the host their link.
 */
export interface WebEventHandoff {
  celebrationId: string;
  guestToken: string;
  title: string;
  endsAt: string | null;
  timezone: string;
  themeSlug: string | null;
  coverStoragePath: string | null;
  planKey: string | null;
  /** Which answers this draft was built from. See `draftFingerprint`. */
  fingerprint?: string;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveHandoff(handoff: WebEventHandoff) {
  try {
    storage()?.setItem(HANDOFF_PREFIX + handoff.celebrationId, JSON.stringify(handoff));
  } catch {
    // Private windows can refuse storage. The confirmation page copes without
    // it; it just cannot show the guest link.
  }
}

export function readHandoff(celebrationId: string): WebEventHandoff | null {
  try {
    const raw = storage()?.getItem(HANDOFF_PREFIX + celebrationId);
    return raw ? (JSON.parse(raw) as WebEventHandoff) : null;
  } catch {
    return null;
  }
}

export function guestUrlFromHandoff(handoff: WebEventHandoff | null, eventCode: string | null) {
  if (!eventCode) return null;
  return handoff?.guestToken ? buildGuestUrl(eventCode, handoff.guestToken) : null;
}

/**
 * Everything the server draft is built from. When it matches the draft a
 * previous attempt created, that row is reused; when the host has changed
 * anything since, a fresh draft is made rather than patching the old one field
 * by field. Drafts are never listed anywhere, so the old row costs nothing.
 */
function draftFingerprint(draft: CreationDraft): string {
  const { createdAt, updatedAt, serverCelebrationId, editCelebrationId, editSessionId, userId, ...rest } = draft;
  void createdAt; void updatedAt; void serverCelebrationId; void editCelebrationId; void editSessionId; void userId;
  return JSON.stringify(rest);
}

/**
 * Creates the server-side draft if this journey has not already, and uploads
 * the cover. Returns the celebration id.
 *
 * Reuses `existingCelebrationId` when it still refers to an unpublished draft
 * built from the same answers, so a host who backs out of Stripe and tries
 * again does not leave a second event behind.
 */
export async function prepareWebEvent(
  draft: CreationDraft,
  existingCelebrationId: string | null,
): Promise<string> {
  const client = requireSupabase();
  const fingerprint = draftFingerprint(draft);

  if (existingCelebrationId) {
    const previous = readHandoff(existingCelebrationId);
    if (previous?.fingerprint === fingerprint) {
      const { data } = await client
        .from('celebrations')
        .select('id, status')
        .eq('id', existingCelebrationId)
        .is('deleted_at', null)
        .maybeSingle();
      if (data?.status === 'draft') return data.id;
    }
  }

  const created = await createServerDraft(draft);
  const celebrationId = created.celebrationId;
  const handoff: WebEventHandoff = {
    celebrationId,
    guestToken: created.guestAccessToken,
    title: draft.title.trim(),
    endsAt: draft.endsAt,
    timezone: draft.timezone,
    themeSlug: draft.themeSlug,
    coverStoragePath: null,
    planKey: draft.planKey,
    fingerprint,
  };
  saveHandoff(handoff);

  if (draft.coverLocalUri) {
    const path = await uploadCover(draft.coverLocalUri, celebrationId);
    saveHandoff({ ...handoff, coverStoragePath: path });
  }

  return celebrationId;
}

/**
 * Whether a draft this browser remembers has since become a live event — paid
 * for in a tab that closed before Stripe sent it back, and published by the
 * webhook. Null when it is still a draft, or not this account's to see.
 */
export async function findPublishedEvent(
  celebrationId: string,
): Promise<{ id: string; title: string } | null> {
  const client = requireSupabase();
  const { data } = await client
    .from('celebrations')
    .select('id, title, status')
    .eq('id', celebrationId)
    .is('deleted_at', null)
    .maybeSingle();
  return data && data.status !== 'draft' ? { id: data.id, title: data.title } : null;
}

export async function publishFreeWebEvent(celebrationId: string, planKey: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('publish_celebration', {
    p_celebration_id: celebrationId,
    p_plan_key: planKey,
    p_add_on_keys: [],
    p_platform: 'web',
  });
  if (error) throw new PublicationError(error.message, 'publish');
  const published = data as unknown as { event_code: string };
  return { eventCode: published.event_code };
}

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new PublicationError('Sign in again to continue.', 'purchase');

  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PublicationError('We could not reach our server. Check your connection and try again.', 'purchase');
  }

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new PublicationError(checkoutErrorMessage(payload.error), 'purchase');
  }
  return payload;
}

function checkoutErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'event_already_published':
      return 'This event has already been created.';
    case 'not_your_event':
    case 'not_your_checkout':
      return 'This event belongs to a different account.';
    case 'unauthorized':
      return 'Sign in again to continue.';
    default:
      return 'Payment is unavailable right now. Nothing has been charged — please try again in a moment.';
  }
}

export async function startCheckout(celebrationId: string, planKey: string): Promise<string> {
  const { url } = await authedPost<{ url: string }>('/api/web-checkout', { celebrationId, planKey });
  return url;
}

export type CheckoutStatus =
  | { status: 'complete'; celebrationId: string; eventCode: string | null; planKey: string }
  | { status: 'awaiting_payment' }
  | { status: 'expired' }
  | { status: 'not_ours' };

export function checkCheckout(sessionId: string): Promise<CheckoutStatus> {
  return authedPost<CheckoutStatus>('/api/web-checkout-status', { sessionId });
}
