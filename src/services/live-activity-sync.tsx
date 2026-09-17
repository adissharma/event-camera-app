import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { celebrationKeys, listCelebrations } from '@/services/celebrations';
import { endLiveActivity, syncLiveActivity } from '@/services/live-activity';

function debug(message: string): void {
  if (__DEV__) console.info(message);
}

export function LiveActivitySyncManager() {
  const { data: celebrations } = useQuery({
    queryKey: celebrationKeys.list(),
    queryFn: listCelebrations,
    // The dashboard/event realtime paths cover normal updates. This only
    // reconciles eligibility after a dropped connection or passage of time.
    refetchInterval: 60_000,
  });

  const activeActivitiesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      debug('[LiveActivitySync] OS is not iOS, skipping sync manager.');
      return;
    }
    debug('[LiveActivitySync] host manager active.');

    let isMounted = true;

    async function syncActivities() {
      if (!celebrations) {
        debug('[LiveActivitySync] No celebrations list loaded yet.');
        return;
      }
      if (!isMounted) return;

      debug(`[LiveActivitySync] scanning ${celebrations.length} accessible events.`);

      const now = Date.now();
      const currentActiveIds = new Set<string>();

      for (const event of celebrations) {
        // Determine if the event is currently active/ongoing (endsAt is in the future, or null/missing)
        const endsAtMs = event.endsAt ? new Date(event.endsAt).getTime() : (now + 24 * 60 * 60 * 1000);
        const status = event.status as string;
        const isActive = endsAtMs > now && (status === 'published' || status === 'live');

        debug(`[LiveActivitySync] eligibility evaluated: ${isActive ? 'active' : 'inactive'}.`);

        if (isActive) {
          // Get photo limit and taken count
          // null = unlimited, number = specific limit
          const limit = event.primarySession?.shot_limit_per_guest;
          const key = `__mock_photos_${event.id}`;
          let takenCount = 0;
          try {
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
              const parsed = JSON.parse(stored);
              takenCount = parsed.length;
            }
          } catch (e) {
            if (__DEV__) console.warn('[LiveActivitySync] Could not read the local photo counter.');
          }

          const synced = syncLiveActivity({
            celebrationId: event.id,
            eventName: event.title,
            endsAt: endsAtMs,
            shotLimit: limit,
            shotsUsed: takenCount,
          });
          if (synced) currentActiveIds.add(event.id);
        }
      }

      // End activities that are no longer active
      for (const id of activeActivitiesRef.current) {
        if (!currentActiveIds.has(id)) {
          endLiveActivity(id);
          activeActivitiesRef.current.delete(id);
        }
      }
    }

    // A capture and its event query update call `syncLiveActivity` directly.
    // No independent 4-second timer is needed; it used to submit identical
    // ActivityKit updates indefinitely even while the app was idle.
    syncActivities();

    return () => {
      isMounted = false;
    };
  }, [celebrations]);

  return null;
}
