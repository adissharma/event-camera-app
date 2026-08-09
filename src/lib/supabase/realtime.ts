import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';

let instanceCounter = 0;

/**
 * A realtime channel whose topic is unique to this one subscription.
 *
 * `client.channel(topic)` does not always return a *new* channel: the client
 * keeps its channels in a registry keyed by topic, and hands back the existing
 * instance when a topic is already registered. `removeChannel()` meanwhile is
 * asynchronous — it has to unsubscribe over the socket before the registry
 * entry goes away.
 *
 * Those two facts combine badly with a screen that unmounts and immediately
 * remounts, which is exactly what navigating away from the camera and back to
 * the gallery does. The new mount asks for the same topic, receives the old
 * channel — still subscribed, because its teardown has not completed — and
 * calling `.on()` on a subscribed channel throws:
 *
 *     cannot add `postgres_changes` callbacks ... after `subscribe()`
 *
 * That throw happens inside the mount effect, which takes the whole screen
 * down and renders it blank.
 *
 * Giving every subscription its own topic removes the collision entirely,
 * rather than trying to win a race against an async teardown. The topic is
 * only a client-side routing key; what the server filters on is the
 * `postgres_changes` binding, which is unaffected.
 */
export function createUniqueChannel(
  client: SupabaseClient<Database>,
  prefix: string,
): RealtimeChannel {
  instanceCounter += 1;
  return client.channel(`${prefix}:${instanceCounter}`);
}
