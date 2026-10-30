import { requireSupabase } from '@/lib/supabase/client';
import { resolveSignedUrls } from '@/features/media/signed-url-cache';
import { SAMPLE_PHOTOS, isSampleCelebrationId } from '@/features/celebrations/sample-event';

export interface AlbumPreview {
  photos: (number | { uri: string })[];
  remainingCount: number;
}

/** A small, photo-only slice for the dashboard. The full gallery loads on entry. */
export async function fetchAlbumPreview(celebrationId: string, sessionId: string | null): Promise<AlbumPreview> {
  if (isSampleCelebrationId(celebrationId)) {
    return {
      photos: SAMPLE_PHOTOS.slice(0, 4).map((photo) => photo.source),
      remainingCount: Math.max(0, SAMPLE_PHOTOS.length - 4),
    };
  }

  if (!sessionId) return { photos: [], remainingCount: 0 };

  const { data, count, error } = await requireSupabase()
    .from('media_items')
    .select('original_storage_path', { count: 'exact' })
    .eq('event_session_id', sessionId)
    .eq('status', 'ready')
    .eq('media_type', 'photo')
    .is('deleted_at', null)
    .not('original_storage_path', 'is', null)
    .or('metadata->>submission_kind.is.null,metadata->>submission_kind.neq.guestbook')
    .order('captured_at', { ascending: false })
    .limit(4);

  if (error) throw error;

  const paths = (data ?? [])
    .map((photo) => photo.original_storage_path)
    .filter((path): path is string => Boolean(path));
  const signed = await resolveSignedUrls('event-media', paths);
  const photos = paths
    .map((path) => signed.get(path))
    .filter((uri): uri is string => Boolean(uri))
    .map((uri) => ({ uri }));

  return {
    photos,
    // Only a complete set of four previews can support a trustworthy "+N".
    remainingCount: photos.length === 4 ? Math.max(0, (count ?? 0) - 4) : 0,
  };
}
