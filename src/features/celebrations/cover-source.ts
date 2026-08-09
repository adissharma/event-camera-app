import { useEffect, useState } from 'react';

import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';
import { STORAGE_BUCKETS } from '@/config/app-config';

/**
 * Cover art resolution, shared by every screen that renders an event cover.
 *
 * There is one cover per event — `celebrations.cover_storage_path` — and this
 * module is the only thing that turns it into something renderable. Before it,
 * three different strategies were in play and none of them worked:
 *
 * - the dashboard called `getPublicUrl` against a bucket that is private, so
 *   the URL it built could never resolve;
 * - the gallery hero only ever consulted a theme-slug lookup, so a real
 *   storage path matched nothing and it fell through to a stock photograph
 *   picked by hashing the event id;
 * - the guest screens returned the fallback unless the path already began
 *   `http` or `file:`, which a bucket path never does.
 *
 * The bucket stays private; covers of published events are readable under the
 * `covers: readable for published events` storage policy, so a signed URL can
 * be minted for a host and an anonymous guest alike.
 */

/** Theme-slug covers for the development fallback, keyed as on the dashboard. */
const COVER_MAP: Record<string, ReturnType<typeof require>> = {
  modern: require('../../../assets/images/placeholders/create_event_cover.png'),
  classic: require('../../../assets/images/placeholders/create_event_cover.png'),
  vibrant: require('../../../assets/images/placeholders/create_event_cover.png'),
  retro: require('../../../assets/images/placeholders/create_event_cover.png'),
  editorial: require('../../../assets/images/placeholders/create_event_cover.png'),
};

export const FALLBACK_COVER = require('../../../assets/images/placeholders/create_event_cover.png');

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Signed URLs by storage path.
 *
 * Module scope, so the many surfaces showing the same event's cover sign it
 * once between them rather than each issuing its own request. Safe to keep
 * indefinitely because a replaced cover is written to a *new* path (see
 * `buildCoverPath`) — a stale entry can never shadow a newer image.
 */
const signedUrlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

/** True when `value` is already renderable without a round trip. */
function isDirectlyRenderable(value: string): boolean {
  return (
    value.startsWith('http') ||
    value.startsWith('file:') ||
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('content://') ||
    value.startsWith('ph://')
  );
}

/**
 * Resolves whatever can be resolved without I/O.
 *
 * Returns `null` when the value is a bucket path that still needs signing,
 * which is what the hooks below do asynchronously.
 */
export function resolveCoverSync(path: string | null | undefined) {
  if (!path) return FALLBACK_COVER;
  if (COVER_MAP[path]) return COVER_MAP[path];
  if (isDirectlyRenderable(path)) return { uri: path };
  return null;
}

async function signCoverPath(path: string): Promise<string | null> {
  const cached = signedUrlCache.get(path);
  if (cached) return cached;

  const existing = inFlight.get(path);
  if (existing) return existing;

  const request = (async () => {
    try {
      const client = requireSupabase();
      const { data, error } = await client.storage
        .from(STORAGE_BUCKETS.covers)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

      if (error || !data?.signedUrl) {
        console.error('[cover] failed to sign cover URL', { path, error });
        return null;
      }

      signedUrlCache.set(path, data.signedUrl);
      return data.signedUrl;
    } finally {
      inFlight.delete(path);
    }
  })();

  inFlight.set(path, request);
  return request;
}

/**
 * The renderable source for one event cover.
 *
 * Falls back to the placeholder while a signed URL is in flight and if signing
 * fails, so a screen never renders an empty frame.
 */
export function useCoverSource(path: string | null | undefined) {
  const immediate = resolveCoverSync(path);
  const [signed, setSigned] = useState<string | null>(() =>
    path && !immediate ? signedUrlCache.get(path) ?? null : null,
  );

  useEffect(() => {
    if (!path || immediate || !isBackendConfigured) return;

    let cancelled = false;
    void signCoverPath(path).then((url) => {
      if (!cancelled && url) setSigned(url);
    });

    return () => {
      cancelled = true;
    };
  }, [path, immediate]);

  if (immediate) return immediate;
  if (signed) return { uri: signed };
  return FALLBACK_COVER;
}

/**
 * The same, for a list — the dashboard renders every event at once and would
 * otherwise fire a signing request per card on every render pass.
 */
export function useCoverSources(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).join('|');
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isBackendConfigured) return;

    const pending = paths.filter(
      (path): path is string =>
        typeof path === 'string' && !resolveCoverSync(path) && !signedUrlCache.has(path),
    );
    if (pending.length === 0) return;

    let cancelled = false;
    void Promise.all(pending.map((path) => signCoverPath(path))).then(() => {
      // One re-render once the batch lands, rather than one per card.
      if (!cancelled) setTick((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return (path: string | null | undefined) => {
    const immediate = resolveCoverSync(path);
    if (immediate) return immediate;
    const signed = path ? signedUrlCache.get(path) : undefined;
    return signed ? { uri: signed } : FALLBACK_COVER;
  };
}

/**
 * Legacy synchronous resolver.
 *
 * Kept for the offline development path and for callers holding a local
 * `file://` from the host's own picker. It cannot resolve a bucket path — use
 * `useCoverSource` for anything that might be one.
 */
export function resolveCover(path: string | null | undefined) {
  return resolveCoverSync(path) ?? FALLBACK_COVER;
}
