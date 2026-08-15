/**
 * A small JPEG frame grabbed from a locally recorded video, client-side,
 * right before upload — see the `thumbnail_storage_path` migration for why:
 * this project has no server-side worker to generate one after the fact, so
 * the moment right before upload (when the client already has the decoded
 * video in hand) is the cheapest place to produce one.
 *
 * Two implementations. Native uses `expo-video-thumbnails`, a real decode of
 * one frame via the platform's own video APIs. Web has no equivalent — the
 * package's own web target is a stub that never resolves — so this instead
 * plays the video into a hidden `<video>` element and rasterises the current
 * frame onto a `<canvas>`, which is cheap: unlike full transcoding, grabbing
 * one already-decoded frame needs no WebCodecs/ffmpeg.wasm.
 *
 * Never throws. A thumbnail is a nice-to-have for the gallery grid, not a
 * requirement for the post to succeed — every failure here resolves `null`,
 * and callers already treat that as "fall back to today's behaviour" for
 * that item, not as an upload failure.
 */

import { Platform } from 'react-native';

let VideoThumbnails: { getThumbnailAsync: Function } | null = null;
try {
  if (Platform.OS !== 'web') {
    VideoThumbnails = require('expo-video-thumbnails');
  }
} catch {
  // Not present in this build (e.g. before a native rebuild picks up the
  // new dependency) — falls back to no thumbnail below.
}

export type VideoThumbnailResult = {
  /** file:// (native) or data: (web) — read the same way any other locally
   *  produced media is, via `readLocalMediaBytes`. */
  uri: string;
  mimeType: string;
  width: number;
  height: number;
};

/** Long side of the generated thumbnail — a grid cell, not a full frame. */
const MAX_THUMBNAIL_LONG_SIDE = 640;

async function generateNativeThumbnail(videoUri: string): Promise<VideoThumbnailResult | null> {
  if (!VideoThumbnails) return null;
  try {
    const result = await VideoThumbnails.getThumbnailAsync(videoUri, { quality: 0.6, time: 0 });
    if (!result?.uri) return null;
    return { uri: result.uri, mimeType: 'image/jpeg', width: result.width, height: result.height };
  } catch (error) {
    console.warn('[video-thumbnail] native thumbnail generation failed', error);
    return null;
  }
}

function generateWebThumbnail(videoUri: string): Promise<VideoThumbnailResult | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: VideoThumbnailResult | null) => {
      if (settled) return;
      settled = true;
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(result);
    };

    function draw() {
      try {
        const naturalWidth = video.videoWidth;
        const naturalHeight = video.videoHeight;
        if (!naturalWidth || !naturalHeight) {
          finish(null);
          return;
        }
        const longSide = Math.max(naturalWidth, naturalHeight);
        const scale = longSide > MAX_THUMBNAIL_LONG_SIDE ? MAX_THUMBNAIL_LONG_SIDE / longSide : 1;
        const width = Math.max(2, Math.round(naturalWidth * scale));
        const height = Math.max(2, Math.round(naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        finish({ uri: dataUrl, mimeType: 'image/jpeg', width, height });
      } catch (error) {
        console.warn('[video-thumbnail] web canvas draw failed', error);
        finish(null);
      }
    }

    function onSeeked() {
      draw();
    }

    function onLoadedData() {
      // The very first frame is sometimes still black on some browsers —
      // nudging slightly forward gets a decoded, representative frame
      // instead. `seeked` fires the actual draw.
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      } catch {
        draw();
      }
    }

    function onError() {
      finish(null);
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadeddata', onLoadedData, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = videoUri;
    video.load();

    // A stalled element (revoked blob, unsupported codec) must never hang
    // the post — the caller is waiting on this before it can upload.
    setTimeout(() => finish(null), 4000);
  });
}

export async function generateVideoThumbnail(videoUri: string): Promise<VideoThumbnailResult | null> {
  try {
    return Platform.OS === 'web'
      ? await generateWebThumbnail(videoUri)
      : await generateNativeThumbnail(videoUri);
  } catch (error) {
    console.warn('[video-thumbnail] thumbnail generation failed', error);
    return null;
  }
}
