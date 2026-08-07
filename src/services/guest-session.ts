import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { isBackendConfigured, requireSupabase } from '@/lib/supabase/client';
import { listThemes } from '@/services/themes';

/**
 * A guest's identity for one event, on one device.
 *
 * Deliberately not an account. The guest is identified by the invitation token
 * they arrived with plus a device-local id — there is no sign-up, no password
 * and nothing to recover, which is the whole point of the guest flow.
 */
export interface GuestSession {
  guestSessionId: string;
  eventSessionId: string;
  celebrationId: string;
  /** Bearer credential for this guest's subsequent uploads. Treat as a secret. */
  guestToken: string;
  displayName: string;
  /** Null means unlimited. */
  shotLimit: number | null;
  shotsUsed: number;
}

/** What the entry screen needs before the guest has committed to anything. */
export interface GuestEventPreview {
  celebrationId: string;
  title: string;
  /** Drives the countdown. Null when the host set no closing time. */
  endsAt: string | null;
  /** Null means unlimited. */
  shotLimit: number | null;
  shotsUsed: number;
  coverStoragePath: string | null;
  themeAccent: string | null;
  /** Set when this device has already joined — the form is then skipped. */
  existingDisplayName: string | null;
}

const DEVICE_ID_KEY = 'guest_device_id';

export const guestSessionKeys = {
  session: (slug: string) => ['guest', 'session', slug.trim().toLowerCase()] as const,
  preview: (slug: string) => ['guest', 'preview', slug.trim().toLowerCase()] as const,
  gallery: (slug: string) => ['guest', 'gallery', slug.trim().toLowerCase()] as const,
};

export const guestSessionStorage = {
  async get(eventCode: string): Promise<GuestSession | null> {
    const cleanCode = eventCode.trim().toLowerCase();
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem(`guest_session_${cleanCode}`);
          return raw ? (JSON.parse(raw) as GuestSession) : null;
        }
        return null;
      } else {
        const raw = await AsyncStorage.getItem(`guest_session_${cleanCode}`);
        return raw ? (JSON.parse(raw) as GuestSession) : null;
      }
    } catch {
      return null;
    }
  },

  async set(eventCode: string, session: GuestSession): Promise<void> {
    const cleanCode = eventCode.trim().toLowerCase();
    // Also indexed by celebrationId, so screens reached only with a
    // celebrationId route param (`/celebration/[celebrationId]/*`) can find
    // which event code this device joined under — see
    // `loadStoredGuestSessionByCelebrationId`.
    const indexKey = `guest_session_celebration_${session.celebrationId}`;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`guest_session_${cleanCode}`, JSON.stringify(session));
          window.localStorage.setItem(indexKey, cleanCode);
        }
      } else {
        await AsyncStorage.setItem(`guest_session_${cleanCode}`, JSON.stringify(session));
        await AsyncStorage.setItem(indexKey, cleanCode);
      }
    } catch {}
  },

  async remove(eventCode: string): Promise<void> {
    const cleanCode = eventCode.trim().toLowerCase();
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(`guest_session_${cleanCode}`);
        }
      } else {
        await AsyncStorage.removeItem(`guest_session_${cleanCode}`);
      }
    } catch {}
  },

  /** The event code a guest session was stored under, given its celebrationId. */
  async getEventCodeForCelebration(celebrationId: string): Promise<string | null> {
    const indexKey = `guest_session_celebration_${celebrationId}`;
    try {
      if (Platform.OS === 'web') {
        return typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(indexKey)
          : null;
      }
      return await AsyncStorage.getItem(indexKey);
    } catch {
      return null;
    }
  },
};

async function readMockGalleryVisibility(celebrationId: string): Promise<string | null> {
  try {
    const raw =
      Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('__mock_celebrations')
        : await AsyncStorage.getItem('__mock_celebrations');

    if (!raw) return null;

    const list = JSON.parse(raw) as { id?: string; primarySession?: { gallery_visibility?: string } }[];
    const match = list.find((item) => item.id === celebrationId);
    return match?.primarySession?.gallery_visibility ?? null;
  } catch {
    return null;
  }
}

async function resolveThemeAccent(themeKey: string | null | undefined): Promise<string | null> {
  if (!themeKey) return null;

  try {
    const themes = await listThemes();
    const match = themes.find((theme) => theme.id === themeKey || theme.slug === themeKey);
    const accent = (match?.design_tokens as { accent?: unknown } | null | undefined)?.accent;
    return typeof accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : null;
  } catch {
    return null;
  }
}

/**
 * A stable per-device identifier.
 *
 * Random and stored locally rather than derived from any hardware id: it only
 * has to be consistent for this device, and anything derived from real device
 * identifiers would be a fingerprint we have no reason to collect.
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const existing = window.localStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;
        const created = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        window.localStorage.setItem(DEVICE_ID_KEY, created);
        return created;
      }
      return 'web_ssr_placeholder';
    } else {
      const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const created = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, created);
      return created;
    }
  } catch {
    return 'fallback_fingerprint';
  }
}

/** The remembered session for this event on this device, if there is one. */
export async function loadStoredGuestSession(slug: string): Promise<GuestSession | null> {
  return guestSessionStorage.get(slug);
}

/**
 * The remembered session for this device, found via celebrationId rather than
 * event code.
 *
 * `/celebration/[celebrationId]/*` routes only have the celebrationId — not
 * the slug the guest originally joined with — so they cannot call
 * `loadStoredGuestSession` directly. This resolves the slug first via the
 * reverse index `guestSessionStorage` maintains, then loads the session.
 */
export async function loadStoredGuestSessionByCelebrationId(
  celebrationId: string
): Promise<{ slug: string; session: GuestSession } | null> {
  const slug = await guestSessionStorage.getEventCodeForCelebration(celebrationId);
  if (!slug) return null;
  const session = await guestSessionStorage.get(slug);
  if (!session) return null;
  return { slug, session };
}

async function storeGuestSession(slug: string, session: GuestSession): Promise<void> {
  await guestSessionStorage.set(slug, session);
}

export async function clearStoredGuestSession(slug: string): Promise<void> {
  await guestSessionStorage.remove(slug);
}

/**
 * Changes the remembered name without re-joining.
 *
 * Exposed so the event's own settings can rename the guest later — the entry
 * screen is not the only place the name can be set.
 */
export async function updateGuestDisplayName(slug: string, displayName: string): Promise<void> {
  const cleanSlug = slug.trim().toLowerCase();
  const stored = await loadStoredGuestSession(cleanSlug);
  if (!stored) return;

  const next = { ...stored, displayName: displayName.trim() };
  await storeGuestSession(cleanSlug, next);

  if (!isBackendConfigured) return;
  try {
    await requireSupabase()
      .from('guest_sessions')
      .update({ display_name: next.displayName })
      .eq('id', stored.guestSessionId);
  } catch {
    // The local name is what the UI reads; a failed sync retries on next join.
  }
}

/**
 * Everything the entry screen shows before the guest submits a name.
 *
 * Read-only on purpose: landing on the invitation must not create a guest
 * session, or a host's "guests joined" count would include everyone who merely
 * opened the link and never took a photo.
 */
export async function fetchGuestEventPreview(slug: string): Promise<GuestEventPreview> {
  const stored = await loadStoredGuestSession(slug);

  try {
    if (!isBackendConfigured) throw new Error('Supabase not configured');
    const { data, error } = await (requireSupabase() as any).rpc('get_event_preview_by_code', {
      p_event_code: slug,
    });

    if (error) {
      console.error('[guest-preview] RPC get_event_preview_by_code failed', {
        slug,
        message: error.message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      });
      throw error;
    }

    const preview = data as unknown as {
      celebration_id: string;
      title: string;
      ends_at: string | null;
      shot_limit_per_guest: number | null;
      cover_storage_path: string | null;
      theme_accent?: string | null;
      default_theme_id?: string | null;
    } | null;

    // A code that matches nothing returns null, not an error. Say so plainly
    // rather than reading through it and throwing a TypeError that the catch
    // below would then disguise as a backend outage.
    if (!preview) {
      throw new Error(`No event found for code "${slug}".`);
    }

    return {
      celebrationId: preview.celebration_id,
      title: preview.title,
      endsAt: preview.ends_at,
      shotLimit: preview.shot_limit_per_guest,
      shotsUsed: stored?.shotsUsed ?? 0,
      coverStoragePath: preview.cover_storage_path,
      themeAccent:
        preview.theme_accent ??
        (await resolveThemeAccent(preview.default_theme_id ?? null)) ??
        null,
      existingDisplayName: stored?.displayName ?? null,
    };
  } catch (err) {
    // The offline fallback exists so the guest journey stays exercisable with
    // no backend. It must NOT run when a backend IS configured: doing so turns
    // every real failure — bad credentials, network, RLS, a missing row — into
    // the same "no longer available" message, which is undiagnosable and hid a
    // completely empty database for weeks.
    if (isBackendConfigured) {
      console.error('[guest-preview] backend configured but lookup failed', err);
      throw err instanceof Error ? err : new Error(String(err));
    }

    const raw = await AsyncStorage.getItem('__mock_celebrations');
    const list = raw ? (JSON.parse(raw) as any[]) : [];
    const found = list.find((item) => item.publicSlug === slug);

    if (!found) {
      throw new Error(`No event found for code "${slug}".`);
    }

    return {
      celebrationId: found.id,
      title: found.title,
      endsAt: found.primarySession?.ends_at ?? found.endsAt ?? null,
      shotLimit: found.primarySession?.shot_limit_per_guest ?? 20,
      shotsUsed: stored?.shotsUsed ?? 0,
      coverStoragePath: found.coverStoragePath ?? null,
      themeAccent: (await resolveThemeAccent(found.defaultThemeId ?? null)) ?? null,
      existingDisplayName: stored?.displayName ?? null,
    };
  }
}

export class GuestJoinError extends Error {}

/**
 * Claims a place at the event under the given name.
 *
 * The invitation token — not the slug — is the credential. It arrives in the
 * link's fragment so it never reaches a server log, and is passed straight
 * through to the RPC, which is the only thing that can exchange it for a
 * guest token.
 */
export async function joinEventSession(options: {
  slug: string;
  accessToken: string | null;
  displayName: string;
}): Promise<GuestSession> {
  const displayName = options.displayName.trim();
  if (!displayName) throw new GuestJoinError('Enter your name to join.');

  const cleanSlug = options.slug.trim().toLowerCase();
  const fingerprint = await getDeviceFingerprint();

  try {
    if (!isBackendConfigured) throw new Error('Supabase not configured');

    const client = requireSupabase();
    let rpcResult;

    if (options.accessToken) {
      rpcResult = await (client as any).rpc('join_event_session', {
        p_access_token: options.accessToken,
        p_device_fingerprint: fingerprint,
        p_display_name: displayName,
      });
    } else {
      rpcResult = await (client as any).rpc('join_event_by_code', {
        p_event_code: cleanSlug,
        p_device_fingerprint: fingerprint,
        p_display_name: displayName,
      });
    }

    if (rpcResult.error) throw new GuestJoinError(rpcResult.error.message);

    const joined = rpcResult.data as unknown as {
      guest_session_id: string;
      event_session_id: string;
      celebration_id: string;
      guest_token: string;
      display_name: string | null;
      shot_limit_per_guest: number | null;
      shots_used: number | null;
    };

    const session: GuestSession = {
      guestSessionId: joined.guest_session_id,
      eventSessionId: joined.event_session_id,
      celebrationId: joined.celebration_id,
      guestToken: joined.guest_token,
      displayName: joined.display_name ?? displayName,
      shotLimit: joined.shot_limit_per_guest,
      shotsUsed: joined.shots_used ?? 0,
    };

    await storeGuestSession(cleanSlug, session);
    return session;
  } catch (error) {
    if (error instanceof GuestJoinError) throw error;

    // Development fallback, mirroring the read path above.
    const preview = await fetchGuestEventPreview(cleanSlug);
    const session: GuestSession = {
      guestSessionId: `guest_${fingerprint}`,
      eventSessionId: `session_${preview.celebrationId}`,
      celebrationId: preview.celebrationId,
      guestToken: `local_${fingerprint}`,
      displayName,
      shotLimit: preview.shotLimit,
      shotsUsed: preview.shotsUsed,
    };

    await storeGuestSession(cleanSlug, session);
    return session;
  }
}

/**
 * Fetches event metadata, configuration, and allowed photo items securely
 * using the guest access token.
 */
export async function fetchGuestGallery(slug: string, guestToken: string) {
  const cleanSlug = slug.trim().toLowerCase();
  
  if (!isBackendConfigured) {
    // Development fallback
    const preview = await fetchGuestEventPreview(cleanSlug);
    const galleryVisibility = (await readMockGalleryVisibility(preview.celebrationId)) ?? 'all_guests';
    
    // Load mock photos to verify returning guest visual states
    const mockPhotosKey = `__mock_photos_${preview.celebrationId}`;
    let mockPhotos: any[] = [];
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const storedPhotos = window.localStorage.getItem(mockPhotosKey);
      if (storedPhotos) {
        try {
          mockPhotos = JSON.parse(storedPhotos);
        } catch {}
      }
    } else {
      const storedPhotos = await AsyncStorage.getItem(mockPhotosKey);
      if (storedPhotos) {
        try {
          mockPhotos = JSON.parse(storedPhotos);
        } catch {}
      }
    }

    return {
      celebration: {
        id: preview.celebrationId,
        title: preview.title,
        public_slug: cleanSlug,
        cover_storage_path: preview.coverStoragePath,
        ends_at: preview.endsAt,
        timezone: 'Europe/London',
      },
      session: {
        id: `session_${preview.celebrationId}`,
        name: 'Primary Session',
        reveal_mode: 'instant',
        reveal_at: null,
        gallery_visibility: galleryVisibility,
        shot_limit_per_guest: preview.shotLimit,
        guest_downloads_enabled: true,
        is_locked: galleryVisibility === 'hosts_only',
      },
      guest: {
        id: `guest_${guestToken}`,
        display_name: preview.existingDisplayName ?? 'Guest',
        shots_used: mockPhotos.length,
        shot_limit: preview.shotLimit,
      },
      photos: (galleryVisibility === 'hosts_only' ? [] : mockPhotos).map((p: any) => ({
        id: p.id || `photo_${Math.random()}`,
        storage_path: p.uri || p.storage_path,
        captured_at: p.captured_at || new Date().toISOString(),
        display_name: p.takenBy || 'Guest',
      })),
    };
  }

  try {
    const { data, error } = await (requireSupabase() as any).rpc('get_guest_gallery', {
      p_event_code: cleanSlug,
      p_guest_token: guestToken,
    });

    if (error) {
      console.error('[guest-gallery] RPC get_guest_gallery failed', {
        slug: cleanSlug,
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw error;
    }
    return data;
  } catch (err) {
    // Same discipline as fetchGuestEventPreview: a configured backend that
    // fails must surface the real error, not silently degrade to mock data —
    // that swallowing is what hid a missing table grant behind a generic
    // "invitation no longer available" for weeks.
    if (isBackendConfigured) {
      console.error('[guest-gallery] backend configured but lookup failed', err);
      throw err instanceof Error ? err : new Error(String(err));
    }

    const preview = await fetchGuestEventPreview(cleanSlug);
    const galleryVisibility = (await readMockGalleryVisibility(preview.celebrationId)) ?? 'all_guests';

    const mockPhotosKey = `__mock_photos_${preview.celebrationId}`;
    let mockPhotos: any[] = [];
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const storedPhotos = window.localStorage.getItem(mockPhotosKey);
      if (storedPhotos) {
        try {
          mockPhotos = JSON.parse(storedPhotos);
        } catch {}
      }
    } else {
      const storedPhotos = await AsyncStorage.getItem(mockPhotosKey);
      if (storedPhotos) {
        try {
          mockPhotos = JSON.parse(storedPhotos);
        } catch {}
      }
    }

    return {
      celebration: {
        id: preview.celebrationId,
        title: preview.title,
        public_slug: cleanSlug,
        cover_storage_path: preview.coverStoragePath,
        ends_at: preview.endsAt,
        timezone: 'Europe/London',
      },
      session: {
        id: `session_${preview.celebrationId}`,
        name: 'Primary Session',
        reveal_mode: 'instant',
        reveal_at: null,
        gallery_visibility: galleryVisibility,
        shot_limit_per_guest: preview.shotLimit,
        guest_downloads_enabled: true,
        is_locked: galleryVisibility === 'hosts_only',
      },
      guest: {
        id: `guest_${guestToken}`,
        display_name: preview.existingDisplayName ?? 'Guest',
        shots_used: mockPhotos.length,
        shot_limit: preview.shotLimit,
      },
      photos: (galleryVisibility === 'hosts_only' ? [] : mockPhotos).map((p: any) => ({
        id: p.id || `photo_${Math.random()}`,
        storage_path: p.uri || p.storage_path,
        captured_at: p.captured_at || new Date().toISOString(),
        display_name: p.takenBy || 'Guest',
      })),
    };
  }
}

/**
 * Uploads a guest photo to Supabase storage.
 *
 * 1. Creates a media upload intent via RPC
 * 2. Uploads raw binary or Blob to storage
 * 3. Finalizes the upload via RPC
 */
export async function uploadGuestPhoto(options: {
  eventSessionId: string;
  guestToken: string;
  fileBytes: Uint8Array | Blob;
  fileExtension: string;
}): Promise<string> {
  const client = requireSupabase();
  const clientMediaId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  
  // 1. Create Media Upload Intent
  const { data, error } = await (client as any).rpc('create_media_upload_intent', {
    p_event_session_id: options.eventSessionId,
    p_client_media_id: clientMediaId,
    p_media_type: 'photo',
    p_source: 'camera',
    p_mime_type: options.fileExtension === 'png' ? 'image/png' : 'image/jpeg',
    p_size_bytes: options.fileBytes instanceof Blob ? options.fileBytes.size : (options.fileBytes as Uint8Array).length,
    p_guest_token: options.guestToken,
    p_file_extension: options.fileExtension,
  });

  if (error) throw error;
  const intent = data as any;
  
  // 2. Upload file to Supabase storage bucket `media`
  const { error: uploadError } = await client.storage
    .from('media')
    .upload(intent.storage_path, options.fileBytes, {
      contentType: options.fileExtension === 'png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    });
    
  if (uploadError) throw uploadError;

  // 3. Finalize upload
  const { error: finaliseError } = await (client as any).rpc('finalise_media_upload', {
    p_media_item_id: intent.media_item_id,
    p_upload_intent_id: intent.upload_intent_id,
    p_guest_token: options.guestToken,
  });

  if (finaliseError) throw finaliseError;
  return intent.storage_path;
}

/** Compresses a web-captured file using HTML Canvas. */
export function compressImageWeb(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window context unavailable'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 2048;
        const MAX_HEIGHT = 2048;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas output empty'));
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Image decode error'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File load error'));
    reader.readAsDataURL(file);
  });
}
