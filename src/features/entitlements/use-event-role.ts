import { useQuery } from '@tanstack/react-query';

import { celebrationDetailKeys, fetchCelebrationDetail } from '@/services/celebration-detail';

/**
 * Whether the viewer is this event's host.
 *
 * Reads `viewerRole` from the detail, which is authoritative: the guest path
 * comes back through an RPC that cannot see `created_by`, so comparing user
 * ids would call a guest a host on exactly the events where it matters.
 *
 * Shares the detail query's cache key, so a screen already holding the detail
 * pays nothing for asking again.
 */
export function useIsEventHost(celebrationId: string | null | undefined): {
  isHost: boolean;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });
  return { isHost: data?.viewerRole === 'host', isLoading };
}
