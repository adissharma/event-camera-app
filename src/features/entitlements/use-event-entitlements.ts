import { useQuery } from '@tanstack/react-query';

import { eventPlanKeys, fetchEventPlanKey } from '@/services/event-plan';
import { entitlementsForPlanKey, type EventEntitlements } from './event-entitlements';

/**
 * What this event's package allows, for the screen showing it.
 *
 * The one hook every gated surface uses. Cached per event rather than per
 * screen, so the camera, the gallery and Manage Event all read the same answer
 * and an upgrade invalidating this key unlocks them together rather than
 * leaving whichever screen happened not to refetch showing a lock.
 */
export function useEventEntitlements(celebrationId: string | null | undefined): EventEntitlements {
  const { data, isLoading } = useQuery({
    queryKey: eventPlanKeys.forEvent(String(celebrationId)),
    queryFn: () => fetchEventPlanKey(String(celebrationId)),
    enabled: Boolean(celebrationId),
    // Packages change only when the host buys one, and that path invalidates
    // this key explicitly. Refetching on every focus would cost a round trip
    // per screen change to learn nothing.
    staleTime: 5 * 60 * 1000,
  });

  return entitlementsForPlanKey(data, isLoading);
}
