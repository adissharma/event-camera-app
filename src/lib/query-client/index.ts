import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query client.
 *
 * Defaults are tuned for a venue: patchy networks, backgrounded apps, and data
 * that is cheap to refetch but expensive to lose. Retries use the library's
 * exponential backoff, capped so a dead network fails visibly rather than
 * spinning forever.
 */
/**
 * Whether an error can never be fixed by asking again.
 *
 * Retrying these burns battery and fills the log with identical failures while
 * the outcome is decided before the first attempt. Shared with polling
 * queries, which must also stop: a `refetchInterval` on a permanently failing
 * query is an infinite loop that no amount of retry-capping contains — each
 * tick starts a fresh, fully-retried attempt.
 */
export function isPermanentQueryError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const code = (error as { code?: string } | null)?.code;
  if (status === 401 || status === 403 || status === 404) return true;
  // Postgres insufficient_privilege (unauthorized/forbidden).
  if (code === '42501') return true;
  // PostgREST: `.single()` matched no rows. The row is absent, soft-deleted,
  // or invisible under RLS — none of which a repeat request changes.
  if (code === 'PGRST116') return true;
  return false;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (isPermanentQueryError(error)) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations here are idempotent by construction (see the media pipeline
      // and publication operations), so a bounded retry is safe.
      retry: 1,
    },
  },
});
