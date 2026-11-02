import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { downscalePhotoForUpload } from '@/features/media/photo-downscale';
import { hostPortalKeys } from '@/services/host-portal';
import { uploadHostMedia } from '@/services/host-media-upload';

/**
 * Photos only. `create_host_media_upload_intent` refuses a video that did not
 * come from the camera, so a video from a computer cannot be accepted yet.
 *
 * HEIC is left out because Chrome and Firefox cannot decode it: it would upload
 * without its dimensions and then show as a broken image in those browsers.
 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const UPLOAD_ACCEPT = ACCEPTED_TYPES.join(',');

/** Gentle on a venue's or a home connection, and quick enough for a few hundred. */
const CONCURRENT_UPLOADS = 3;

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed';

export interface UploadJob {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
  /** Turned away before uploading: retrying could never help. */
  refused: boolean;
}

function rejectionReason(file: File): string | null {
  if (ACCEPTED_TYPES.includes(file.type)) return null;
  if (file.type.startsWith('video/')) return 'Videos can only be added from the app for now.';
  if (/image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return 'HEIC isn’t supported on the web yet. Export it as a JPEG and try again.';
  }
  return 'Only JPEG, PNG and WebP photos can be uploaded.';
}

export function useHostUploads({
  celebrationId,
  eventCode,
  eventSessionId,
}: {
  celebrationId: string;
  eventCode: string | null;
  eventSessionId: string;
}) {
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  function patch(id: string, next: Partial<UploadJob>) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...next } : job)));
  }

  async function uploadOne(job: UploadJob) {
    patch(job.id, { status: 'uploading', error: undefined });
    const sourceUrl = URL.createObjectURL(job.file);
    try {
      // The same delivery size every other upload is held to.
      const prepared = await downscalePhotoForUpload(sourceUrl);
      await uploadHostMedia({
        celebrationId,
        eventCode,
        localUri: prepared.uri,
        source: 'host_upload',
        mediaType: 'photo',
        mimeType: prepared.skipped ? job.file.type : 'image/jpeg',
        width: prepared.width ?? undefined,
        height: prepared.height ?? undefined,
        // The closest a browser gets to when the photo was taken. Without it
        // an upload of old photos would all read as taken just now.
        capturedAt: new Date(job.file.lastModified || Date.now()).toISOString(),
      });
      patch(job.id, { status: 'done' });
    } catch (error) {
      console.error('[host-portal] upload failed', job.file.name, error);
      patch(job.id, { status: 'failed', error: 'Upload failed. Check your connection and retry.' });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function run(batch: UploadJob[]) {
    const pending = [...batch];
    const worker = async () => {
      for (let job = pending.shift(); job; job = pending.shift()) {
        await uploadOne(job);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENT_UPLOADS }, worker));
    await queryClient.invalidateQueries({ queryKey: hostPortalKeys.gallery(eventSessionId) });
  }

  function addFiles(files: File[]) {
    const added = files.map((file) => {
      const reason = rejectionReason(file);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        status: reason ? 'failed' : 'queued',
        error: reason ?? undefined,
        refused: reason !== null,
      } satisfies UploadJob;
    });
    setJobs((current) => [...current, ...added]);
    void run(added.filter((job) => job.status === 'queued'));
  }

  function retryFailed() {
    const retryable = jobs.filter((job) => job.status === 'failed' && !job.refused);
    if (retryable.length === 0) return;
    const ids = new Set(retryable.map((job) => job.id));
    setJobs((current) =>
      current.map((job) => (ids.has(job.id) ? { ...job, status: 'queued', error: undefined } : job)),
    );
    void run(retryable);
  }

  function clearFinished() {
    setJobs((current) => current.filter((job) => job.status === 'queued' || job.status === 'uploading'));
  }

  return { jobs, addFiles, retryFailed, clearFinished };
}
