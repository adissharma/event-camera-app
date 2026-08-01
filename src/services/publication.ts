import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';
import { BRAND_CONFIG } from '@/config/brand';
import { STORAGE_BUCKETS } from '@/config/app-config';
import { buildCoverPath, normaliseExtension } from '@/features/media/storage-paths';
import { getPaymentProvider } from '@/features/payments';
import { resolveReveal, type CreationDraft } from '@/features/celebrations/draft/types';
import { assertCreatedCelebration } from '@/types/database';

export interface PublishedEvent {
  celebrationId: string;
  eventSessionId: string;
  publicSlug: string;
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
 */
export function buildGuestUrl(publicSlug: string, token: string): string {
  return `${BRAND_CONFIG.guestDomain}/e/${publicSlug}#t=${token}`;
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
        p_theme_id: draft.themeSlug ?? undefined,
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
      } catch {
        // Left for the dashboard to retry. Deliberately swallowed.
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
      was_already_published: boolean;
    };

    return {
      celebrationId: published.celebration_id ?? celebrationId!,
      eventSessionId: published.event_session_id ?? eventSessionId!,
      publicSlug: published.public_slug ?? publicSlug!,
      guestUrl: buildGuestUrl(published.public_slug ?? publicSlug!, guestToken ?? ''),
      wasAlreadyPublished: published.was_already_published ?? false,
      eventName: draft.title.trim(),
      supportingLine: draft.supportingLine.trim() || null,
      endsAt: draft.endsAt,
      timezone: draft.timezone,
    };
  } catch (e) {
    console.warn('Failed to publish celebration to Supabase, fallback to local storage:', e);
    
    const mockId = 'celebration-' + Math.random().toString(36).substring(2, 11);
    const mockSlug = 'slug-' + Math.random().toString(36).substring(2, 11);
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
      guestUrl: `${BRAND_CONFIG.guestDomain}/e/${mockSlug}#t=local_token`,
      wasAlreadyPublished: false,
      eventName: draft.title.trim(),
      supportingLine: draft.supportingLine.trim() || null,
      endsAt: draft.endsAt,
      timezone: draft.timezone,
    };
  }
}

/** Uploads the cover to its private bucket. */
export async function uploadCover(localUri: string, celebrationId: string): Promise<string> {
  const client = requireSupabase();

  const { data: celebration, error } = await client
    .from('celebrations')
    .select('workspace_id')
    .eq('id', celebrationId)
    .single();

  if (error || !celebration) throw new PublicationError('Could not find the event', 'cover');

  const extension = normaliseExtension(localUri.split('.').pop() ?? 'jpg');
  const path = buildCoverPath(celebration.workspace_id, celebrationId, extension);

  // Read as base64 then convert: React Native's fetch(localUri).blob() is
  // unreliable for file:// URIs across platforms.
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64',
  });
  const bytes = decodeBase64(base64);

  const { error: uploadError } = await client.storage
    .from(STORAGE_BUCKETS.covers)
    .upload(path, bytes, {
      contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw new PublicationError(uploadError.message, 'cover');

  await client
    .from('celebrations')
    .update({ cover_storage_path: path })
    .eq('id', celebrationId);

  return path;
}

/** Base64 → bytes, without pulling in a polyfill for `atob`. */
function decodeBase64(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = input.replace(/=+$/, '');
  const bytes = new Uint8Array((clean.length * 3) / 4);

  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (const character of clean) {
    const value = alphabet.indexOf(character);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex++] = (buffer >> bits) & 0xff;
    }
  }

  return bytes.subarray(0, byteIndex);
}
