import { COVER_TEMPLATES, curateThemes, resolveCoverTemplate } from './cover-templates';
import type { ThemeRow } from '@/types/database';

function theme(slug: string): ThemeRow {
  return { slug, name: slug } as ThemeRow;
}

describe('cover templates', () => {
  it('keeps three options and replaces the existing third slug with Light Arch', () => {
    expect(COVER_TEMPLATES).toHaveLength(3);
    expect(COVER_TEMPLATES.map(({ slug }) => slug)).toEqual([
      'editorial',
      'midnight',
      'black_tie',
    ]);
    expect(COVER_TEMPLATES[2]).toMatchObject({
      key: 'lightArch',
      slug: 'black_tie',
      name: 'Light Arch',
    });
    expect(resolveCoverTemplate('editorial')).toBe('classic');
    expect(resolveCoverTemplate('midnight')).toBe('midnight');
    expect(resolveCoverTemplate('black_tie')).toBe('lightArch');
  });

  it('curates database rows into template order without adding another theme', () => {
    const themes = [theme('black_tie'), theme('film'), theme('editorial'), theme('midnight')];

    const curated = curateThemes(themes);

    expect(curated.map(({ slug }) => slug)).toEqual([
      'editorial',
      'midnight',
      'black_tie',
    ]);
    expect(curated[2]?.name).toBe('Light Arch');
  });
});
