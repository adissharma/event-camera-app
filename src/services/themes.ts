import { requireSupabase } from '@/lib/supabase/client';
import type { ThemeRow } from '@/types/database';
import { curateThemes } from '@/features/celebrations/cover-templates';

export const themeKeys = {
  all: ['themes'] as const,
  list: () => [...themeKeys.all, 'list'] as const,
  curated: () => [...themeKeys.all, 'curated'] as const,
};

/**
 * Active themes, in display order.
 *
 * Every active theme is returned regardless of the host's inspiration pack.
 * The pack influences ordering and suggestion only — it must never restrict
 * what a user can choose, which is a rule the database comments carry too.
 */
export async function listThemes(): Promise<ThemeRow[]> {
  try {
    const client = requireSupabase();

    const { data, error } = await client
      .from('themes')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Failed to fetch themes from Supabase, falling back to local list:', e);
    return [
      {
        slug: 'editorial',
        name: 'Editorial',
        description: 'Clean type, generous margins, photography left to speak for itself.',
        inspiration_pack: 'universal',
        preview_asset_key: 'theme_editorial',
        sort_order: 10,
        design_tokens: { cover: { align: 'left', overlay: 'scrim_bottom' }, accent: '#EFE9E0' },
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'film',
        name: 'Film',
        description: 'Warm analogue cast with soft grain, as though shot on a disposable camera.',
        inspiration_pack: 'universal',
        preview_asset_key: 'theme_film',
        sort_order: 20,
        design_tokens: { cover: { align: 'left', overlay: 'scrim_bottom' }, accent: '#D9C39A', grain: true },
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'midnight',
        name: 'Midnight',
        description: 'Deep ink with candlelit highlights. Made for evening receptions.',
        inspiration_pack: 'universal',
        preview_asset_key: 'theme_editorial',
        sort_order: 30,
        design_tokens: { cover: { align: 'left', overlay: 'scrim_full' }, accent: '#C8B79A' },
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'emerald',
        name: 'Emerald',
        description: 'Deep green ground with restrained warm highlights.',
        inspiration_pack: 'south_asian',
        preview_asset_key: 'theme_emerald',
        sort_order: 40,
        design_tokens: { cover: { align: 'centre', overlay: 'scrim_bottom' }, accent: '#1F5148' },
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'marigold',
        name: 'Marigold',
        description: 'Warm saffron and rose, drawn from festival colour.',
        inspiration_pack: 'south_asian',
        preview_asset_key: 'theme_floral',
        sort_order: 50,
        design_tokens: { cover: { align: 'centre', overlay: 'scrim_bottom' }, accent: '#D98A2B' },
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'garden',
        name: 'Garden',
        description: 'Botanical and photographic, never illustrated stationery.',
        inspiration_pack: 'garden',
        preview_asset_key: 'theme_floral',
        sort_order: 60,
        design_tokens: { cover: { align: 'left', overlay: 'scrim_bottom' }, accent: '#7FB08A' },
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'black_tie',
        name: 'Light Arch',
        description: 'An ivory invitation with an arched photograph and restrained taupe details.',
        inspiration_pack: 'black_tie',
        preview_asset_key: 'theme_editorial',
        sort_order: 70,
        design_tokens: { cover: { align: 'centre', overlay: 'scrim_full' }, accent: '#8C8175' },
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'modern',
        name: 'Modern',
        description: 'Bold type, high contrast, unfussy.',
        inspiration_pack: 'modern',
        preview_asset_key: 'theme_editorial',
        sort_order: 80,
        design_tokens: { cover: { align: 'left', overlay: 'scrim_bottom' }, accent: '#E8776D' },
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ] as any[];
  }
}

/**
 * The templates a host may choose from, in display order.
 *
 * Deliberately separate from `listThemes`: that must keep returning every row,
 * because an event published against a since-retired theme still has to
 * resolve its accent and cover treatment. Only the picker is narrowed.
 */
export async function listCoverTemplateThemes(): Promise<ThemeRow[]> {
  return curateThemes(await listThemes());
}

/** Resolves either the stable theme slug used by the draft or a theme id. */
export async function resolveThemeId(themeKey: string | null | undefined): Promise<string | null> {
  if (!themeKey) return null;
  const match = (await listThemes()).find((theme) => theme.slug === themeKey || theme.id === themeKey);
  return match?.id ?? null;
}
