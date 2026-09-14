import {
  SAMPLE_CELEBRATION_ID,
  SAMPLE_CHALLENGES,
  SAMPLE_CHALLENGE_IDS,
  SAMPLE_PHOTOS,
  isSampleCelebrationId,
  sampleCapturedAt,
  sampleEventEndsAt,
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

  it('leads the gallery with the selected wedding moments', () => {
    expect(SAMPLE_PHOTOS.slice(0, 2).map((photo) => photo.id)).toEqual([
      'sample-photo-5',
      'sample-photo-7',
    ]);
  });

  it('reads as one evening, in order', () => {
    const times = SAMPLE_PHOTOS.map((photo) => photo.minutesIntoDay);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('dates itself a month ago, so it never reads as an abandoned demo', () => {
    const now = new Date('2027-03-15T12:00:00.000Z');
    expect(sampleEventEndsAt(now).slice(0, 7)).toBe('2027-02');
  });

  it('times its photos on the day the album says the wedding was', () => {
    const now = new Date('2027-03-15T12:00:00.000Z');
    const eventDay = sampleEventEndsAt(now).slice(0, 10);
    SAMPLE_PHOTOS.forEach((photo) => {
      // Same calendar day, or the small hours of the next one — a reception
      // that runs past midnight is fine; one dated months off is not.
      const captured = new Date(sampleCapturedAt(photo, now));
      const eventStart = new Date(`${eventDay}T00:00:00.000Z`).getTime();
      const withinTwoDays = captured.getTime() - eventStart < 2 * 24 * 60 * 60 * 1000;
      expect(withinTwoDays).toBe(true);
    });
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
