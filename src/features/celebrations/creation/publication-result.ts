import type { PublishedEvent } from '@/services/publication';

/**
 * Hand-off between publication and the success screen.
 *
 * Deliberately module-scoped rather than passed as route params. The guest URL
 * contains the access token, and a route param becomes a visible URL on web and
 * is recorded in navigation history — a bearer credential does not belong in
 * either. The token is unrecoverable once lost (only its digest is stored), so
 * it is held in memory for exactly as long as the success screen needs it.
 */
let lastPublished: PublishedEvent | null = null;

export function setPublicationResult(result: PublishedEvent): void {
  lastPublished = result;
}

export function getPublicationResult(): PublishedEvent | null {
  return lastPublished;
}

export function clearPublicationResult(): void {
  lastPublished = null;
}
