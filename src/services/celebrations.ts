import { requireSupabase } from '@/lib/supabase/client';
import type { CelebrationRow, EventSessionRow } from '@/types/database';

/**
 * Celebration data access.
 *
 * Screens never call Supabase directly — they use these typed functions through
 * TanStack Query. That keeps query shapes in one place and means a schema
 * change surfaces here rather than in a dozen components.
 */

export interface CelebrationSummary {
  id: string;
  title: string;
  status: CelebrationRow['status'];
  coverStoragePath: string | null;
  publicSlug: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  /** The default session. The MVP creates exactly one per celebration. */
  primarySession: Pick<
    EventSessionRow,
    'id' | 'name' | 'status' | 'ends_at' | 'reveal_at' | 'reveal_mode'
  > | null;
}

export const celebrationKeys = {
  all: ['celebrations'] as const,
  list: () => [...celebrationKeys.all, 'list'] as const,
  detail: (id: string) => [...celebrationKeys.all, 'detail', id] as const,
};

export async function listCelebrations(): Promise<CelebrationSummary[]> {
  const client = requireSupabase();

  // One round trip rather than N+1. RLS scopes this to celebrations the caller
  // can actually see, so no explicit workspace filter is needed — and adding
  // one would be a second, weaker copy of the same rule.
  const { data, error } = await client
    .from('celebrations')
    .select(
      `id, title, status, cover_storage_path, public_slug, starts_at, ends_at, timezone,
       event_sessions ( id, name, status, ends_at, reveal_at, reveal_mode, sequence_number )`,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const sessions = (row.event_sessions ?? []) as (EventSessionRow & {
      sequence_number: number;
    })[];
    const primary =
      [...sessions].sort((a, b) => a.sequence_number - b.sequence_number)[0] ?? null;

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      coverStoragePath: row.cover_storage_path,
      publicSlug: row.public_slug,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      primarySession: primary
        ? {
            id: primary.id,
            name: primary.name,
            status: primary.status,
            ends_at: primary.ends_at,
            reveal_at: primary.reveal_at,
            reveal_mode: primary.reveal_mode,
          }
        : null,
    };
  });
}
