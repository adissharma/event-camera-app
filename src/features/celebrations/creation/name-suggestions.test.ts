import { GENERIC_SUGGESTIONS, isFillingGap, suggestionsFor } from './name-suggestions';

describe('event name suggestions', () => {
  it('keeps personalised suggestions to the three requested occasions', () => {
    expect(suggestionsFor('Priya').map((suggestion) => suggestion.value)).toEqual([
      "Priya's birthday",
      'Priya and  engagement',
      "Priya's wedding",
    ]);
  });

  it('puts the cursor between the two spaces of the engagement gap', () => {
    const engagement = suggestionsFor('Priya')[1];
    const { value, cursorAt } = engagement;

    expect(`${value.slice(0, cursorAt)}Sam${value.slice(cursorAt)}`).toBe(
      'Priya and Sam engagement',
    );
  });

  describe('knowing when the gap is being filled', () => {
    const suggestions = suggestionsFor('Ben');

    it.each(['Ben and  engagement', 'Ben and S engagement', 'Ben and Sam engagement'])(
      'is filling the gap at "%s"',
      (title) => {
        expect(isFillingGap(title, suggestions)).toBe(true);
      },
    );

    it.each(['', 'Summer party', "Ben's birthday", 'Ben and engagement'])(
      'is not filling a gap at "%s"',
      (title) => {
        expect(isFillingGap(title, suggestions)).toBe(false);
      },
    );
  });

  it('keeps the generic fallback to three suggestions too', () => {
    expect(GENERIC_SUGGESTIONS).toHaveLength(3);
  });
});
