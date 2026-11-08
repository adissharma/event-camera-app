import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import {
  MIN_DAYS_BETWEEN_ASKS,
  MIN_PHOTOS_TO_ASK,
  askForRatingOnce,
  canAskAgain,
  isRatingMoment,
} from './rating-prompt';

jest.mock('expo-constants', () => ({ expoConfig: { version: '1.1.0' } }));
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => undefined),
}));

/** A fixed clock, so nothing here depends on when it runs. */
const NOW = Date.parse('2026-11-04T09:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('isRatingMoment', () => {
  const ended = {
    now: NOW,
    endsAt: at(-HOUR),
    revealAt: at(-HOUR),
    revealMode: 'scheduled' as const,
    photoCount: MIN_PHOTOS_TO_ASK,
  };

  it('is true once an event with enough photos has ended and revealed', () => {
    expect(isRatingMoment(ended)).toBe(true);
  });

  it('is true when a live event ends', () => {
    expect(isRatingMoment({ ...ended, revealAt: null, revealMode: 'instant' })).toBe(true);
  });

  it('waits for the party to finish', () => {
    expect(isRatingMoment({ ...ended, endsAt: at(HOUR) })).toBe(false);
  });

  it('waits for the reveal, even though the host can already see the photos', () => {
    expect(isRatingMoment({ ...ended, revealAt: at(HOUR) })).toBe(false);
  });

  it('skips an event that hardly happened', () => {
    expect(isRatingMoment({ ...ended, photoCount: MIN_PHOTOS_TO_ASK - 1 })).toBe(false);
  });

  it('never fires for an open-ended event', () => {
    expect(isRatingMoment({ ...ended, endsAt: null })).toBe(false);
  });
});

describe('canAskAgain', () => {
  const asked = (daysAgo: number, appVersion: string | null) => ({ at: at(-daysAgo * DAY), appVersion });

  it('asks someone who has never been asked', () => {
    expect(canAskAgain(null, NOW, '1.1.0')).toBe(true);
  });

  it('never asks twice on one release', () => {
    expect(canAskAgain(asked(400, '1.1.0'), NOW, '1.1.0')).toBe(false);
  });

  it('holds off on a new release until the gap has passed', () => {
    expect(canAskAgain(asked(MIN_DAYS_BETWEEN_ASKS - 1, '1.0'), NOW, '1.1.0')).toBe(false);
  });

  it('asks again on a new release after the gap', () => {
    expect(canAskAgain(asked(MIN_DAYS_BETWEEN_ASKS, '1.0'), NOW, '1.1.0')).toBe(true);
  });
});

describe('askForRatingOnce', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (StoreReview.requestReview as jest.Mock).mockResolvedValue(undefined);
  });

  it('asks once, then stays quiet on the same release', async () => {
    await expect(askForRatingOnce(NOW)).resolves.toBe(true);
    await expect(askForRatingOnce(NOW + DAY)).resolves.toBe(false);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("doesn't use up the ask where Apple won't show the sheet", async () => {
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await expect(askForRatingOnce(NOW)).resolves.toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    await expect(askForRatingOnce(NOW)).resolves.toBe(true);
  });

  it('survives a build without the native module', async () => {
    (StoreReview.isAvailableAsync as jest.Mock).mockRejectedValueOnce(new Error('Cannot find native module'));

    await expect(askForRatingOnce(NOW)).resolves.toBe(false);
  });

  it('survives a failed request without asking again', async () => {
    (StoreReview.requestReview as jest.Mock).mockRejectedValueOnce(new Error('ERR_STORE_REVIEW_FAILED'));

    await expect(askForRatingOnce(NOW)).resolves.toBe(false);
    await expect(askForRatingOnce(NOW)).resolves.toBe(false);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('treats a corrupt record as never having asked', async () => {
    await AsyncStorage.setItem('rating-prompt:last-asked', 'not json');

    await expect(askForRatingOnce(NOW)).resolves.toBe(true);
  });
});
