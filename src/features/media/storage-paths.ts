import { STORAGE_BUCKETS } from '@/config/app-config';

/**
 * Storage path construction.
 *
 * Paths are immutable and versioned. An object is never overwritten in place —
 * a replacement gets `-v2`. Overwriting breaks CDN and client caches in ways
 * that surface as a guest seeing someone else's photograph, which is the worst
 * failure this product could have.
 *
 * The first segment is always the workspace id, because the storage policies
 * authorise by comparing it against the caller's workspace membership.
 */

const SAFE_SEGMENT = /^[0-9a-fA-F-]{36}$/;

export class InvalidStoragePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStoragePathError';
  }
}

function assertId(value: string, label: string): string {
  if (!SAFE_SEGMENT.test(value)) {
    throw new InvalidStoragePathError(`${label} must be a UUID, received "${value}"`);
  }
  return value;
}

/**
 * Normalises a file extension.
 *
 * Rejects anything that could climb out of its prefix or smuggle a second
 * segment — a path is an authorisation boundary here, not just a name.
 */
export function normaliseExtension(input: string): string {
  const extension = input.replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(extension)) {
    throw new InvalidStoragePathError(`Unsafe file extension: "${input}"`);
  }
  return extension;
}

export interface MediaPathParts {
  workspaceId: string;
  celebrationId: string;
  eventSessionId: string;
  mediaItemId: string;
  extension: string;
  /** Bumped when an object is replaced rather than overwritten. */
  version?: number;
}

export function buildOriginalMediaPath({
  workspaceId,
  celebrationId,
  eventSessionId,
  mediaItemId,
  extension,
  version = 1,
}: MediaPathParts): string {
  return [
    assertId(workspaceId, 'workspaceId'),
    assertId(celebrationId, 'celebrationId'),
    assertId(eventSessionId, 'eventSessionId'),
    assertId(mediaItemId, 'mediaItemId'),
    `original-v${version}.${normaliseExtension(extension)}`,
  ].join('/');
}

export function buildVariantPath(
  parts: MediaPathParts & { variant: string },
): string {
  const { variant, version = 1 } = parts;
  if (!/^[a-z0-9_]{1,32}$/.test(variant)) {
    throw new InvalidStoragePathError(`Unsafe variant name: "${variant}"`);
  }
  return [
    assertId(parts.workspaceId, 'workspaceId'),
    assertId(parts.celebrationId, 'celebrationId'),
    assertId(parts.eventSessionId, 'eventSessionId'),
    assertId(parts.mediaItemId, 'mediaItemId'),
    `${variant}-v${version}.${normaliseExtension(parts.extension)}`,
  ].join('/');
}

export function buildCoverPath(
  workspaceId: string,
  celebrationId: string,
  extension: string,
  version = 1,
): string {
  return [
    assertId(workspaceId, 'workspaceId'),
    assertId(celebrationId, 'celebrationId'),
    `cover-v${version}.${normaliseExtension(extension)}`,
  ].join('/');
}

export function buildQrAssetPath(
  workspaceId: string,
  celebrationId: string,
  eventSessionId: string,
  templateKey: string,
  extension: string,
  version = 1,
): string {
  if (!/^[a-z0-9_]{1,40}$/.test(templateKey)) {
    throw new InvalidStoragePathError(`Unsafe template key: "${templateKey}"`);
  }
  return [
    assertId(workspaceId, 'workspaceId'),
    assertId(celebrationId, 'celebrationId'),
    assertId(eventSessionId, 'eventSessionId'),
    `${templateKey}-v${version}.${normaliseExtension(extension)}`,
  ].join('/');
}

/** The workspace id a path is scoped to, or null if the path is malformed. */
export function workspaceIdFromPath(path: string): string | null {
  const [first] = path.split('/');
  return first && SAFE_SEGMENT.test(first) ? first : null;
}

/**
 * Best-effort MIME type from a local file URI's extension.
 *
 * Used when the source (a bare camera capture, unlike a picker asset) never
 * reports one itself. Defaults to JPEG, matching the quality/format the
 * camera capture path already requests.
 */
export function inferMimeTypeFromUri(uri: string): string {
  // A `data:` URI (what expo-camera's web capture produces) carries its MIME
  // type in the header, not the path — reading it via a file extension below
  // would instead scan the base64 payload for a literal ".", find none, and
  // read the *entire* multi-megabyte string as one "extension", silently
  // falling through to the wrong default every time.
  if (uri.startsWith('data:')) {
    const match = /^data:([^;,]+)[;,]/.exec(uri);
    if (match) return match[1];
  }

  const withoutQuery = uri.split('?')[0] ?? uri;
  const ext = withoutQuery.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

export const BUCKETS = STORAGE_BUCKETS;
