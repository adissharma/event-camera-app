import * as Crypto from 'expo-crypto';

import { requireSupabase } from '@/lib/supabase/client';
import { inferMediaTypeFromMimeType, inferMimeTypeFromUri, normaliseMimeType } from '@/features/media/storage-paths';
import { readLocalMediaBytes } from '@/features/media/read-local-image';
import type { MediaSource, MediaType } from '@/types/database';

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

export interface UploadHostMediaParams {
  celebrationId: string;
  /** file:// URI on native, blob:/data: on web. */
  localUri: string;
  source: MediaSource;
  mediaType?: Extract<MediaType, 'photo' | 'video' | 'audio'>;
  /** From the picker/camera asset when known; inferred from the URI otherwise. */
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number | null;
  capturedAt?: string;
  metadata?: Record<string, unknown>;
  /**
   * A client-generated poster frame for a video (see `video-thumbnail.ts`).
   * Only uploaded when the create-intent RPC actually reserved a thumbnail
   * path for this item (video only) — silently ignored otherwise. Never
   * blocks or fails the media upload itself; see `uploadHostMedia`.
   */
  thumbnailLocalUri?: string;
  thumbnailMimeType?: string;
}

export interface UploadHostMediaResult {
  mediaItemId: string;
  storagePath: string;
}

export type UploadHostPhotoParams = UploadHostMediaParams;
export type UploadHostPhotoResult = UploadHostMediaResult;

export async function uploadHostMedia(
  params: UploadHostMediaParams,
): Promise<UploadHostMediaResult> {
  const client = requireSupabase();
  const requestedMimeType = normaliseMimeType(params.mimeType ?? inferMimeTypeFromUri(params.localUri));
  const mediaType = params.mediaType ?? inferMediaTypeFromMimeType(requestedMimeType);
  const { bytes, sizeBytes: fileSizeBytes, mimeType: detectedMimeType } = await readLocalMediaBytes(params.localUri);
  const mimeType =
    requestedMimeType ||
    normaliseMimeType(detectedMimeType) ||
    normaliseMimeType(inferMimeTypeFromUri(params.localUri));
  const mediaLabel =
    mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'photo';

  if (!fileSizeBytes || fileSizeBytes <= 0 || bytes.byteLength <= 0) {
    throw new Error(`${mediaLabel} upload aborted: local file is empty (${params.localUri}).`);
  }

  const { data: intentData, error: intentError } = await (client as any).rpc(
    'create_host_media_upload_intent',
    {
      p_celebration_id: params.celebrationId,
      p_client_media_id: Crypto.randomUUID(),
      p_media_type: mediaType,
      p_source: params.source,
      p_mime_type: mimeType,
      p_file_size_bytes: fileSizeBytes,
      p_captured_at: params.capturedAt ?? new Date().toISOString(),
      p_metadata: params.metadata ?? {},
    },
  );

  if (intentError) throw new Error(`Host ${mediaLabel} upload intent failed: ${intentError.message}`);

  const intent = intentData as {
    media_item_id: string;
    upload_intent_id: string;
    bucket: string;
    storage_path: string;
    thumbnail_storage_path: string | null;
  };

  const { error: uploadError } = await client.storage
    .from(intent.bucket)
    .upload(intent.storage_path, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) throw new Error(`Host ${mediaLabel} storage upload failed: ${uploadError.message}`);

  // Best-effort and entirely separate from the media upload above: a failed
  // or skipped thumbnail never blocks or fails the post itself — the grid
  // just falls back to today's video-as-poster behaviour for this item.
  let thumbnailUploaded = false;
  if (params.thumbnailLocalUri && intent.thumbnail_storage_path) {
    try {
      const thumbnail = await readLocalMediaBytes(params.thumbnailLocalUri);
      const { error: thumbnailError } = await client.storage
        .from(intent.bucket)
        .upload(intent.thumbnail_storage_path, thumbnail.bytes, {
          contentType: params.thumbnailMimeType ?? 'image/jpeg',
          upsert: false,
        });
      thumbnailUploaded = !thumbnailError;
      if (thumbnailError) {
        console.warn('[host-media-upload] thumbnail upload failed', thumbnailError);
      }
    } catch (error) {
      console.warn('[host-media-upload] thumbnail upload failed', error);
    }
  }

  const { data: finalizeData, error: finalizeError } = await (client as any).rpc(
    'finalize_host_media_upload',
    {
      p_media_item_id: intent.media_item_id,
      p_file_size_bytes: fileSizeBytes ?? bytes.byteLength,
      p_mime_type: mimeType,
      p_width: params.width ?? null,
      p_height: params.height ?? null,
      p_duration_ms: params.durationMs ?? null,
      p_thumbnail_uploaded: thumbnailUploaded,
    },
  );

  if (finalizeError) throw new Error(`Host ${mediaLabel} finalisation failed: ${finalizeError.message}`);

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

export async function uploadHostPhoto(
  params: UploadHostPhotoParams,
): Promise<UploadHostPhotoResult> {
  return uploadHostMedia({ ...params, mediaType: 'photo' });
}
