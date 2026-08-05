import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import { requireSupabase } from '@/lib/supabase/client';
import { inferMimeTypeFromUri } from '@/features/media/storage-paths';
import type { MediaSource } from '@/types/database';

/**
 * Real guest media upload pipeline (camera capture and camera-roll picks).
 *
 * Three network round-trips, mirroring `media_status`'s legal transitions
 * (see `src/features/media/state-machine.ts`):
 *
 *   1. Request an intent — validates the guest against `capture_mode` and the
 *      shot limit, and reserves a media_items row + storage path.
 *   2. Upload the bytes directly to that path. The path is writable only
 *      because a live `upload_intents` row for it exists (see
 *      `20260804160000_guest_media_upload_pipeline.sql`) — not because the
 *      guest has any standing access to the bucket.
 *   3. Finalize — marks the item `ready` and returns the guest's updated
 *      shots-used count, computed server-side from `ready` items only. A
 *      failed or abandoned upload never reaches this step, so the guest's
 *      allowance is never reduced for it — there is nothing to roll back.
 */

export interface UploadGuestPhotoParams {
  eventCode: string;
  guestToken: string;
  /** file:// URI on native, blob:/data: on web. */
  localUri: string;
  source: MediaSource;
  /** From the picker/camera asset when known; inferred from the URI otherwise. */
  mimeType?: string;
  width?: number;
  height?: number;
  capturedAt?: string;
}

export interface UploadGuestPhotoResult {
  mediaItemId: string;
  storagePath: string;
  /** The guest's total shots used after this upload, from the server. */
  shotsUsed: number;
}

export async function uploadGuestPhoto(
  params: UploadGuestPhotoParams,
): Promise<UploadGuestPhotoResult> {
  const client = requireSupabase();
  const mimeType = params.mimeType ?? inferMimeTypeFromUri(params.localUri);
  const file = new File(params.localUri);
  const fileSizeBytes = file.size ?? null;

  const { data: intentData, error: intentError } = await (client as any).rpc(
    'create_guest_media_upload_intent',
    {
      p_event_code: params.eventCode,
      p_guest_token: params.guestToken,
      p_client_media_id: Crypto.randomUUID(),
      p_source: params.source,
      p_mime_type: mimeType,
      p_file_size_bytes: fileSizeBytes,
      p_captured_at: params.capturedAt ?? new Date().toISOString(),
    },
  );

  if (intentError) throw intentError;

  const intent = intentData as {
    media_item_id: string;
    upload_intent_id: string;
    bucket: string;
    storage_path: string;
  };

  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await client.storage
    .from(intent.bucket)
    .upload(intent.storage_path, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) throw uploadError;

  const { data: finalizeData, error: finalizeError } = await (client as any).rpc(
    'finalize_guest_media_upload',
    {
      p_media_item_id: intent.media_item_id,
      p_guest_token: params.guestToken,
      p_file_size_bytes: fileSizeBytes ?? bytes.byteLength,
      p_mime_type: mimeType,
      p_width: params.width ?? null,
      p_height: params.height ?? null,
    },
  );

  if (finalizeError) throw finalizeError;

  const result = finalizeData as {
    media_item_id: string;
    status: string;
    storage_path: string;
    shots_used: number;
  };

  return {
    mediaItemId: result.media_item_id,
    storagePath: result.storage_path,
    shotsUsed: result.shots_used,
  };
}
