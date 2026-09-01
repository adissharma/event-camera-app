import { CHALLENGE_PACKS, CHALLENGE_PACK_CATEGORIES } from './challenge-packs';

describe('challenge pack categories', () => {
  it('assigns every pack to a visible category tab', () => {
    const categoryIds = new Set(CHALLENGE_PACK_CATEGORIES.map((category) => category.id));

    expect(CHALLENGE_PACKS.length).toBeGreaterThan(0);
    expect(CHALLENGE_PACKS.every((pack) => categoryIds.has(pack.category))).toBe(true);
  });

  it('keeps each pack id unique', () => {
    const ids = CHALLENGE_PACKS.map((pack) => pack.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
