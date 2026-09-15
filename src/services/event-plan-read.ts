import { isBackendConfigured, requireSupabase } from '@/lib/supabase/client';
import { SAMPLE_PLAN_KEY, isSampleCelebrationId } from '@/features/celebrations/sample-event';

/** Read-only event package access shared by hosts and event-scoped guests. */
export const eventPlanKeys = {
  forEvent: (celebrationId: string) => ['event-plan', celebrationId] as const,
};

export async function fetchEventPlanKey(celebrationId: string): Promise<string | null> {
  if (isSampleCelebrationId(celebrationId)) return SAMPLE_PLAN_KEY;
  if (!isBackendConfigured) return null;

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('celebration_plan_key', {
    p_celebration_id: celebrationId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}
