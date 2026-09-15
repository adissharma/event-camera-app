import {
  PREVIEW_CHALLENGES,
  clearPricingRevealHistory,
  hasShownPricingReveal,
  markPricingRevealShown,
  previewMediaFor,
} from './reveal-preview';

/**
 * The preview's content is a promise made to the host — "this is what your
 * event will look like" — and its data is a promise made to the database:
 * none of it goes in. Both are cheap to break silently and expensive to
 * notice, so they are pinned here.
 */

describe('preview challenges', () => {
  it('offers exactly the five generic challenges, in order', () => {
    expect(PREVIEW_CHALLENGES.map((challenge) => challenge.label)).toEqual([
      'Best group photo',
      'Caught off guard',
      'Main character moment',
      'Funniest photo',
      'Recreate this',
    ]);
  });

  it('carries the brief for each one', () => {
    expect(PREVIEW_CHALLENGES.map((challenge) => challenge.instructions)).toEqual([
      'Get as many people in one shot as you can.',
      'Capture someone when they least expect it.',
      'Find someone having their main-character moment.',
      'Capture the moment that makes everyone laugh.',
      'Recreate an old photo, pose or iconic moment together.',
    ]);
  });

  it('gives every challenge a distinct id and icon', () => {
    const ids = new Set(PREVIEW_CHALLENGES.map((challenge) => challenge.id));
    const icons = new Set(PREVIEW_CHALLENGES.map((challenge) => challenge.icon));
    expect(ids.size).toBe(PREVIEW_CHALLENGES.length);
    expect(icons.size).toBe(PREVIEW_CHALLENGES.length);
  });
});

describe('preview media', () => {
  it('is expressed as the two gallery preset ids used by the treatment collage', () => {
    // The event screen resolves these to the exact bundled sources used by the
    // treatment step, so a timed preview cannot fetch a remote image or vary
    // its top row with the selected photo treatment.
    for (const photo of previewMediaFor('party')) {
      expect(['preset_1', 'preset_2']).toContain(photo.uri);
      expect(photo.takenBy).toBeTruthy();
    }
  });

  it('keeps the first visible pair fixed for every event type', () => {
    const firstPair = (type: Parameters<typeof previewMediaFor>[0]) =>
      previewMediaFor(type).slice(0, 2).map((photo) => photo.uri);
    expect(firstPair('wedding')).toEqual(['preset_1', 'preset_2']);
    expect(firstPair('corporate')).toEqual(['preset_1', 'preset_2']);
  });

  it('falls back to the neutral order for an unknown type', () => {
    expect(previewMediaFor(null)).toEqual(previewMediaFor('other'));
    expect(previewMediaFor(undefined)).toEqual(previewMediaFor('other'));
  });

  it('names a different contributor on each photo', () => {
    const names = previewMediaFor('party').map((photo) => photo.takenBy);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('reveal history', () => {
  beforeEach(() => clearPricingRevealHistory());

  it('plays for a draft it has not seen', () => {
    expect(hasShownPricingReveal('2026-08-27T10:00:00.000Z')).toBe(false);
  });

  it('does not replay once shown', () => {
    markPricingRevealShown('2026-08-27T10:00:00.000Z');
    expect(hasShownPricingReveal('2026-08-27T10:00:00.000Z')).toBe(true);
  });

  it('scopes the flag to one draft, so a second event still gets its reveal', () => {
    markPricingRevealShown('2026-08-27T10:00:00.000Z');
    expect(hasShownPricingReveal('2026-08-27T11:30:00.000Z')).toBe(false);
  });

  it('treats a missing key as unseen rather than as seen', () => {
    // A draft with no `createdAt` is a draft we cannot tell apart from any
    // other. Erring toward playing the reveal shows an animation one time too
    // many; erring the other way silently removes it for everyone.
    markPricingRevealShown(null);
    expect(hasShownPricingReveal(null)).toBe(false);
    expect(hasShownPricingReveal(undefined)).toBe(false);
  });
});
