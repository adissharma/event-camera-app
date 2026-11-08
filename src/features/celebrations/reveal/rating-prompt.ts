import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { RevealMode } from '@/types/database';
import { canViewerSeePhotos, isEventEnded } from './state';

/**
 * When to ask a host for an App Store rating.
 *
 * The moment is the morning after: the event is over, the photos are out and
 * the host is looking at them. Everything here decides whether this is that
 * moment. Apple's sheet decides for itself whether to appear at all, and never
 * says whether it did, so asking is all we can do and all we can record.
 */

/** Fewer than this and the event didn't really happen, so there's nothing to feel good about. */
export const MIN_PHOTOS_TO_ASK = 10;

/**
 * Apple shows the sheet at most three times in 365 days. Spacing the requests
 * this far apart means none of the three is wasted on a host who just said no.
 */
export const MIN_DAYS_BETWEEN_ASKS = 122;

const DAY_MS = 86_400_000;
const STORAGE_KEY = 'rating-prompt:last-asked';

export interface RatingMomentInputs {
  /** Server time in milliseconds, as for the rest of the reveal. */
  now: number;
  endsAt: string | null | undefined;
  revealAt: string | null | undefined;
  revealMode: RevealMode | null | undefined;
  photoCount: number;
}

/**
 * Whether the event has reached its happy ending.
 *
 * Reads the guests' rule rather than the host's. A host can always see the
 * photos, so an event still locked for everyone else hasn't had its reveal yet.
 */
export function isRatingMoment({ now, endsAt, revealAt, revealMode, photoCount }: RatingMomentInputs): boolean {
  return (
    photoCount >= MIN_PHOTOS_TO_ASK &&
    isEventEnded({ now, endsAt }) &&
    canViewerSeePhotos({ now, revealAt, revealMode })
  );
}

export interface LastAsked {
  /** ISO. */
  at: string;
  appVersion: string | null;
}

/** Once per release, and never sooner than the gap above. */
export function canAskAgain(lastAsked: LastAsked | null, now: number, appVersion: string | null): boolean {
  if (!lastAsked) return true;
  if (lastAsked.appVersion === appVersion) return false;

  const askedAt = new Date(lastAsked.at).getTime();
  if (!Number.isFinite(askedAt)) return true;
  return now - askedAt >= MIN_DAYS_BETWEEN_ASKS * DAY_MS;
}

async function readLastAsked(): Promise<LastAsked | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastAsked;
  } catch {
    // Corrupt. Asking one extra time beats never asking again.
    return null;
  }
}

/**
 * Asks, if we're allowed to. Resolves to whether the request was made.
 *
 * The native module is imported here rather than at the top of the file because
 * this screen also runs in builds without it: an over-the-air update to an older
 * binary, or the current dev client. There, this quietly does nothing. A rating
 * is never worth breaking the host's gallery for, so nothing here may throw.
 */
export async function askForRatingOnce(now: number): Promise<boolean> {
  try {
    const appVersion = Constants.expoConfig?.version ?? null;
    if (!canAskAgain(await readLastAsked(), now, appVersion)) return false;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StoreReview = require('expo-store-review') as typeof import('expo-store-review');
    // False on TestFlight, where Apple doesn't allow the sheet.
    if (!(await StoreReview.isAvailableAsync())) return false;

    // Recorded first, so a failed request can't turn into repeated attempts.
    const record: LastAsked = { at: new Date(now).toISOString(), appVersion };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));

    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
