import { enGB, type CopyDeck } from './en-GB';

/**
 * Minimal typed copy access.
 *
 * Deliberately not a full i18n library yet. Only one locale exists, and adding
 * a dependency now would buy plural rules and locale negotiation that nothing
 * uses. What matters at this stage is that screens never hold literals, so the
 * swap later is mechanical.
 *
 * When a second locale lands, replace the internals here — the `t()` call sites
 * do not change.
 */

const decks: Record<string, CopyDeck> = {
  'en-GB': enGB,
};

let activeLocale = 'en-GB';

export function setLocale(locale: string): void {
  if (decks[locale]) activeLocale = locale;
}

export function getLocale(): string {
  return activeLocale;
}

/** The active copy deck. Prefer `t()` for anything with placeholders. */
export const copy: CopyDeck = decks[activeLocale];

/**
 * Interpolates `{name}` placeholders.
 *
 * A missing value leaves the placeholder visible rather than printing
 * "undefined" — a visible `{email}` is an obvious bug in review, whereas
 * "We sent a code to undefined" reads as a broken product to a user.
 */
export function t(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
