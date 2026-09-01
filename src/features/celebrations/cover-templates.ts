import type { ThemeRow } from '@/types/database';

/**
 * Invite cover templates.
 *
 * Before this, "themes" were eight database rows whose only rendered
 * difference was the accent colour — `parseCoverTheme` reads `accent`, `align`
 * and `overlay`, and of those only `accent` reaches the screen (the title is
 * hard-centred regardless of `align`). Eight options that differ by a button
 * tint is not a choice worth offering.
 *
 * A template is instead a genuinely different *layout*. The curated list is
 * deliberately short: each entry has to earn its place by looking unmistakably
 * unlike the others at a glance.
 *
 * Templates are keyed off the theme slug rather than a new `design_tokens`
 * field, so no migration is required and an already-published event keeps its
 * stored theme id when a curated option is deliberately replaced.
 */

export type CoverTemplateKey = 'classic' | 'midnight' | 'lightArch';

export interface CoverTemplateDefinition {
  key: CoverTemplateKey;
  /** The `themes.slug` this template is selected by. */
  slug: string;
  name: string;
  description: string;
  accent: string;
}

/**
 * The options a host may pick from, in display order.
 *
 * Slugs are reused from the existing themes table on purpose: an event already
 * published against `editorial`, `midnight` or `black_tie` keeps its theme id,
 * and the rows for the retired slugs are left in place so historic events
 * still resolve.
 */
export const COVER_TEMPLATES: CoverTemplateDefinition[] = [
  {
    key: 'classic',
    slug: 'editorial',
    name: 'Editorial',
    description: 'Clean type over a full-bleed photograph. The default.',
    accent: '#EFE9E0',
  },
  {
    key: 'midnight',
    slug: 'midnight',
    name: 'Midnight Invitation',
    description: 'A framed hero on a blurred wash of your own cover, in cream and gold.',
    accent: '#D9C39A',
  },
  {
    key: 'lightArch',
    slug: 'black_tie',
    name: 'Light Arch',
    description: 'An ivory invitation with an arched photograph and restrained taupe details.',
    accent: '#8C8175',
  },
];

export const DEFAULT_COVER_TEMPLATE: CoverTemplateKey = 'classic';

const BY_SLUG = new Map(COVER_TEMPLATES.map((template) => [template.slug, template]));

/** Slugs a host can currently choose, in order. */
export const CURATED_THEME_SLUGS = COVER_TEMPLATES.map((template) => template.slug);

/**
 * The template a theme slug renders with.
 *
 * Anything unrecognised — a retired slug on an older event, or null on a draft
 * that has not reached the cover step — falls back to the classic layout,
 * which is what those events render with today.
 */
export function resolveCoverTemplate(slug: string | null | undefined): CoverTemplateKey {
  if (!slug) return DEFAULT_COVER_TEMPLATE;
  return BY_SLUG.get(slug)?.key ?? DEFAULT_COVER_TEMPLATE;
}

/**
 * Narrows a fetched theme list to the curated options, in template order.
 *
 * Applied to whatever the database returns rather than to a hard-coded list.
 * The replaced third row receives its new local label too, so an older
 * `black_tie` database row is not announced to assistive technology under the
 * retired template name.
 */
export function curateThemes(themes: ThemeRow[]): ThemeRow[] {
  const bySlug = new Map(themes.map((theme) => [theme.slug, theme]));
  return COVER_TEMPLATES.map((template) => {
    const theme = bySlug.get(template.slug);
    if (!theme || template.key !== 'lightArch') return theme;
    return { ...theme, name: template.name, description: template.description };
  }).filter((theme): theme is ThemeRow => Boolean(theme));
}
