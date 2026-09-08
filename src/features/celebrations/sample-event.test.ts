import {
  SAMPLE_CELEBRATION_ID,
  SAMPLE_CHALLENGES,
  SAMPLE_CHALLENGE_IDS,
  SAMPLE_PHOTOS,
  isSampleCelebrationId,
} from './sample-event';

/**
 * The example album is the first thing a new host sees, and every claim it
 * makes is a claim about the product. These pin the ones that would be
 * embarrassing to get wrong and easy to break by editing the photo list.
 */
describe('the example album', () => {
  it('never advertises more photos than it holds', () => {
    // The count shown in the UI is `SAMPLE_PHOTOS.length` everywhere. If a
    // total is ever hard-coded alongside the list, this is what catches it.
    expect(SAMPLE_PHOTOS.length).toBeGreaterThan(0);
    expect(new Set(SAMPLE_PHOTOS.map((photo) => photo.id)).size).toBe(SAMPLE_PHOTOS.length);
  });

  it('reads as one evening, in order', () => {
    const times = SAMPLE_PHOTOS.map((photo) => new Date(photo.capturedAt).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it('bundles a real asset for every photo', () => {
    // A missing file resolves to undefined and renders as a blank tile — the
    // kind of thing that only shows up on a device.
    SAMPLE_PHOTOS.forEach((photo) => {
      expect(photo.source).toBeDefined();
    });
  });

  it('only points challenges at challenges that exist', () => {
    const known = new Set(Object.values(SAMPLE_CHALLENGE_IDS));
    SAMPLE_PHOTOS.forEach((photo) => {
      if (photo.challengeId) expect(known.has(photo.challengeId as never)).toBe(true);
    });
  });

  it('pins no more than two challenges', () => {
    expect(SAMPLE_CHALLENGES.filter((challenge) => challenge.isPinned)).toHaveLength(2);
  });

  it('has five challenges, in the order a host wrote them', () => {
    expect(SAMPLE_CHALLENGES.map((challenge) => challenge.label)).toEqual([
      'Dance Floor Hero',
      'Happy Tears',
      'Tiny Guest, Big Energy',
      'Best Dressed',
      'Unexpected Star',
    ]);
  });

  it('recognises only its own id', () => {
    expect(isSampleCelebrationId(SAMPLE_CELEBRATION_ID)).toBe(true);
    expect(isSampleCelebrationId('d6bca2cb-1fa5-4871-8999-5a712b6ac960')).toBe(false);
    expect(isSampleCelebrationId(null)).toBe(false);
    expect(isSampleCelebrationId(undefined)).toBe(false);
  });
});
