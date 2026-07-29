import { requireSupabase } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/database';

export const profileKeys = {
  me: () => ['profile', 'me'] as const,
};

export async function fetchMyProfile(): Promise<ProfileRow | null> {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const { error } = await client
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', auth.user.id);

  if (error) throw error;
}

/**
 * The name used to personalise suggestions.
 *
 * Returns only the first word: "Priya Ramachandran" becomes "Priya", because
 * "Priya Ramachandran's Birthday" reads like a formal invitation rather than
 * something a person would call their own party.
 *
 * Deliberately returns null rather than guessing when no name is stored.
 * Deriving one from an email address produces "Djadis" from djadis@gmail.com —
 * confidently wrong is worse than absent, because the suggestions are meant to
 * feel like the app already knows them.
 */
export function firstNameFrom(profile: ProfileRow | null | undefined): string | null {
  const full = profile?.display_name?.trim();
  if (!full) return null;
  const first = full.split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}
