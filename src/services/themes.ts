import { requireSupabase } from '@/lib/supabase/client';
import type { ThemeRow } from '@/types/database';

export const themeKeys = {
  all: ['themes'] as const,
  list: () => [...themeKeys.all, 'list'] as const,
};

/**
 * Active themes, in display order.
 *
 * Every active theme is returned regardless of the host's inspiration pack.
 * The pack influences ordering and suggestion only — it must never restrict
 * what a user can choose, which is a rule the database comments carry too.
 */
export async function listThemes(): Promise<ThemeRow[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from('themes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
