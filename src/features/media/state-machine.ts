import type { MediaStatus } from '@/types/database';

/**
 * The media lifecycle, as an explicit state machine.
 *
 * This exists because the upload pipeline is the part of the product most
 * likely to corrupt data quietly. A guest's photograph passes through a dozen
 * states across an unreliable venue network, and the failure that matters is
 * not a crash — it is a photograph that silently ends up in a state nobody
 * reconciles, and is lost.
 *
 * Encoding transitions here means an illegal move is a caught error rather than
 * an inconsistent row.
 */

/** Legal successor states for each status. */
const TRANSITIONS: Record<MediaStatus, readonly MediaStatus[]> = {
  // Captured and persisted locally; no server record yet.
  local_pending: ['upload_authorising', 'deleted'],

  // Requesting an upload intent.
  upload_authorising: ['queued', 'retryable_failed', 'permanent_failed', 'deleted'],

  // Authorised, waiting for a transfer slot.
  queued: ['uploading', 'paused', 'retryable_failed', 'permanent_failed', 'deleted'],

  // Bytes in flight.
  uploading: ['uploaded', 'paused', 'retryable_failed', 'permanent_failed', 'deleted'],

  // User paused, or the network dropped.
  paused: ['queued', 'uploading', 'retryable_failed', 'permanent_failed', 'deleted'],

  // Transfer finished; the server has not yet confirmed the object.
  uploaded: ['verifying', 'retryable_failed', 'permanent_failed', 'deleted'],

  // Server checking existence, path, size, MIME type and checksum.
  verifying: ['processing', 'retryable_failed', 'permanent_failed', 'deleted'],

  // Deriving thumbnails and previews.
  processing: ['ready', 'retryable_failed', 'permanent_failed', 'deleted'],

  // Terminal success. May still be hidden by a moderator or deleted.
  ready: ['hidden', 'deleted'],

  // A transient failure. Returns to the queue on retry.
  //
  // It may also go straight to permanent_failed once the attempt budget is
  // exhausted — without that edge, an item that keeps failing would cycle
  // through queued forever instead of surfacing to the user.
  retryable_failed: ['queued', 'upload_authorising', 'permanent_failed', 'deleted'],

  // Terminal failure. Only removal remains.
  permanent_failed: ['deleted'],

  // Withheld by moderation. Reversible.
  hidden: ['ready', 'deleted'],

  // Terminal.
  deleted: [],
};

/** Statuses from which no further progress is possible. */
export const TERMINAL_STATUSES: readonly MediaStatus[] = ['ready', 'permanent_failed', 'deleted'];

/** Statuses where the item still owes work to the upload pipeline. */
export const IN_FLIGHT_STATUSES: readonly MediaStatus[] = [
  'upload_authorising',
  'queued',
  'uploading',
  'paused',
  'uploaded',
  'verifying',
  'processing',
];

export function canTransition(from: MediaStatus, to: MediaStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: MediaStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isInFlight(status: MediaStatus): boolean {
  return IN_FLIGHT_STATUSES.includes(status);
}

/**
 * True when the local file may be removed.
 *
 * Deliberately strict: the local copy is deleted ONLY after the server has
 * verified the object. Deleting at upload-completion looks equivalent and is
 * not — an upload can complete while the object is unreadable or truncated, and
 * at that point the only remaining copy has already been thrown away.
 */
export function canDiscardLocalFile(status: MediaStatus): boolean {
  return status === 'ready' || status === 'hidden' || status === 'deleted';
}

export class IllegalMediaTransitionError extends Error {
  constructor(
    readonly from: MediaStatus,
    readonly to: MediaStatus,
  ) {
    super(`Illegal media transition: ${from} → ${to}`);
    this.name = 'IllegalMediaTransitionError';
  }
}

/** Returns `to`, or throws if the transition is not permitted. */
export function assertTransition(from: MediaStatus, to: MediaStatus): MediaStatus {
  if (!canTransition(from, to)) {
    throw new IllegalMediaTransitionError(from, to);
  }
  return to;
}

/** Every status reachable from `from` in any number of steps. */
export function reachableFrom(from: MediaStatus): Set<MediaStatus> {
  const seen = new Set<MediaStatus>();
  const queue: MediaStatus[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of TRANSITIONS[current]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
