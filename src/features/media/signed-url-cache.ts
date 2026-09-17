import { requireSupabase } from '@/lib/supabase/client';

/**
 * Stable, in-process resolution of private Storage paths.
 *
 * Storage objects are immutable and versioned, but Supabase signs the same
 * object with a fresh query string each time. Those changing URLs defeat the
 * browser/native image cache even though the bytes have not changed. Keep the
 * signed URL stable for most of its permitted lifetime; the underlying object
 * remains private and the token still expires normally.
 */
const REFRESH_EARLY_MS = 2 * 60_000;

type Entry = {
  signedUrl: string;
  refreshAt: number;
};

const cache = new Map<string, Entry>();
const batchesInFlight = new Map<string, Promise<Map<string, string>>>();

function cacheKey(bucket: string, path: string) {
  return `${bucket}:${path}`;
}

function uniquePaths(paths: readonly (string | null | undefined)[]): string[] {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

/**
 * Resolves paths in one Storage request, returning cached values wherever the
 * current signed URL is still usable. URLs are intentionally not persisted:
 * an App Clip or app restart must not retain an expired bearer URL on disk.
 */
export async function resolveSignedUrls(
  bucket: string,
  paths: readonly (string | null | undefined)[],
  expiresInSeconds = 60 * 60,
): Promise<Map<string, string>> {
  const unique = uniquePaths(paths);
  if (unique.length === 0) return new Map();

  const now = Date.now();
  const resolved = new Map<string, string>();
  const missing: string[] = [];

  for (const path of unique) {
    const entry = cache.get(cacheKey(bucket, path));
    if (entry && entry.refreshAt > now) {
      resolved.set(path, entry.signedUrl);
    } else {
      missing.push(path);
    }
  }

  if (missing.length === 0) return resolved;

  // Identical callers (for example a remount during a navigation transition)
  // share one batch rather than minting two sets of otherwise-equivalent URLs.
  const batchKey = `${bucket}:${expiresInSeconds}:${[...missing].sort().join('|')}`;
  let request = batchesInFlight.get(batchKey);
  if (!request) {
    request = (async () => {
      const client = requireSupabase();
      const { data, error } = await client.storage.from(bucket).createSignedUrls(missing, expiresInSeconds);
      if (error || !data) {
        throw error ?? new Error(`Could not create signed URLs for ${bucket}.`);
      }

      const refreshAt = Date.now() + Math.max(1, expiresInSeconds * 1000 - REFRESH_EARLY_MS);
      const created = new Map<string, string>();
      for (const item of data) {
        if (!item.path || !item.signedUrl) continue;
        cache.set(cacheKey(bucket, item.path), { signedUrl: item.signedUrl, refreshAt });
        created.set(item.path, item.signedUrl);
      }
      return created;
    })().finally(() => {
      batchesInFlight.delete(batchKey);
    });
    batchesInFlight.set(batchKey, request);
  }

  const created = await request;
  for (const [path, signedUrl] of created) resolved.set(path, signedUrl);
  return resolved;
}

/** Test-only/reset support for a session or explicit sign-out boundary. */
export function clearSignedUrlCache() {
  cache.clear();
  batchesInFlight.clear();
}
