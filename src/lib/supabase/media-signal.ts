/**
 * "Something in this event's gallery changed" — as a broadcast, not a table
 * subscription.
 *
 * WHY NOT `postgres_changes`
 * -------------------------
 * The gallery already subscribes to `postgres_changes` on `media_items`, and
 * for a host that works. For a guest it is structurally dead: Supabase
 * evaluates RLS per subscriber, and `media_items` has exactly one SELECT
 * policy, granted to `authenticated`. Guests are `anon` — they read the
 * gallery through the `get_guest_gallery` security-definer RPC, gated by a
 * guest token rather than a row policy — so every change event is filtered
 * out before it reaches them. The subscription succeeds and then silently
 * delivers nothing, forever.
 *
 * The obvious repair, an `anon` SELECT policy on `media_items`, would be a
 * data leak: a guest's identity lives in a token, not in a JWT claim, so no
 * row policy can tell one guest from any anonymous caller. The policy would
 * have to be `using (true)`.
 *
 * So the SIGNAL travels instead of the data. A broadcast carries no rows and
 * so leaks nothing; each device then refetches through the authorised path it
 * already uses — the RPC for a guest, the table for a host. One shared source
 * of truth, reached by two different doors.
 *
 * This complements rather than replaces the existing subscription and the
 * 10-second poll: broadcast makes the common case immediate, and the poll
 * remains the backstop for a dropped socket.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireSupabase, isBackendConfigured } from './client';

const EVENT_NAME = 'media_changed';

/**
 * All devices watching one event meet on this topic.
 *
 * Keyed on the event CODE rather than the session id because that is the one
 * identifier both ends already hold: the upload path is given an event code
 * and never learns the session id, while the gallery has both.
 */
function topicFor(eventCode: string): string {
  return `event-media:${eventCode}`;
}

/**
 * Tells every other device that this event's media changed.
 *
 * Deliberately best-effort: a failure here must never fail an upload that has
 * already succeeded. The photo is saved either way, and the other devices
 * still pick it up on their next poll — this only decides whether that takes
 * a moment or up to ten seconds.
 */
export async function signalMediaChanged(eventCode: string | null | undefined): Promise<void> {
  if (!eventCode || !isBackendConfigured) return;

  let client: SupabaseClient;
  try {
    client = requireSupabase();
  } catch {
    return;
  }

  const channel = client.channel(topicFor(eventCode));
  try {
    await new Promise<void>((resolve) => {
      // Sending requires a subscribed channel, so this one is opened purely to
      // speak and then closed again.
      const timeout = setTimeout(resolve, 3000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    await channel.send({
      type: 'broadcast',
      event: EVENT_NAME,
      payload: { eventCode, at: Date.now() },
    });
  } catch (error) {
    console.warn('[media-signal] could not announce media change', error);
  } finally {
    void client.removeChannel(channel);
  }
}

/**
 * Subscribes to media-change announcements for one event session.
 *
 * Returns an unsubscribe function, or a no-op when there is no backend.
 */
export function subscribeToMediaChanges(
  eventCode: string,
  onChange: () => void,
): () => void {
  if (!isBackendConfigured) return () => {};

  let client: SupabaseClient;
  try {
    client = requireSupabase();
  } catch {
    return () => {};
  }

  const channel = client
    .channel(topicFor(eventCode))
    // `self: false` — the device that took the photo already updated itself.
    .on('broadcast', { event: EVENT_NAME }, () => onChange())
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
