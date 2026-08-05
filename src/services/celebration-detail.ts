import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';
import { loadStoredGuestSessionByCelebrationId } from '@/services/guest-session';
import type {
  CaptureMode,
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
  hasAudioGuestbook?: boolean;
  /**
   * How this detail was obtained: the `celebrations`/`event_sessions` tables
   * directly (host, RLS-gated to the owner), or the `get_guest_gallery` RPC
   * (an anonymous guest, gated by a guest token instead of a row policy).
   *
   * Screens sharing this route between host and guest — the celebration
   * dashboard, camera, challenges, photo viewer — must treat `'guest'` as
   * authoritative and never show host-only controls, regardless of what
   * `celebration.created_by` happens to contain: the guest path leaves it
   * null because a guest RPC cannot see it.
   */
  viewerRole: 'host' | 'guest';
  /**
   * The current guest's own shots used, from `get_guest_gallery`'s
   * server-computed count — `null` on the host path, where "the viewer's own
   * shot allowance" isn't a meaningful concept in the same way.
   */
  guestShotsUsed: number | null;
  /**
   * Real, ready media — from `get_guest_gallery` for a guest, or a direct
   * `media_items` read for a host (both roles' own contributions go through
   * the same real upload pipeline now; see `guest-media-upload.ts` /
   * `host-media-upload.ts`). `null` only on the offline mock-fallback path.
   * `storagePath` is a raw private-bucket path, not a URL — resolve it with
   * `supabase.storage.from('event-media').createSignedUrls(...)` before
   * rendering. Named distinctly from screens' own local `photos` state
   * (e.g. `celebration/[celebrationId]/index.tsx`, which still holds the
   * offline-mock array under that name) to avoid colliding with it.
   */
  mediaPhotos:
    | { id: string; storagePath: string; capturedAt: string | null; displayName: string }[]
    | null;
}

export const celebrationDetailKeys = {
  detail: (id: string) => ['celebrations', 'detail', id] as const,
};

/**
 * Full detail for the celebration dashboard — shared by host and guest.
 *
 * Metrics are counted from real rows, never estimated or padded. The brief is
 * explicit that only real social proof may be shown, and the same honesty
 * applies to a host's own numbers: a contributor count that flatters is worse
 * than useless, because the host will compare it against the gallery.
 *
 * ── Host vs guest ──
 * `celebrations`/`event_sessions` are RLS-gated `to authenticated` — a
 * signed-in host viewing an event they own or manage. A guest has no session
 * and is correctly refused by Postgres (`42501 permission denied`) if this
 * path is used for them; that is the security policy working, not a bug to
 * route around by widening the grant.
 *
 * Guests are served by `get_guest_gallery`, a security-definer RPC gated by
 * their guest token instead of a row policy (see
 * `supabase/migrations/20260801120000_guest_gallery_rpc.sql`). This function
 * tries the host path first, and on a permission failure falls through to the
 * guest RPC using the token from this device's locally stored guest session —
 * see `loadStoredGuestSessionByCelebrationId`.
 */
export async function fetchCelebrationDetail(celebrationId: string): Promise<CelebrationDetail> {
  if (isBackendConfigured) {
    const client = requireSupabase();

    const { data: celebration, error } = await client
      .from('celebrations')
      .select('*')
      .eq('id', celebrationId)
      .is('deleted_at', null)
      .single();

    if (!error && celebration) {
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

      const { data: entitlements } = await client
        .from('celebration_entitlements')
        .select('entitlement_key')
        .eq('celebration_id', celebrationId)
        .eq('entitlement_key', 'audio_guestbook');

      const hasAudioGuestbook = (entitlements ?? []).length > 0;

      // A host reads their own event's media directly — RLS already permits
      // it ("media_items: viewers read on accessible session"), no token or
      // RPC needed the way a guest requires. `guest_sessions(display_name)`
      // is an embedded PostgREST join; a host's own contribution has no
      // guest_session at all, hence the fallback below.
      const mediaPhotos = primarySession
        ? await (async () => {
            const { data: mediaRows, error: mediaError } = await client
              .from('media_items')
              .select('id, original_storage_path, captured_at, guest_sessions(display_name)')
              .eq('event_session_id', primarySession.id)
              .eq('status', 'ready')
              .is('deleted_at', null)
              .order('captured_at', { ascending: false });

            if (mediaError) {
              console.error('[celebration-detail] failed to load host media', mediaError);
              return [];
            }

            return (mediaRows ?? [])
              .filter((m): m is typeof m & { original_storage_path: string } =>
                Boolean(m.original_storage_path),
              )
              .map((m) => ({
                id: m.id,
                storagePath: m.original_storage_path,
                capturedAt: m.captured_at,
                displayName: (m.guest_sessions as any)?.display_name ?? 'Host',
              }));
          })()
        : [];

      return {
        celebration,
        sessions: sessions ?? [],
        primarySession,
        metrics,
        hasAudioGuestbook,
        viewerRole: 'host',
        guestShotsUsed: null,
        mediaPhotos,
      };
    }

    // Host path failed — most often because this device is a guest, not
    // signed in at all. Try the guest RPC before giving up.
    const guestDetail = await tryFetchCelebrationDetailAsGuest(celebrationId);
    if (guestDetail) return guestDetail;

    // Neither path produced a result: surface the real error. Silently
    // falling back to mock data here previously turned an empty database and
    // a missing RLS policy into an indistinguishable, undiagnosable
    // "something went wrong" for every viewer.
    console.error('[celebration-detail] host and guest lookups both failed', {
      celebrationId,
      error,
    });
    throw error ?? new Error('Could not load this event.');
  }

  // No backend configured: development fallback, so the full host journey
  // stays exercisable with no Supabase project at all.
  const mockData = await AsyncStorage.getItem('__mock_celebrations');
  if (mockData) {
    try {
      const list = JSON.parse(mockData) as any[];
      const found = list.find((item) => item.id === celebrationId);
      if (found) {
        const celebration: any = {
          id: found.id,
          title: found.title,
          status: found.status,
          cover_storage_path: found.coverStoragePath,
          public_slug: found.publicSlug,
          starts_at: found.startsAt,
          ends_at: found.endsAt,
          timezone: found.timezone,
          default_theme_id: found.defaultThemeId,
        };
        const primarySession: any = found.primarySession ? {
          id: found.primarySession.id,
          celebration_id: found.id,
          name: found.primarySession.name,
          status: found.primarySession.status,
          ends_at: found.primarySession.ends_at,
          reveal_at: found.primarySession.reveal_at,
          reveal_mode: found.primarySession.reveal_mode,
          photo_treatment: found.primarySession.photo_treatment ?? 'original',
          date_stamp_enabled: found.primarySession.date_stamp_enabled ?? false,
          gallery_visibility: found.primarySession.gallery_visibility ?? 'all_guests',
          // Omitting this made the camera-roll button unhideable with no
          // backend: the camera screen reads `capture_mode` and falls back to
          // `camera_and_library` when it is absent, so the host's toggle had
          // no observable effect at all in the development fallback.
          capture_mode: found.primarySession.capture_mode ?? 'camera_and_library',
          shot_limit_per_guest: found.primarySession.shot_limit_per_guest !== undefined ? found.primarySession.shot_limit_per_guest : 25,
          guest_downloads_enabled: found.primarySession.guest_downloads_enabled !== undefined ? found.primarySession.guest_downloads_enabled : true,
          moderation_enabled: found.primarySession.moderation_enabled ?? false,
        } : null;

        // Load mock photos count
        const mockPhotosKey = `__mock_photos_${celebrationId}`;
        const mockPhotosData = await AsyncStorage.getItem(mockPhotosKey);
        let photosCount = 0;
        if (mockPhotosData) {
          try {
            photosCount = JSON.parse(mockPhotosData).length;
          } catch {}
        }

        return {
          celebration,
          sessions: primarySession ? [primarySession] : [],
          primarySession,
          metrics: {
            guestsJoined: 12,
            contributors: 8,
            photos: photosCount,
          },
          hasAudioGuestbook: found.addOnKeys?.includes('media_bundle') ?? true, // Default to true for easy mock visual testing if not defined
          viewerRole: 'host',
          guestShotsUsed: null,
          mediaPhotos: null,
        };
      }
    } catch (parseError) {
      console.error('Failed to parse mock celebrations:', parseError);
    }
  }
  throw new Error('This invitation is no longer available.');
}

/**
 * The guest-token path for `fetchCelebrationDetail`.
 *
 * Returns null (never throws) when this device has no guest session for this
 * celebration or the RPC itself fails — either way the caller falls back to
 * surfacing the original host-path error, which is the more informative one
 * for a signed-out host or a genuinely missing event.
 */
async function tryFetchCelebrationDetailAsGuest(
  celebrationId: string
): Promise<CelebrationDetail | null> {
  const found = await loadStoredGuestSessionByCelebrationId(celebrationId);
  if (!found) return null;

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_guest_gallery', {
    p_event_code: found.slug,
    p_guest_token: found.session.guestToken,
  });

  if (error) {
    console.error('[celebration-detail] guest RPC get_guest_gallery failed', {
      celebrationId,
      slug: found.slug,
      message: error.message,
      code: error.code,
    });
    return null;
  }

  const c = data?.celebration ?? {};
  const s = data?.session ?? {};

  // Cast rather than satisfy the full generated row types: the RPC returns a
  // deliberately narrow projection (see the migration's comment), and a guest
  // has no legitimate way to see the columns it omits — `created_by` above
  // all, which is why `viewerRole` exists instead of trusting that field.
  const celebration = {
    id: c.id ?? celebrationId,
    title: c.title ?? '',
    status: 'published',
    cover_storage_path: c.cover_storage_path ?? null,
    public_slug: c.public_slug ?? found.slug,
    starts_at: null,
    ends_at: c.ends_at ?? null,
    timezone: c.timezone ?? 'Europe/London',
    default_theme_id: null,
    created_by: null,
  } as unknown as CelebrationRow;

  const primarySession = {
    id: s.id ?? `session_${celebrationId}`,
    celebration_id: celebrationId,
    name: s.name ?? 'Primary Session',
    status: 'active',
    ends_at: s.ends_at ?? c.ends_at ?? null,
    reveal_at: s.reveal_at ?? null,
    reveal_mode: s.reveal_mode ?? 'instant',
    photo_treatment: s.photo_treatment ?? 'original',
    date_stamp_enabled: s.date_stamp_enabled ?? false,
    gallery_visibility: s.gallery_visibility ?? 'all_guests',
    shot_limit_per_guest: s.shot_limit_per_guest ?? null,
    guest_downloads_enabled: s.guest_downloads_enabled ?? true,
    capture_mode: s.capture_mode ?? 'camera_and_library',
    moderation_enabled: false,
  } as unknown as EventSessionRow;

  return {
    celebration,
    sessions: [primarySession],
    primarySession,
    metrics: {
      // A guest token cannot see workspace-wide counts — those columns are
      // exactly what RLS exists to hide from them. Real per-guest numbers
      // stay out of this host-shaped metrics type; the guest's own shots
      // used is carried separately below, in `guestShotsUsed`.
      guestsJoined: 0,
      contributors: 0,
      photos: Array.isArray(data?.photos) ? data.photos.length : 0,
    },
    // Unknown without a table this RPC deliberately does not expose to
    // guests. `undefined` reads as "show the guestbook" downstream
    // (`isHost || hasAudioGuestbook !== false`) — fails open to a visible
    // prompt rather than open to a host control, which is the safer default.
    hasAudioGuestbook: undefined,
    viewerRole: 'guest',
    guestShotsUsed: typeof data?.guest?.shots_used === 'number' ? data.guest.shots_used : null,
    mediaPhotos: Array.isArray(data?.photos)
      ? data.photos.map((p: any) => ({
          id: p.id,
          storagePath: p.storage_path,
          capturedAt: p.captured_at ?? null,
          displayName: p.display_name ?? 'Guest',
        }))
      : null,
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
  shotLimitPerGuest?: number | null;
  photoTreatment?: PhotoTreatment;
  dateStampEnabled?: boolean;
  coverStoragePath?: string | null;
  captureMode?: CaptureMode;
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
  if (!isBackendConfigured) {
    // Update local AsyncStorage mock data
    const mockData = await AsyncStorage.getItem('__mock_celebrations');
    if (mockData) {
      const list = JSON.parse(mockData) as any[];
      const idx = list.findIndex((item) => item.id === celebrationId);
      if (idx !== -1) {
        const item = list[idx];
        if (patch.title !== undefined) item.title = patch.title;
        if (patch.endsAt !== undefined) {
          item.endsAt = patch.endsAt;
          if (item.primarySession) item.primarySession.ends_at = patch.endsAt;
        }
        if (patch.shotLimitPerGuest !== undefined) {
          if (item.primarySession) item.primarySession.shot_limit_per_guest = patch.shotLimitPerGuest;
        }
        if (patch.galleryVisibility !== undefined) {
          if (item.primarySession) item.primarySession.gallery_visibility = patch.galleryVisibility;
        }
        if (patch.guestDownloadsEnabled !== undefined) {
          if (item.primarySession) item.primarySession.guest_downloads_enabled = patch.guestDownloadsEnabled;
        }
        if (patch.photoTreatment !== undefined) {
          if (item.primarySession) item.primarySession.photo_treatment = patch.photoTreatment;
        }
        if (patch.captureMode !== undefined) {
          if (item.primarySession) item.primarySession.capture_mode = patch.captureMode;
        }
        if (patch.revealMode !== undefined) {
          if (item.primarySession) item.primarySession.reveal_mode = patch.revealMode;
        }
        if (patch.revealAt !== undefined) {
          if (item.primarySession) item.primarySession.reveal_at = patch.revealAt;
        }
        if (patch.coverStoragePath !== undefined) {
          item.coverStoragePath = patch.coverStoragePath;
        }
        list[idx] = item;
        await AsyncStorage.setItem('__mock_celebrations', JSON.stringify(list));
      }
    }
    return;
  }

  const client = requireSupabase();

  if (patch.title !== undefined) {
    const { error } = await client
      .from('celebrations')
      .update({ title: patch.title.trim() })
      .eq('id', celebrationId);
    if (error) throw error;
  }

  if (patch.coverStoragePath !== undefined) {
    const { error } = await client
      .from('celebrations')
      .update({ cover_storage_path: patch.coverStoragePath })
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
  if (patch.shotLimitPerGuest !== undefined) {
    sessionPatch.shot_limit_per_guest = patch.shotLimitPerGuest;
  }
  if (patch.photoTreatment !== undefined) sessionPatch.photo_treatment = patch.photoTreatment;
  if (patch.captureMode !== undefined) {
    sessionPatch.capture_mode = patch.captureMode;
  }
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
