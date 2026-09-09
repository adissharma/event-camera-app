/**
 * Event-name suggestions.
 *
 * Two shapes:
 *
 * - **Complete** — tapping fills the field and the host is done ("Priya's
 *   birthday").
 * - **With a gap** — tapping fills a template and drops the cursor into the
 *   blank, so the host types only the missing word ("Priya and ▮ — engagement").
 *   The gap is rendered in a muted tone on the chip so it reads as something to
 *   fill in rather than a literal part of the name.
 *
 * Possessives use a plain apostrophe. A typographic one looks better but is
 * awkward to type, and a host editing the name afterwards would end up with
 * both characters in the same field.
 */

export interface NameSuggestion {
  /** Rendered on the chip. `gap` marks where the muted blank appears. */
  label: string;
  gapLabel?: string;
  labelSuffix?: string;
  /** Inserted into the field. */
  value: string;
  /** Cursor position after insertion. Omitted means end of the text. */
  cursorAt?: number;
}

function possessive(name: string): string {
  // "James'" rather than "James's" — the convention most people expect on a
  // party invitation, and shorter on a guest cover.
  return name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`;
}

/**
 * Suggestions for a host whose first name we know.
 *
 * Keep this intentionally short: the name step is a single decision, and
 * three suggestions are enough to demonstrate the patterns without turning
 * the form into a list of competing choices.
 */
export function suggestionsFor(firstName: string): NameSuggestion[] {
  const owned = possessive(firstName);

  const engagementPrefix = `${firstName} and `;
  const engagementSuffix = ' engagement';

  return [
    { label: `${owned} birthday`, value: `${owned} birthday` },
    {
      label: engagementPrefix,
      gapLabel: 'name',
      labelSuffix: engagementSuffix,
      value: `${engagementPrefix}engagement`,
      // Drops the cursor between "and " and " engagement".
      cursorAt: engagementPrefix.length,
    },
    { label: `${owned} wedding`, value: `${owned} wedding` },
  ];
}

/**
 * Fallback when no first name is stored.
 *
 * Generic rather than personalised — a suggestion reading "'s birthday" with an
 * empty possessive is worse than an honest generic one. The host is asked for
 * their name once after sign-in, so this should be rare.
 */
export const GENERIC_SUGGESTIONS: NameSuggestion[] = [
  { label: 'Birthday party', value: 'Birthday party' },
  { label: 'Engagement party', value: 'Engagement party' },
  { label: 'Our wedding', value: 'Our wedding' },
];
