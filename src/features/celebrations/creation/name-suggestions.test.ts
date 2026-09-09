import { GENERIC_SUGGESTIONS, suggestionsFor } from './name-suggestions';

describe('event name suggestions', () => {
  it('keeps personalised suggestions to the three requested occasions', () => {
    expect(suggestionsFor('Priya').map((suggestion) => suggestion.value)).toEqual([
      "Priya's birthday",
      'Priya and engagement',
      "Priya's wedding",
    ]);
  });

  it('keeps the generic fallback to three suggestions too', () => {
    expect(GENERIC_SUGGESTIONS).toHaveLength(3);
  });
});
