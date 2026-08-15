/**
 * On-device video compression, shared by every video-recording surface in
 * the app (main gallery, Challenge, Guestbook) since they all post through
 * `commitVideo` in `camera.tsx`.
 *
 * Native only. `react-native-compressor` wraps AVFoundation on iOS and
 * MediaCodec on Android — real hardware/software encoders already present
 * on the device, so there is nothing to bundle and nothing GPL-encumbered
 * to ship (ruling out `ffmpeg-kit-react-native`, which was retired by its
 * maintainer and is no longer receiving updates). There is no web
 * equivalent: transcoding a video in a browser tab means either the
 * (Chromium-only) WebCodecs API or an ffmpeg.wasm build, both a much larger
 * lift than this pass covers, and the browser's own `MediaRecorder` already
 * produces a reasonably-sized file at capture time. Web input is returned
 * unchanged.
 *
 * The library exposes a `bitrate` control but not CRF — neither AVFoundation
 * nor MediaCodec take a CRF parameter, so there is no way to ask an on-device
 * encoder for one. `estimateTargetBitrate` below is this module's stand-in:
 * a bits-per-pixel-per-frame target high enough to read as visually lossless
 * on a phone screen, used with `compressionMethod: 'manual'` specifically
 * to bypass the library's own "auto" estimate — which is tuned for
 * WhatsApp-sized chat clips and produces visibly blocky output at the
 * quality bar this app wants for a wedding video.
 */

import { Platform } from 'react-native';
import { File } from 'expo-file-system';

let Compressor: { compress: Function; getVideoMetaData: Function } | null = null;
try {
  Compressor = require('react-native-compressor').Video;
} catch {
  // Not present in this build (e.g. before a native rebuild picks up the
  // new dependency) — every call below falls back to the original file.
}

export type VideoCompressionResult = {
  uri: string;
  /** Null when unknown — the caller already has its own value to fall back to. */
  width: number | null;
  height: number | null;
  sizeBytes: number;
  /** True when `uri` is the original, untouched recording. Not a failure by
   *  itself — an already-efficient source skips compression the same way a
   *  failed one falls back to it. */
  skipped: boolean;
  skipReason?: string;
};

export type CompressVideoOptions = {
  uri: string;
  /** From the recorder's own timer — the ground truth for the sanity check
   *  against the compressed output's reported duration. */
  expectedDurationMs: number;
  /** 0..1. Fired only while an actual transcode is running (never for a
   *  source the library decided to leave alone). */
  onProgress?: (progress: number) => void;
};

/** 1080p long side. Never upscale — only ever shrinks a larger source. */
const MAX_DELIVERY_LONG_SIDE = 1920;

/** Below this, whatever compression could save isn't worth the wait. */
const MINIMUM_SOURCE_SIZE_FOR_COMPRESSION_MB = 1;

/**
 * ~0.11 bits per pixel per frame sits in the band commonly cited as the
 * floor for H.264 output that reads as visually lossless — well above the
 * library's own WhatsApp-tuned "auto" bands (roughly 0.02-0.05 bpp at these
 * resolutions), which is exactly why this module uses `manual` mode instead
 * of leaning on that default.
 */
const TARGET_BITS_PER_PIXEL_PER_FRAME = 0.11;
const MIN_BITRATE_BPS = 1_200_000;

/**
 * This app's cameras have no slow-motion/high-frame-rate capture mode —
 * `camera.tsx` never requests one — so every recording is the device's
 * standard-rate capture. `getVideoMetaData` doesn't report frame rate on
 * either platform, so this is asserted rather than measured; if a
 * high-frame-rate capture path is ever added, this needs to become a real
 * reading (the encoder's own frame-rate cap and preservation already work
 * correctly regardless — only this bitrate estimate assumes 30).
 */
const ASSUMED_SOURCE_FPS = 30;

function estimateTargetBitrate(
  width: number,
  height: number,
  sourceBitrateBps: number,
): number {
  const pixels = Math.max(width * height, 1);
  const target = Math.round(pixels * ASSUMED_SOURCE_FPS * TARGET_BITS_PER_PIXEL_PER_FRAME);
  // Never ask for more than the source already had — that would grow the
  // file, not shrink it — and always leave a margin below it.
  const capBySource = sourceBitrateBps > 0 ? Math.round(sourceBitrateBps * 0.92) : target;
  return Math.max(MIN_BITRATE_BPS, Math.min(target, capBySource));
}

function evenDimension(value: number): number {
  const rounded = Math.max(Math.round(value), 2);
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/** Long side capped at 1080p; never upscales, always preserves aspect ratio. */
function scaledDimensions(width: number, height: number, maxLongSide: number) {
  const safeWidth = evenDimension(width);
  const safeHeight = evenDimension(height);
  const longSide = Math.max(safeWidth, safeHeight);
  if (longSide <= maxLongSide) return { width: safeWidth, height: safeHeight };
  const scale = maxLongSide / longSide;
  return { width: evenDimension(safeWidth * scale), height: evenDimension(safeHeight * scale) };
}

function readLocalFileSizeBytes(uri: string): number {
  try {
    const info = new File(uri).info();
    return info.exists && typeof info.size === 'number' ? info.size : 0;
  } catch {
    return 0;
  }
}

function deleteLocalFileQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.info().exists) file.delete();
  } catch (error) {
    console.warn('[video-compression] could not remove a temporary file', error);
  }
}

function unchangedResult(
  uri: string,
  reason: string,
  knownSizeBytes?: number,
  width?: number,
  height?: number,
): VideoCompressionResult {
  return {
    uri,
    width: width ?? null,
    height: height ?? null,
    sizeBytes: knownSizeBytes && knownSizeBytes > 0 ? knownSizeBytes : readLocalFileSizeBytes(uri),
    skipped: true,
    skipReason: reason,
  };
}

/**
 * Compresses a locally-recorded video for upload, or explains why it isn't
 * being touched. Never throws — every failure path falls back to the
 * original file rather than losing the recording, per the caller's own
 * upload flow already treating `skipped: true` as "just upload this uri".
 */
export async function compressVideoForUpload(
  options: CompressVideoOptions,
): Promise<VideoCompressionResult> {
  if (Platform.OS === 'web' || !Compressor) {
    return unchangedResult(options.uri, 'not supported on this platform');
  }

  let originalSizeBytes = 0;
  let sourceWidth: number | undefined;
  let sourceHeight: number | undefined;

  try {
    const source = await Compressor.getVideoMetaData(options.uri);
    originalSizeBytes = Number(source?.size) || readLocalFileSizeBytes(options.uri);
    sourceWidth = Number(source?.width) || undefined;
    sourceHeight = Number(source?.height) || undefined;
    const sourceDurationSec = Number(source?.duration) || options.expectedDurationMs / 1000;
    const sourceBitrateBps =
      sourceDurationSec > 0 && originalSizeBytes > 0
        ? Math.round((originalSizeBytes * 8) / sourceDurationSec)
        : 0;

    if (!sourceWidth || !sourceHeight) {
      return unchangedResult(options.uri, 'could not read source video dimensions', originalSizeBytes);
    }

    const { width: targetWidth, height: targetHeight } = scaledDimensions(
      sourceWidth,
      sourceHeight,
      MAX_DELIVERY_LONG_SIDE,
    );
    const targetBitrate = estimateTargetBitrate(targetWidth, targetHeight, sourceBitrateBps);

    const compressedUri: string = await Compressor.compress(
      options.uri,
      {
        compressionMethod: 'manual',
        bitrate: targetBitrate,
        maxSize: MAX_DELIVERY_LONG_SIDE,
        minimumFileSizeForCompress: MINIMUM_SOURCE_SIZE_FOR_COMPRESSION_MB,
        // Recording without sound is already handled — and clearly
        // signalled — upstream in `microphone-status.ts`. Compression must
        // never be the thing that silently drops audio from a video that
        // did capture it.
        stripAudio: false,
      },
      options.onProgress,
    );

    // The library resolves with the SAME uri when it decides internally
    // that the source is already too small to be worth compressing (see
    // `minimumFileSizeForCompress`) — that is a normal skip, not a result
    // to validate or ever delete.
    if (compressedUri === options.uri) {
      return unchangedResult(options.uri, 'already efficiently encoded', originalSizeBytes, sourceWidth, sourceHeight);
    }

    const output = await Compressor.getVideoMetaData(compressedUri);
    const outputSizeBytes = Number(output?.size) || 0;
    const outputWidth = Number(output?.width) || 0;
    const outputHeight = Number(output?.height) || 0;
    const outputDurationSec = Number(output?.duration) || 0;

    if (!outputSizeBytes || outputWidth <= 0 || outputHeight <= 0) {
      deleteLocalFileQuietly(compressedUri);
      return unchangedResult(options.uri, 'compressed output looked invalid', originalSizeBytes, sourceWidth, sourceHeight);
    }

    if (originalSizeBytes > 0 && outputSizeBytes >= originalSizeBytes) {
      deleteLocalFileQuietly(compressedUri);
      return unchangedResult(options.uri, 'compression did not reduce file size', originalSizeBytes, sourceWidth, sourceHeight);
    }

    const expectedDurationSec = options.expectedDurationMs / 1000;
    if (expectedDurationSec > 0.5) {
      const driftSec = Math.abs(outputDurationSec - expectedDurationSec);
      const toleranceSec = Math.max(1.5, expectedDurationSec * 0.1);
      if (driftSec > toleranceSec) {
        deleteLocalFileQuietly(compressedUri);
        return unchangedResult(options.uri, 'compressed duration did not match the recording', originalSizeBytes, sourceWidth, sourceHeight);
      }
    }

    return {
      uri: compressedUri,
      width: outputWidth,
      height: outputHeight,
      sizeBytes: outputSizeBytes,
      skipped: false,
    };
  } catch (error) {
    console.warn('[video-compression] falling back to the original recording', error);
    return unchangedResult(
      options.uri,
      error instanceof Error ? error.message : 'compression failed',
      originalSizeBytes,
      sourceWidth,
      sourceHeight,
    );
  }
}
