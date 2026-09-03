import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// ffmpeg-static keeps the scheduled worker self-contained on Vercel. The
// worker never runs in the mobile/web bundle.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('ffmpeg-static') as string;
const execFileAsync = promisify(execFile);

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const PHOTO_MIN_SECONDS = 0.9;
const PHOTO_MAX_SECONDS = 3;
const VIDEO_MAX_SECONDS = 4;
const PHOTO_ONLY_TARGET_SECONDS = 45;
const MIXED_MEDIA_TARGET_SECONDS = 55;
const MAX_SECONDS = 90;
const WORKER_LEASE_SECONDS = 240;
const PAN_SCALE = 1.08;

type RecapRenderMode = 'original' | 'filtered';
type RecapPhotoTreatment = 'original' | 'disposable' | 'black_and_white' | 'warm_film';

type RecapMedia = {
  id: string;
  original_storage_path: string;
  media_type: 'photo' | 'video';
  mime_type: string | null;
  duration_ms: number | null;
  captured_at: string | null;
};

type SelectedMedia = RecapMedia & { segmentSeconds: number };

function normaliseRenderMode(value: unknown): RecapRenderMode {
  return value === 'filtered' ? 'filtered' : 'original';
}

function normalisePhotoTreatment(value: unknown): RecapPhotoTreatment {
  return value === 'disposable' || value === 'black_and_white' || value === 'warm_film'
    ? value
    : 'original';
}

function chronologicalMediaSort(a: RecapMedia, b: RecapMedia) {
  const aTime = a.captured_at ? new Date(a.captured_at).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.captured_at ? new Date(b.captured_at).getTime() : Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

function getConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing_supabase_worker_credentials');
  return { url, key };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function selectRecapMedia(media: RecapMedia[]): SelectedMedia[] {
  const ordered = media
    .filter((item) => item.original_storage_path && (item.media_type === 'photo' || item.media_type === 'video'))
    .sort(chronologicalMediaSort);
  if (ordered.length === 0) return [];

  const photoCount = ordered.filter((item) => item.media_type === 'photo').length;
  const videoDurations = ordered
    .filter((item) => item.media_type === 'video')
    .map((item) => Math.max(0.5, Math.min(VIDEO_MAX_SECONDS, (item.duration_ms ?? 2000) / 1000)));
  const estimatedVideoSeconds = videoDurations.reduce((sum, seconds) => sum + seconds, 0);
  const targetSeconds = videoDurations.length > 0 ? MIXED_MEDIA_TARGET_SECONDS : PHOTO_ONLY_TARGET_SECONDS;
  const photoBudgetSeconds = Math.max(15, targetSeconds - estimatedVideoSeconds);
  const photoSeconds = photoCount > 0
    ? clamp(photoBudgetSeconds / photoCount, PHOTO_MIN_SECONDS, PHOTO_MAX_SECONDS)
    : 0;

  const withDurations = ordered.map((item) => ({
    ...item,
    segmentSeconds: item.media_type === 'photo'
      ? photoSeconds
      : Math.max(0.5, Math.min(VIDEO_MAX_SECONDS, (item.duration_ms ?? 2000) / 1000)),
  }));
  const total = withDurations.reduce((sum, item) => sum + item.segmentSeconds, 0);
  if (total <= MAX_SECONDS) return withDurations;

  // Preserve the host's chosen order, trimming the tail when the selection
  // would run beyond the one-minute recap target.
  const selected: SelectedMedia[] = [];
  let remaining = MAX_SECONDS;
  for (const item of withDurations) {
    if (remaining <= 0) break;
    const duration = Math.min(item.segmentSeconds, remaining);
    remaining -= duration;
    if (duration >= 0.5) selected.push({ ...item, segmentSeconds: duration });
  }
  return selected;
}

async function runFfmpeg(args: string[], timeoutMs = 180_000) {
  await execFileAsync(ffmpegPath, args, { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 });
}

function photoTreatmentFilter(treatment: RecapPhotoTreatment) {
  if (treatment === 'black_and_white') return 'hue=s=0';
  if (treatment === 'disposable') {
    // The app's disposable treatment is a Skia shader (see
    // `src/features/media/disposable-shader.ts`). A recap is rendered
    // server-side by FFmpeg with no React Native surface to draw into, so this
    // is a deliberate approximation of the same preset rather than the same
    // code: punchy contrast, richer saturation, cool shadows and warm
    // highlights, and a soft wide vignette.
    //
    // It tracks the preset by hand, so it needs revisiting when the preset
    // moves. Two things it does not reproduce: the grain, and the dust — both
    // would need filters this pipeline has not been proven to have available,
    // and a recap that fails to render is worse than one without grain.
    const tone = 'eq=contrast=1.26:saturation=1.16:brightness=0.02';
    const split = 'colorbalance=rs=-.02:bs=.03:rm=.02:bm=-.01:rh=.05:bh=-.04';
    // Unconditional. It used to be applied only when the date stamp was on,
    // which coupled two unrelated settings — turning the stamp off silently
    // removed the vignette too.
    return `${tone},${split},vignette=PI/6`;
  }
  if (treatment === 'warm_film') return 'eq=contrast=1.04:saturation=1.05:brightness=0.015,colorbalance=rs=.035:gs=.012:bs=-.018';
  return null;
}

function photoPanFilter(index: number, seconds: number, treatment: RecapPhotoTreatment) {
  const frames = Math.max(2, Math.round(seconds * FPS));
  const progress = `n/${frames - 1}`;
  const xCenter = 'floor((iw-ow)/2)';
  const yCenter = 'floor((ih-oh)/2)';
  const variants = [
    { x: `floor((iw-ow)*${progress})`, y: yCenter },
    { x: `floor((iw-ow)*(1-${progress}))`, y: yCenter },
    { x: xCenter, y: `floor((ih-oh)*${progress})` },
    { x: xCenter, y: `floor((ih-oh)*(1-${progress}))` },
    { x: `floor((iw-ow)*${progress})`, y: `floor((ih-oh)*${progress})` },
    { x: `floor((iw-ow)*(1-${progress}))`, y: `floor((ih-oh)*${progress})` },
  ];
  const pan = variants[index % variants.length];
  const scaledWidth = Math.round(WIDTH * PAN_SCALE);
  const scaledHeight = Math.round(HEIGHT * PAN_SCALE);
  return [
    `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase`,
    `crop=${WIDTH}:${HEIGHT}:${pan.x}:${pan.y}`,
    photoTreatmentFilter(treatment),
    'setsar=1',
    `fps=${FPS}`,
    'format=yuv420p',
  ].filter(Boolean).join(',');
}

async function hasAudio(inputPath: string): Promise<boolean> {
  try {
    const result = await execFileAsync(ffmpegPath, ['-hide_banner', '-i', inputPath], { maxBuffer: 512 * 1024 });
    return /Audio:/i.test(`${result.stdout}\n${result.stderr}`);
  } catch (error: any) {
    return /Audio:/i.test(`${error?.stdout ?? ''}\n${error?.stderr ?? ''}`);
  }
}

async function renderPhoto(
  inputPath: string,
  outputPath: string,
  seconds: number,
  index: number,
  treatment: RecapPhotoTreatment,
) {
  await runFfmpeg([
    '-y', '-loop', '1', '-i', inputPath,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-t', String(seconds),
    '-vf', photoPanFilter(index, seconds, treatment),
    '-map', '0:v:0', '-map', '1:a:0', '-r', String(FPS),
    '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-movflags', '+faststart', outputPath,
  ]);
}

async function renderVideo(inputPath: string, outputPath: string, seconds: number) {
  const audio = await hasAudio(inputPath);
  const args = ['-y', '-i', inputPath];
  if (!audio) args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  args.push(
    '-t', String(seconds),
    '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1,format=yuv420p`,
    '-map', '0:v:0', '-map', audio ? '0:a:0' : '1:a:0',
    '-r', String(FPS), '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', outputPath,
  );
  await runFfmpeg(args);
}

async function composeSegments(segmentPaths: string[], durations: number[], outputPath: string) {
  if (segmentPaths.length === 1) {
    await fs.copyFile(segmentPaths[0], outputPath);
    return;
  }
  // The segments already share the same 1080x1920 H.264/AAC format. A concat
  // demuxer keeps assembly streaming and bounded in memory; a large filter
  // graph of every event item otherwise exceeds a serverless worker's memory.
  const listPath = `${outputPath}.concat.txt`;
  await fs.writeFile(listPath, segmentPaths.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'));
  try {
    await runFfmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
      '-t', String(Math.min(MAX_SECONDS, durations.reduce((sum, value) => sum + value, 0))),
      '-fflags', '+genpts', '-avoid_negative_ts', 'make_zero',
      '-vf', `fps=${FPS},format=yuv420p`,
      '-r', String(FPS), '-fps_mode', 'cfr',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
      '-movflags', '+faststart', outputPath,
    ], 240_000);
  } finally {
    await fs.rm(listPath, { force: true });
  }
}

async function processOne() {
  const { url, key } = getConfig();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const workerId = `vercel-${randomUUID()}`;
  const { data: claimed, error: claimError } = await supabase.rpc('claim_event_recap_job', {
    p_worker_id: workerId, p_lease_seconds: WORKER_LEASE_SECONDS,
  });
  if (claimError) throw claimError;
  const recap = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!recap) return { processed: false };

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-recap-'));
  try {
    const { data: session, error: sessionError } = await supabase
      .from('event_sessions').select('id, celebration_id, photo_treatment, date_stamp_enabled, celebrations(workspace_id)').eq('id', recap.event_session_id).single();
    if (sessionError || !session) throw sessionError ?? new Error('event_session_not_found');
    const renderMode = normaliseRenderMode((recap.metadata as Record<string, unknown> | null)?.render_mode);
    const photoTreatment = renderMode === 'filtered'
      ? normalisePhotoTreatment((session as any).photo_treatment)
      : 'original';
    const dateStampEnabled = renderMode === 'filtered' && (session as any).date_stamp_enabled === true;
    const requestedIds: string[] = Array.isArray(recap.selected_media_ids)
      ? recap.selected_media_ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (requestedIds.length === 0) throw Object.assign(new Error('no_selected_media'), { code: 'no_media' });
    const { data: media, error: mediaError } = await supabase
      .from('media_items')
      .select('id, original_storage_path, media_type, mime_type, duration_ms, captured_at')
      .eq('event_session_id', recap.event_session_id).eq('status', 'ready').is('deleted_at', null)
      .in('media_type', ['photo', 'video'])
      .in('id', requestedIds);
    if (mediaError) throw mediaError;
    const mediaRows = (media ?? []) as RecapMedia[];
    const mediaById = new Map(mediaRows.map((item) => [item.id, item]));
    const orderedMedia = requestedIds
      .map((id) => mediaById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const selected = selectRecapMedia(orderedMedia);
    if (selected.length === 0) throw Object.assign(new Error('no_eligible_media'), { code: 'no_media' });

    const { data: signed, error: signedError } = await supabase.storage.from('event-media')
      .createSignedUrls(selected.map((item) => item.original_storage_path), 900);
    if (signedError || !signed) throw signedError ?? new Error('could_not_sign_media');
    const urlByPath = new Map(signed.map((item) => [item.path, item.signedUrl]));
    const segmentPaths: string[] = [];
    const durations: number[] = [];
    const renderedIds: string[] = [];
    for (let index = 0; index < selected.length; index += 1) {
      const item = selected[index];
      const mediaUrl = urlByPath.get(item.original_storage_path);
      if (!mediaUrl) continue;
      const extension = item.media_type === 'video' ? 'mp4' : 'jpg';
      const inputPath = path.join(tempDir, `input-${index}.${extension}`);
      const segmentPath = path.join(tempDir, `segment-${index}.mp4`);
      const response = await fetch(mediaUrl);
      if (!response.ok) continue;
      await fs.writeFile(inputPath, Buffer.from(await response.arrayBuffer()));
      if (item.media_type === 'photo') await renderPhoto(inputPath, segmentPath, item.segmentSeconds, index, photoTreatment);
      else await renderVideo(inputPath, segmentPath, item.segmentSeconds);
      segmentPaths.push(segmentPath);
      durations.push(item.segmentSeconds);
      renderedIds.push(item.id);
    }
    if (segmentPaths.length === 0) throw Object.assign(new Error('media_download_failed'), { code: 'media_unavailable' });

    const outputPath = path.join(tempDir, 'recap.mp4');
    await composeSegments(segmentPaths, durations, outputPath);
    const workspaceId = (session.celebrations as any)?.workspace_id;
    const storagePath = `${workspaceId}/${session.celebration_id}/recaps/${recap.event_session_id}-${Date.now()}.mp4`;
    // A year. The path carries `Date.now()`, so a re-render writes a NEW
    // object rather than replacing this one — nothing served from this path
    // can ever change, and a recap is a video that guests rewatch. The
    // default of one hour had every viewer re-downloading ~10MB apiece.
    const { error: uploadError } = await supabase.storage.from('event-recaps').upload(storagePath, await fs.readFile(outputPath), {
      contentType: 'video/mp4', upsert: true, cacheControl: String(365 * 24 * 60 * 60),
    });
    if (uploadError) throw uploadError;
    const playbackUrl = `${url}/storage/v1/object/public/event-recaps/${storagePath}`;
    const { error: completeError } = await supabase.rpc('complete_event_recap_job', {
      p_recap_id: recap.id, p_worker_id: workerId, p_storage_path: storagePath,
      p_playback_url: playbackUrl, p_duration_ms: Math.round(durations.reduce((a, b) => a + b, 0) * 1000),
      p_media_count: segmentPaths.length, p_selected_media_ids: renderedIds,
      p_metadata: {
        width: WIDTH,
        height: HEIGHT,
        fps: FPS,
        codec: 'h264',
        order: 'captured_at_asc',
        photo_motion: 'smooth_pan_crop',
        render_mode: renderMode,
        photo_treatment: photoTreatment,
        date_stamp_enabled: dateStampEnabled,
        generated_by: 'vercel-recap-worker',
      },
    });
    if (completeError) throw completeError;
    return { processed: true, recapId: recap.id };
  } catch (error: any) {
    await supabase.rpc('fail_event_recap_job', {
      p_recap_id: recap.id, p_worker_id: workerId,
      p_error_code: error?.code ?? 'render_failed', p_error_message: error?.message ?? 'recap render failed',
    });
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export default async function handler(request: any, response: any) {
  if (request.method && !['GET', 'POST'].includes(request.method)) {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.authorization;
  let authorized = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);

  if (!authorized && authorization?.startsWith('Bearer ')) {
    try {
      const { url, key } = getConfig();
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await supabase.auth.getUser(authorization.slice('Bearer '.length));
      authorized = Boolean(data.user);
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    response.status(200).json(await processOne());
  } catch (error: any) {
    console.error('[recap-worker]', error);
    response.status(500).json({ error: 'recap_worker_failed' });
  }
}
