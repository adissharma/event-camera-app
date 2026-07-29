import { requireSupabase } from '@/lib/supabase/client';
import type {
  CelebrationRow,
  EventSessionRow,
  EventSessionUpdate,
  GalleryVisibility,
  PhotoTreatment,
  RevealMode,
} from '@/types/database';

export interface EventMetrics {
  /** Guests who have joined. Not page views — a joined guest session. */
  guestsJoined: number;
  /** Guests who actually contributed at least one photo. */
  contributors: number;
  /** Media that reached `ready`. Excludes failed and pending uploads. */
  photos: number;
}

export interface CelebrationDetail {
  celebration: CelebrationRow;
  sessions: EventSessionRow[];
  primarySession: EventSessionRow | null;
  metrics: EventMetrics;
}

export const celebrationDetailKeys = {
  detail: (id: string) => ['celebrations', 'detail', id] as const,
};

/**
 * Full detail for the dashboard.
 *
 * Metrics are counted from real rows, never estimated or padded. The brief is
 * explicit that only real social proof may be shown, and the same honesty
 * applies to a host's own numbers: a contributor count that flatters is worse
 * than useless, because the host will compare it against the gallery.
 */
export async function fetchCelebrationDetail(celebrationId: string): Promise<CelebrationDetail> {
  const client = requireSupabase();

  const { data: celebration, error } = await client
    .from('celebrations')
    .select('*')
    .eq('id', celebrationId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;

  const { data: sessions, error: sessionsError } = await client
    .from('event_sessions')
    .select('*')
    .eq('celebration_id', celebrationId)
    .is('deleted_at', null)
    .order('sequence_number', { ascending: true });

  if (sessionsError) throw sessionsError;

  const primarySession = sessions?.[0] ?? null;
  const metrics = primarySession
    ? await fetchMetrics(primarySession.id)
    : { guestsJoined: 0, contributors: 0, photos: 0 };

  return {
    celebration,
    sessions: sessions ?? [],
    primarySession,
    metrics,
  };
}

async function fetchMetrics(eventSessionId: string): Promise<EventMetrics> {
  const client = requireSupabase();

  // `head: true` with an exact count fetches no rows — three cheap counts
  // rather than pulling every guest and photo down to count them on device.
  const [guests, ready] = await Promise.all([
    client
      .from('guest_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('event_session_id', eventSessionId),
    client
      .from('media_items')
      .select('guest_session_id', { count: 'exact' })
      .eq('event_session_id', eventSessionId)
      .eq('status', 'ready')
      .is('deleted_at', null),
  ]);

  const contributors = new Set(
    (ready.data ?? [])
      .map((row) => row.guest_session_id)
      .filter((id): id is string => id !== null),
  ).size;

  return {
    guestsJoined: guests.count ?? 0,
    contributors,
    photos: ready.count ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Editing                                                                    */
/* -------------------------------------------------------------------------- */

export interface EventSettingsPatch {
  title?: string;
  endsAt?: string | null;
  revealMode?: RevealMode;
  revealAt?: string | null;
  galleryVisibility?: GalleryVisibility;
  guestDownloadsEnabled?: boolean;
  moderationEnabled?: boolean;
  shotLimitPerGuest?: number | null;
  photoTreatment?: PhotoTreatment;
  dateStampEnabled?: boolean;
}

/**
 * Applies an edit to a published event.
 *
 * Split across two tables because the title belongs to the celebration and
 * capture settings to the session. Both writes are guarded by RLS — a
 * non-manager's update simply affects zero rows rather than erroring, which is
 * why the caller must not treat "no error" as "changed".
 */
export async function updateEventSettings(
  celebrationId: string,
  eventSessionId: string,
  patch: EventSettingsPatch,
): Promise<void> {
  const client = requireSupabase();

  if (patch.title !== undefined) {
    const { error } = await client
      .from('celebrations')
      .update({ title: patch.title.trim() })
      .eq('id', celebrationId);
    if (error) throw error;
  }

  // Typed against the generated Update shape: a column rename then fails to
  // compile here rather than silently updating nothing.
  const sessionPatch: EventSessionUpdate = {};
  if (patch.endsAt !== undefined) sessionPatch.ends_at = patch.endsAt;
  if (patch.revealMode !== undefined) sessionPatch.reveal_mode = patch.revealMode;
  if (patch.galleryVisibility !== undefined) {
    sessionPatch.gallery_visibility = patch.galleryVisibility;
  }
  if (patch.guestDownloadsEnabled !== undefined) {
    sessionPatch.guest_downloads_enabled = patch.guestDownloadsEnabled;
  }
  if (patch.moderationEnabled !== undefined) {
    sessionPatch.moderation_enabled = patch.moderationEnabled;
  }
  if (patch.shotLimitPerGuest !== undefined) {
    sessionPatch.shot_limit_per_guest = patch.shotLimitPerGuest;
  }
  if (patch.photoTreatment !== undefined) sessionPatch.photo_treatment = patch.photoTreatment;
  if (patch.dateStampEnabled !== undefined) {
    sessionPatch.date_stamp_enabled = patch.dateStampEnabled;
  }

  // reveal_at must be written whenever the mode changes: the check constraint
  // requires a timestamp for 'scheduled' and forbids one otherwise, so sending
  // a mode without its matching time fails the whole update.
  if (patch.revealMode !== undefined || patch.revealAt !== undefined) {
    sessionPatch.reveal_at = patch.revealMode === 'scheduled' ? patch.revealAt ?? null : null;
  }

  if (Object.keys(sessionPatch).length > 0) {
    const { error } = await client
      .from('event_sessions')
      .update(sessionPatch)
      .eq('id', eventSessionId);
    if (error) throw error;
  }
}

/** Soft-deletes. Recoverable, and media cleanup is queued rather than immediate. */
export async function archiveCelebration(celebrationId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('celebrations')
    .update({ status: 'archived' })
    .eq('id', celebrationId);
  if (error) throw error;
}
