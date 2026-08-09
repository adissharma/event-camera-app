import AsyncStorage from '@react-native-async-storage/async-storage';

import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';
import { BRAND_CONFIG } from '@/config/brand';
import { STORAGE_BUCKETS } from '@/config/app-config';
import { buildCoverPath, normaliseExtension, inferMimeTypeFromUri } from '@/features/media/storage-paths';
import { readLocalImageBytes } from '@/features/media/read-local-image';
import { getPaymentProvider } from '@/features/payments';
import { resolveReveal, type CreationDraft } from '@/features/celebrations/draft/types';
import { assertCreatedCelebration } from '@/types/database';

export interface PublishedEvent {
  celebrationId: string;
  eventSessionId: string;
  publicSlug: string;
  eventCode: string;
  /** The full link a guest opens. Contains the token — treat as a secret. */
  guestUrl: string;
  wasAlreadyPublished: boolean;

  // Snapshotted at publication. The success screen clears the local draft on
  // mount — the event now lives on the server — so it cannot render from it.
  // Reading the draft after resetting it showed every published event as
  // "Your event" with no closing time.
  eventName: string;
  supportingLine: string | null;
  endsAt: string | null;
  timezone: string;
  /** The host's chosen cover, so the success screen opens on their photograph. */
  coverStoragePath: string | null;
}

export class PublicationError extends Error {
  constructor(
    message: string,
    readonly stage: 'draft' | 'cover' | 'purchase' | 'publish',
  ) {
    super(message);
    this.name = 'PublicationError';
  }
}

/**
 * Builds the link a guest opens.
 *
 * The token goes in the URL FRAGMENT, not the query string. A fragment is never
 * sent to the server, so the token stays out of access logs, out of the
 * `Referer` header when the guest page loads third-party resources, and out of
 * any analytics that record full paths. For a bearer credential printed on a
 * poster, that matters.
 *
 * Uses event code (6-char random) instead of public slug for better security.
 */
export function buildGuestUrl(eventCode: string, token: string): string {
  return `${BRAND_CONFIG.guestDomain}/j/${eventCode}#t=${token}`;
}

async function resolveThemeId(themeKey: string | null | undefined): Promise<string | undefined> {
  if (!themeKey) return undefined;

  const client = requireSupabase();
  const lookup = async (column: 'slug' | 'id') => {
    const { data, error } = await client
      .from('themes')
      .select('id')
      .eq(column, themeKey)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  };

  return (await lookup('slug')) ?? (await lookup('id')) ?? undefined;
}

/**
 * Publishes a draft.
 *
 * Ordered so that nothing irreversible happens before the server has the draft:
 *
 *   1. create the celebration, session and access link atomically
 *   2. upload the cover
 *   3. purchase
 *   4. publish and activate entitlements
 *
 * A purchase that succeeds against a draft the server never received is the
 * worst outcome available — the customer is charged for an event that does not
 * exist. Creating first makes that impossible.
 */
export async function publishDraft(
  draft: CreationDraft,
  existingCelebrationId?: string,
): Promise<PublishedEvent> {
  try {
    if (!isBackendConfigured) {
      throw new Error('Supabase not configured');
    }
    const client = requireSupabase();
    const reveal = resolveReveal(draft.guestRevealChoice, draft.endsAt, draft.guestCustomRevealAt);
    const themeId = await resolveThemeId(draft.themeSlug);

    let celebrationId = existingCelebrationId;
    let eventSessionId: string | undefined;
    let publicSlug: string | undefined;
    let guestToken: string | undefined;

    // 1. Server-side draft.
    if (!celebrationId) {
      const { data, error } = await client.rpc('create_celebration_with_default_session', {
        p_title: draft.title.trim(),
        p_session_name: 'Main event',
        p_celebration_type: draft.celebrationType,
        p_inspiration_pack: draft.inspirationPack,
        p_timezone: draft.timezone,
        // The generated RPC types use optional params, not nullable ones, so a
        // null has to become an omission rather than an explicit null.
        p_ends_at: draft.endsAt ?? undefined,
        p_capture_mode: draft.captureMode,
        p_shot_limit_per_guest: draft.shotLimitPerGuest ?? undefined,
        p_camera_roll_upload_limit: draft.cameraRollUploadLimit,
        p_reveal_mode: reveal.mode,
        p_reveal_at: reveal.revealAt ?? undefined,
        p_gallery_visibility: draft.galleryVisibility,
        p_photo_treatment: draft.photoTreatment,
        p_theme_id: themeId,
      });

      if (error) throw new PublicationError(error.message, 'draft');

      const created = assertCreatedCelebration(data as never);
      celebrationId = created.celebrationId;
      eventSessionId = created.eventSessionId;
      publicSlug = created.publicSlug;
      // The ONLY moment this exists in plaintext. Only its digest is stored.
      guestToken = created.guestAccessToken;
    }

    // 2. Cover upload. Non-fatal: an event without a cover still works, and
    // failing the whole publication over an image would be disproportionate.
    if (draft.coverLocalUri && celebrationId) {
      try {
        await uploadCover(draft.coverLocalUri, celebrationId);
      } catch (error) {
        // Still non-fatal — an event without a cover works, and failing a
        // whole publication over an image would be disproportionate. Logged
        // rather than silently dropped, though: swallowing this without a
        // trace is what let a cover upload that never worked on web look
        // like a host had simply not chosen one.
        console.error('[publication] cover upload failed', error);
      }
    }

    // 3. Purchase.
    const provider = getPaymentProvider();
    if (draft.planKey) {
      const [product] = await provider.getProducts([draft.planKey]);
      if (product) {
        const outcome = await provider.purchase(product);
        if (outcome.status === 'cancelled') {
          throw new PublicationError('Purchase cancelled', 'purchase');
        }
        if (outcome.status === 'failed') {
          throw new PublicationError(outcome.message, 'purchase');
        }
      }
    }
    for (const addOnKey of draft.addOnKeys) {
      const [product] = await provider.getProducts([addOnKey]);
      if (product) {
        const outcome = await provider.purchase(product);
        if (outcome.status === 'cancelled') {
          throw new PublicationError('Purchase cancelled', 'purchase');
        }
        if (outcome.status === 'failed') {
          throw new PublicationError(outcome.message, 'purchase');
        }
      }
    }

    // 4. Publish. Idempotent server-side, so a retry here is safe.
    const { data: publishData, error: publishError } = await client.rpc('publish_celebration', {
      p_celebration_id: celebrationId!,
      p_plan_key: draft.planKey ?? undefined,
      p_add_on_keys: draft.addOnKeys,
    });

    if (publishError) throw new PublicationError(publishError.message, 'publish');

    const published = publishData as unknown as {
      celebration_id: string;
      event_session_id: string;
      public_slug: string;
      event_code: string;
      was_already_published: boolean;
    };

    return {
      celebrationId: published.celebration_id ?? celebrationId!,
      eventSessionId: published.event_session_id ?? eventSessionId!,
      publicSlug: published.public_slug ?? publicSlug!,
      eventCode: published.event_code,
      guestUrl: buildGuestUrl(published.event_code, guestToken ?? ''),
      wasAlreadyPublished: published.was_already_published ?? false,
      eventName: draft.title.trim(),
      supportingLine: draft.supportingLine.trim() || null,
      endsAt: draft.endsAt,
      timezone: draft.timezone,
      coverStoragePath: draft.coverLocalUri ?? null,
    };
  } catch (e) {
    // Only the typed development fallback (no real backend at all) should
    // ever produce a local-only mock event. A configured backend that fails
    // mid-publish must surface the real error — `review.tsx` already has
    // stage-aware handling for exactly this. Swallowing it here instead
    // silently created a mock event with a non-UUID id, which the success
    // screen then reported as published; every real screen that reads it back
    // from Supabase failed with "invalid input syntax for type uuid", since
    // the celebration this id refers to was never actually created there.
    if (isBackendConfigured) {
      throw e instanceof PublicationError ? e : new PublicationError(
        e instanceof Error ? e.message : 'Failed to publish celebration', 'draft',
      );
    }

    console.warn('Supabase not configured; falling back to local mock storage:', e);

    const mockId = 'celebration-' + Math.random().toString(36).substring(2, 11);
    const mockSlug = 'slug-' + Math.random().toString(36).substring(2, 11);
    const mockEventCode = 'ABC' + Math.random().toString(36).substring(2, 5).toUpperCase();
    const mockSessionId = 'session-' + Math.random().toString(36).substring(2, 11);
    
    const newMockEvent = {
      id: mockId,
      title: draft.title.trim(),
      status: 'live',
      coverStoragePath: draft.coverLocalUri, // Use local cover URI as fallback path
      publicSlug: mockSlug,
      startsAt: new Date().toISOString(),
      endsAt: draft.endsAt,
      timezone: draft.timezone,
      defaultThemeId: draft.themeSlug,
      primarySession: {
        id: mockSessionId,
        name: 'Main event',
        status: 'live',
        ends_at: draft.endsAt,
        reveal_at: null,
        reveal_mode: 'instant',
        capture_mode: draft.captureMode,
      }
    };

    const existingMockData = await AsyncStorage.getItem('__mock_celebrations');
    let mockList = [];
    if (existingMockData) {
      try {
        mockList = JSON.parse(existingMockData);
      } catch {}
    }
    mockList.unshift(newMockEvent);
    await AsyncStorage.setItem('__mock_celebrations', JSON.stringify(mockList));

    return {
      celebrationId: mockId,
      eventSessionId: mockSessionId,
      publicSlug: mockSlug,
      eventCode: mockEventCode,
      guestUrl: `${BRAND_CONFIG.guestDomain}/j/${mockEventCode}#t=local_token`,
      wasAlreadyPublished: false,
      eventName: draft.title.trim(),
      supportingLine: draft.supportingLine.trim() || null,
      endsAt: draft.endsAt,
      timezone: draft.timezone,
      coverStoragePath: draft.coverLocalUri ?? null,
    };
  }
}

/** Uploads the cover to its private bucket. */
export async function uploadCover(localUri: string, celebrationId: string): Promise<string> {
  const client = requireSupabase();

  const { data: celebration, error } = await client
    .from('celebrations')
    .select('workspace_id, cover_storage_path')
    .eq('id', celebrationId)
    .single();

  if (error || !celebration) throw new PublicationError('Could not find the event', 'cover');

  const previousPath = celebration.cover_storage_path;

  // `readLocalImageBytes` rather than `expo-file-system` directly: that module
  // is a native-only bridge whose web build is a stub, so reading a picked
  // cover threw on web and the upload never happened. It handles `file://` on
  // native and `blob:`/`data:` in the browser, and reports the Blob's own MIME
  // type — which is the only reliable source for a `blob:` URI, whose string
  // is an opaque UUID with no extension to read.
  const { bytes, mimeType } = await readLocalImageBytes(localUri);
  const resolvedMime = mimeType || inferMimeTypeFromUri(localUri);
  const extension = normaliseExtension(resolvedMime.split('/').pop() ?? 'jpg');
  const path = buildCoverPath(celebration.workspace_id, celebrationId, extension);

  const { error: uploadError } = await client.storage
    .from(STORAGE_BUCKETS.covers)
    .upload(path, bytes, {
      contentType: resolvedMime.startsWith('image/') ? resolvedMime : 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw new PublicationError(uploadError.message, 'cover');

  await client
    .from('celebrations')
    .update({ cover_storage_path: path })
    .eq('id', celebrationId);

  // Best-effort tidy-up of the object this one replaces. Deliberately after
  // the row points at the new path, and deliberately non-fatal: a leftover
  // file is a housekeeping matter, whereas deleting first would leave the
  // event with no cover at all if the upload then failed.
  if (previousPath && previousPath !== path) {
    const { error: removeError } = await client.storage
      .from(STORAGE_BUCKETS.covers)
      .remove([previousPath]);
    if (removeError) {
      console.warn('[publication] could not remove the previous cover', removeError);
    }
  }

  return path;
}
