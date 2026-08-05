import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which end-of-event moments this person has already had.
 *
 * Two milestones, tracked independently:
 *
 *   1. the event ended        → `eventEndedModalSeenAt`
 *   2. the photos were released → `photosRevealedModalSeenAt`
 *
 * Independent because they are different news. Someone who saw "your event has
 * ended, photos unlock in six hours" has not yet been told the photos are
 * ready, and collapsing both into one "seen the modal" flag would silently eat
 * the second — the one that actually matters.
 *
 * Scoped per viewer as well as per event: a host and a guest on the same phone
 * (which happens constantly in development, and via account switching in the
 * wild) each deserve their own reveal.
 */

export interface RevealAcknowledgement {
  /** ISO, or null if this person has not seen the awaiting-reveal modal. */
  eventEndedModalSeenAt: string | null;
  /** ISO, or null if this person has not seen the revealed modal. */
  photosRevealedModalSeenAt: string | null;
}

export type RevealMilestone = keyof RevealAcknowledgement;

const EMPTY: RevealAcknowledgement = {
  eventEndedModalSeenAt: null,
  photosRevealedModalSeenAt: null,
};

/**
 * `reveal-ack:<viewer>:<celebration>`.
 *
 * The viewer segment is the signed-in user id, or the guest session id, or
 * `anon`. It only has to be stable for as long as the identity is — a guest who
 * clears their session is a new person as far as this is concerned, and showing
 * them the reveal again is the right failure.
 */
function storageKey(viewerId: string, celebrationId: string): string {
  return `reveal-ack:${viewerId}:${celebrationId}`;
}

export async function readAcknowledgement(
  viewerId: string,
  celebrationId: string,
): Promise<RevealAcknowledgement> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(viewerId, celebrationId));
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw) as Partial<RevealAcknowledgement>;
    return {
      eventEndedModalSeenAt: parsed.eventEndedModalSeenAt ?? null,
      photosRevealedModalSeenAt: parsed.photosRevealedModalSeenAt ?? null,
    };
  } catch {
    // Corrupt or unreadable. Treating it as "nothing seen" shows the modal one
    // extra time, which is a far better failure than suppressing the reveal.
    return EMPTY;
  }
}

/**
 * Records a milestone as seen.
 *
 * Read-modify-write rather than a blind overwrite, so marking the revealed
 * milestone cannot erase the record of the ended one.
 */
export async function markAcknowledged(
  viewerId: string,
  celebrationId: string,
  milestone: RevealMilestone,
): Promise<RevealAcknowledgement> {
  const current = await readAcknowledgement(viewerId, celebrationId);

  // Already recorded. Keep the original timestamp — when they first saw it is
  // more useful than when they last dismissed it.
  if (current[milestone]) return current;

  const next: RevealAcknowledgement = {
    ...current,
    [milestone]: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(storageKey(viewerId, celebrationId), JSON.stringify(next));
  } catch {
    // Non-fatal. The modal reappearing next launch beats blocking the dismissal.
  }

  return next;
}

/** Test seam, and the path a "show me that again" debug action would take. */
export async function clearAcknowledgement(
  viewerId: string,
  celebrationId: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(viewerId, celebrationId));
  } catch {
    // Nothing to do — the caller cannot act on this either.
  }
}
