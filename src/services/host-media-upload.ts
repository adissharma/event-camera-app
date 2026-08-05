import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import { requireSupabase } from '@/lib/supabase/client';
import { inferMimeTypeFromUri } from '@/features/media/storage-paths';
import type { MediaSource } from '@/types/database';

/**
 * Real host media upload pipeline — mirrors `guest-media-upload.ts` so a
 * host's own camera captures and camera-roll picks go through the same real
 * backend and the same real gallery a guest's do, rather than the separate
 * local-mock path they were left on when the guest pipeline was built first.
 *
 * Simpler than the guest version: a host already has standing, authenticated
 * storage RLS (`event media: workspace managers write` / `workspace members
 * read`), so the upload step just needs a valid session — no anonymous-
 * identity problem to work around with a consumed-intent trick. See
 * `20260804180000_host_media_upload_pipeline.sql`.
 */

export interface UploadHostPhotoParams {
  celebrationId: string;
  /** file:// URI on native, blob:/data: on web. */
  localUri: string;
  source: MediaSource;
  /** From the picker/camera asset when known; inferred from the URI otherwise. */
  mimeType?: string;
  width?: number;
  height?: number;
  capturedAt?: string;
}

export interface UploadHostPhotoResult {
  mediaItemId: string;
  storagePath: string;
}

export async function uploadHostPhoto(
  params: UploadHostPhotoParams,
): Promise<UploadHostPhotoResult> {
  const client = requireSupabase();
  const mimeType = params.mimeType ?? inferMimeTypeFromUri(params.localUri);
  const file = new File(params.localUri);
  const fileSizeBytes = file.size ?? null;

  const { data: intentData, error: intentError } = await (client as any).rpc(
    'create_host_media_upload_intent',
    {
      p_celebration_id: params.celebrationId,
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
    'finalize_host_media_upload',
    {
      p_media_item_id: intent.media_item_id,
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
  };

  return {
    mediaItemId: result.media_item_id,
    storagePath: result.storage_path,
  };
}
