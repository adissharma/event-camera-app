import { requireSupabase } from '@/lib/supabase/client';

/**
 * What a host has switched off for their event, whatever its package includes.
 *
 * Read separately from the event's details, so that a database without these
 * columns yet costs these two controls rather than the whole event page. Goes
 * through `any` until the generated types are next regenerated.
 */
export interface EventFeatureSwitches {
  guestbook: boolean;
  videos: boolean;
  challenges: boolean;
}

export const eventFeatureSwitchKeys = {
  forEvent: (celebrationId: string) => ['event-feature-switches', celebrationId] as const,
};

export async function fetchEventFeatureSwitches(
  celebrationId: string,
): Promise<EventFeatureSwitches> {
  const { data, error } = await (requireSupabase() as any).rpc('get_event_feature_switches', {
    p_celebration_id: celebrationId,
  });
  if (error) throw error;
  const row = (
    data as { guestbook_enabled: boolean; videos_enabled: boolean; challenges_enabled?: boolean }[]
  )[0];
  return {
    guestbook: row?.guestbook_enabled ?? true,
    videos: row?.videos_enabled ?? true,
    // Absent until the challenges switch migration is applied.
    challenges: row?.challenges_enabled ?? true,
  };
}

export async function saveEventFeatureSwitch(
  celebrationId: string,
  patch: Partial<EventFeatureSwitches>,
): Promise<void> {
  const { error } = await (requireSupabase() as any)
    .from('celebrations')
    .update({
      ...(patch.guestbook === undefined ? {} : { guestbook_enabled: patch.guestbook }),
      ...(patch.videos === undefined ? {} : { videos_enabled: patch.videos }),
      ...(patch.challenges === undefined ? {} : { challenges_enabled: patch.challenges }),
    })
    .eq('id', celebrationId);
  if (error) throw error;
}
