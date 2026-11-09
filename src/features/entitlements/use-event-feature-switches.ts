import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import {
  eventFeatureSwitchKeys,
  fetchEventFeatureSwitches,
  saveEventFeatureSwitch,
  type EventFeatureSwitches,
} from '@/services/event-feature-switches';

const ALL_ON: EventFeatureSwitches = { guestbook: true, videos: true };

/**
 * Whether the host wants the Guestbook and videos at this event.
 *
 * Off until the answer arrives, so a guest never glimpses a tab that then
 * disappears. Once the read has finished, an event with no answer counts as on:
 * these only ever take away something the host chose to remove.
 */
export function useEventFeatureSwitches(
  celebrationId: string | null | undefined,
): EventFeatureSwitches & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: eventFeatureSwitchKeys.forEvent(String(celebrationId)),
    queryFn: () => fetchEventFeatureSwitches(String(celebrationId)),
    enabled: Boolean(celebrationId),
    retry: false,
    staleTime: 60_000,
  });

  return {
    guestbook: data?.guestbook ?? !isLoading,
    videos: data?.videos ?? !isLoading,
    isLoading,
  };
}

/** Flips a switch straight away, and puts it back if the save fails. */
export function useSaveEventFeatureSwitch(celebrationId: string) {
  const queryClient = useQueryClient();
  const queryKey = eventFeatureSwitchKeys.forEvent(celebrationId);

  return useMutation({
    mutationFn: (patch: Partial<EventFeatureSwitches>) =>
      saveEventFeatureSwitch(celebrationId, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<EventFeatureSwitches>(queryKey);
      queryClient.setQueryData<EventFeatureSwitches>(queryKey, {
        ...ALL_ON,
        ...previous,
        ...patch,
      });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      Alert.alert('Could not save that', 'Please try again.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
