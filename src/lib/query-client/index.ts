import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query client.
 *
 * Defaults are tuned for a venue: patchy networks, backgrounded apps, and data
 * that is cheap to refetch but expensive to lose. Retries use the library's
 * exponential backoff, capped so a dead network fails visibly rather than
 * spinning forever.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Never retry a permissions or not-found failure — it will never succeed.
        const status = (error as { status?: number } | null)?.status;
        const code = (error as { code?: string } | null)?.code;
        if (status === 401 || status === 403 || status === 404) return false;
        if (code === '42501') return false; // Postgres insufficient_privilege (unauthorized/forbidden)
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
