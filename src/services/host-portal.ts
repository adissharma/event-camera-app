import { fetchAllPages, type HostMediaItem } from '@/features/host-portal/gallery';
import { requireSupabase } from '@/lib/supabase/client';
import type { CelebrationRow, EventSessionRow } from '@/types/database';

/**
 * Data access for the host web portal.
 *
 * Deliberately not `listCelebrations` and `fetchCelebrationDetail`. Both fall
 * back when a request fails: the list to locally seeded demo events, the detail
 * to the guest RPC. That suits an app that has to keep working at a venue, but
 * here a dropped connection would show a host somebody else's idea of their
 * events, and a browser that once joined as a guest would get the guest's view
 * of an event in a page that promises the host's. These fail visibly instead.
 *
 * Access is decided by RLS, as everywhere else: `celebrations` returns only what
 * the caller's workspace can see, and a guest has no workspace.
 */

export const hostPortalKeys = {
  events: () => ['host-portal', 'events'] as const,
  event: (celebrationId: string) => ['host-portal', 'event', celebrationId] as const,
  gallery: (eventSessionId: string) => ['host-portal', 'gallery', eventSessionId] as const,
  guestbook: (celebrationId: string) => ['host-portal', 'guestbook', celebrationId] as const,
};

/** Keeps the Guestbook out of the gallery: those messages are the host's alone. */
const NOT_GUESTBOOK = 'metadata->>submission_kind.is.null,metadata->>submission_kind.neq.guestbook';

export interface HostEventSummary {
  id: string;
  title: string;
  coverStoragePath: string | null;
  startsAt: string | null;
  endsAt: string | null;
  mediaCount: number;
  guestCount: number;
}

export async function listHostEvents(): Promise<HostEventSummary[]> {
  const { data, error } = await (requireSupabase() as any)
    .from('celebrations')
    .select(
      `id, title, cover_storage_path, starts_at, ends_at,
       event_sessions ( sequence_number, ends_at, guest_sessions ( count ), media_items ( count ) )`,
    )
    .is('deleted_at', null)
    // A draft is a creation journey in progress, not an event. See `listCelebrations`.
    .neq('status', 'draft')
    .eq('event_sessions.media_items.status', 'ready')
    .is('event_sessions.media_items.deleted_at', null)
    .or(NOT_GUESTBOOK, { referencedTable: 'event_sessions.media_items' })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const sessions = [...(row.event_sessions ?? [])].sort(
      (a: any, b: any) => a.sequence_number - b.sequence_number,
    );
    const primary = sessions[0];
    return {
      id: row.id,
      title: row.title,
      coverStoragePath: row.cover_storage_path,
      startsAt: row.starts_at,
      endsAt: primary?.ends_at ?? row.ends_at,
      mediaCount: primary?.media_items?.[0]?.count ?? 0,
      guestCount: primary?.guest_sessions?.[0]?.count ?? 0,
    };
  });
}

export interface HostEvent {
  celebration: CelebrationRow;
  session: EventSessionRow | null;
}

/** Null when the event does not exist or is not this host's to see. */
export async function fetchHostEvent(celebrationId: string): Promise<HostEvent | null> {
  const client = requireSupabase();
  const { data: celebration, error } = await client
    .from('celebrations')
    .select('*')
    .eq('id', celebrationId)
    .is('deleted_at', null)
    .maybeSingle();
  // An id that is not a uuid is simply not an event.
  if (error?.code === '22P02') return null;
  if (error) throw error;
  if (!celebration) return null;

  const { data: sessions, error: sessionsError } = await client
    .from('event_sessions')
    .select('*')
    .eq('celebration_id', celebrationId)
    .is('deleted_at', null)
    .order('sequence_number', { ascending: true })
    .limit(1);
  if (sessionsError) throw sessionsError;

  return { celebration, session: sessions?.[0] ?? null };
}

/** Every ready photo and video on the session, however many there are. */
export async function fetchHostGallery(eventSessionId: string): Promise<HostMediaItem[]> {
  const client = requireSupabase() as any;
  const rows = await fetchAllPages<any>(async (from, to) => {
    const { data, error } = await client
      .from('media_items')
      .select(
        'id, original_storage_path, thumbnail_storage_path, captured_at, metadata, guest_session_id, guest_sessions(display_name), media_type, duration_ms, mime_type, file_size_bytes, is_pinned',
      )
      .eq('event_session_id', eventSessionId)
      .eq('status', 'ready')
      .is('deleted_at', null)
      .in('media_type', ['photo', 'video'])
      .not('original_storage_path', 'is', null)
      .or(NOT_GUESTBOOK)
      .order('is_pinned', { ascending: false })
      .order('pinned_at', { ascending: false, nullsFirst: false })
      .order('captured_at', { ascending: false })
      // Ties on `captured_at` would otherwise land on either side of a page
      // boundary at the database's whim, repeating one photo and losing another.
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    return data ?? [];
  });

  return rows.map((row) => ({
    id: row.id,
    storagePath: row.original_storage_path,
    thumbnailStoragePath: row.thumbnail_storage_path ?? null,
    capturedAt: row.captured_at,
    displayName: row.guest_sessions?.display_name ?? 'Host',
    mediaType: row.media_type,
    durationMs: row.duration_ms ?? null,
    mimeType: row.mime_type ?? null,
    fileSizeBytes: row.file_size_bytes ?? null,
    isPinned: row.is_pinned === true,
    caption: typeof row.metadata?.caption === 'string' ? row.metadata.caption : null,
    challengeId: typeof row.metadata?.challenge_id === 'string' ? row.metadata.challenge_id : null,
    guestSessionId: row.guest_session_id ?? null,
  }));
}
