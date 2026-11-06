import { requireSupabase } from '@/lib/supabase/client';

/**
 * The host's own cap on how many guests can join an event.
 *
 * Read separately from the event's other session settings, so that a database
 * without this column yet costs this one control rather than the whole event page.
 * Goes through `any` until the generated types are next regenerated.
 */

export const eventGuestLimitKeys = {
  forSession: (eventSessionId: string) => ['event-guest-limit', eventSessionId] as const,
};

/** The host's number, or `null` if they have not set one. */
export async function fetchEventGuestLimit(eventSessionId: string): Promise<number | null> {
  const { data, error } = await (requireSupabase() as any)
    .from('event_sessions')
    .select('guest_limit')
    .eq('id', eventSessionId)
    .single();
  if (error) throw error;
  return (data as { guest_limit: number | null }).guest_limit;
}

export async function saveEventGuestLimit(
  eventSessionId: string,
  guestLimit: number | null,
): Promise<void> {
  const { error } = await (requireSupabase() as any)
    .from('event_sessions')
    .update({ guest_limit: guestLimit })
    .eq('id', eventSessionId);
  if (error) throw error;
}
