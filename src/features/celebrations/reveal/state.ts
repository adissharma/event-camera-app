import type { RevealMode } from '@/types/database';

/**
 * When the photos become visible, and what the end-of-event modal should say.
 *
 * This module is the single answer to "can this person see the photos yet".
 * The gallery, the photo viewer and the reveal modal all read it. They used to
 * each re-derive the rule inline, which is how you end up with a modal that
 * announces the photos are ready over a gallery that is still locked.
 *
 * Pure functions, no clock of their own: every entry point takes `now` from the
 * caller so the reveal can be driven by server time rather than device time.
 */

export type RevealModalState = 'hidden' | 'awaiting_reveal' | 'revealed';

export interface RevealInputs {
  /** Server time in milliseconds. Never `Date.now()` at a call site. */
  now: number;
  /** `ends_at` on the session, ISO. */
  endsAt: string | null | undefined;
  /** `reveal_at` on the session, ISO. */
  revealAt: string | null | undefined;
  /** `reveal_mode` on the session. */
  revealMode: RevealMode | null | undefined;
}

/** Parses an ISO timestamp, treating anything unusable as absent. */
function timestamp(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Whether capture has closed.
 *
 * An event with no end time never ends — that is an open-ended event, not one
 * that ended at the epoch.
 */
export function isEventEnded({ now, endsAt }: Pick<RevealInputs, 'now' | 'endsAt'>): boolean {
  const ends = timestamp(endsAt);
  return ends !== null && now >= ends;
}

/**
 * Whether the photos are visible to whoever is asking.
 *
 * Only `scheduled` withholds anything. `instant` is visible throughout, and
 * `manual` is released by the host through a separate action — until they do,
 * `reveal_at` stays null and this stays false, which is the correct reading of
 * "not yet released" rather than "released at an unknown time".
 *
 * Deliberately not exempting the host. The existing gallery locks the host out
 * of a scheduled reveal too, and a modal that disagreed with the gallery it
 * sits on top of would be worse than one that is slightly conservative.
 */
export function canViewerSeePhotos({ now, revealAt, revealMode }: Omit<RevealInputs, 'endsAt'>): boolean {
  if (revealMode === 'scheduled') {
    const reveal = timestamp(revealAt);
    if (reveal === null) return false;
    return now >= reveal;
  }

  if (revealMode === 'manual') {
    // Released manually by writing a reveal time. No time, no release.
    const reveal = timestamp(revealAt);
    return reveal !== null && now >= reveal;
  }

  // 'instant', or a session predating the reveal feature.
  return true;
}

/**
 * Milliseconds until the photos unlock, or null when there is nothing to wait
 * for — either they are already visible, or no reveal time exists to count to.
 */
export function msUntilReveal({ now, revealAt, revealMode }: Omit<RevealInputs, 'endsAt'>): number | null {
  if (canViewerSeePhotos({ now, revealAt, revealMode })) return null;
  const reveal = timestamp(revealAt);
  if (reveal === null) return null;
  return Math.max(0, reveal - now);
}

/**
 * Which version of the end-of-event modal applies right now.
 *
 * `viewerCanSeePhotos` is passed in rather than computed here so the caller can
 * substitute a server-confirmed answer. The local calculation is a prediction;
 * the server's is the fact, and at the moment of reveal only the fact is
 * allowed to unblur anything.
 */
export function resolveRevealModalState(
  inputs: RevealInputs & { viewerCanSeePhotos?: boolean },
): RevealModalState {
  if (!isEventEnded(inputs)) return 'hidden';

  const canSee = inputs.viewerCanSeePhotos ?? canViewerSeePhotos(inputs);
  return canSee ? 'revealed' : 'awaiting_reveal';
}

/**
 * "2h 14m", to match the countdown copy.
 *
 * Floored at every step so the number never promises less waiting than there
 * is. Under a minute reads as "under a minute" rather than counting seconds —
 * a seconds display invites staring at it, and the transition happens on its
 * own anyway.
 */
export function formatRevealCountdown(ms: number): string {
  if (ms <= 0) return 'any moment now';

  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return 'under a minute';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

/**
 * "3 days" / "5 hours" / "20 minutes", for the lock overlay on a blurred
 * thumbnail. Single largest unit only — the grid cell is too small for the
 * combined "2d 4h" the countdown modal uses, and one number reads faster at
 * that size anyway.
 */
export function formatRevealCountdownWords(ms: number): string {
  if (ms <= 0) return 'any moment now';

  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return 'under a minute';

  const days = Math.floor(totalMinutes / 1440);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;

  const hours = Math.floor(totalMinutes / 60);
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;

  return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
}
