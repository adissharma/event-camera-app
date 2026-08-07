import { useEffect, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { celebrationKeys, listCelebrations } from '@/services/celebrations';

export function LiveActivitySyncManager() {
  const { data: celebrations } = useQuery({
    queryKey: celebrationKeys.list(),
    queryFn: listCelebrations,
    refetchInterval: 10000, // Poll list every 10s to keep it fresh
  });

  const activeActivitiesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      console.log('[LiveActivitySync] OS is not iOS, skipping sync manager.');
      return;
    }
    const { LiveActivityModule } = NativeModules;
    if (!LiveActivityModule) {
      console.warn('[LiveActivitySync] CRITICAL: LiveActivityModule is UNDEFINED in NativeModules. Please verify it is compiled in Xcode.');
      return;
    }

    console.log('[LiveActivitySync] LiveActivitySyncManager active, native module detected.');

    let isMounted = true;

    async function syncActivities() {
      if (!celebrations) {
        console.log('[LiveActivitySync] No celebrations list loaded yet.');
        return;
      }
      if (!isMounted) return;

      console.log(`[LiveActivitySync] Scanning query cache: found ${celebrations.length} joined events.`);

      const now = Date.now();
      const currentActiveIds = new Set<string>();

      for (const event of celebrations) {
        // Determine if the event is currently active/ongoing (endsAt is in the future, or null/missing)
        const endsAtMs = event.endsAt ? new Date(event.endsAt).getTime() : (now + 24 * 60 * 60 * 1000);
        const status = event.status as string;
        const isActive = endsAtMs > now && (status === 'published' || status === 'live');

        console.log(`[LiveActivitySync] Event "${event.title}" (${event.id}): status=${status}, endsAt=${event.endsAt || 'none'}, isActive=${isActive}`);

        if (isActive) {
          currentActiveIds.add(event.id);

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
            console.error('Error loading taken photos count:', e);
          }

          // If unlimited, show -1 — the widget draws that as "∞".
          // `undefined` has to land here too, not just `null`: a session that
          // never carried a limit was falling through to the arithmetic below
          // and sending NaN across the bridge, which the widget then drew as a
          // literal "NaN" where the shot count belongs.
          const remaining =
            limit === null || limit === undefined ? -1 : Math.max(0, limit - takenCount);

          if (!activeActivitiesRef.current.has(event.id)) {
            console.log(`[LiveActivitySync] Starting Live Activity for "${event.title}" with remaining count = ${remaining}`);
            LiveActivityModule.startActivity(event.title, event.id, remaining, endsAtMs);
            activeActivitiesRef.current.add(event.id);
          } else {
            console.log(`[LiveActivitySync] Updating Live Activity for "${event.title}" with remaining count = ${remaining}`);
            LiveActivityModule.updateActivity(event.id, remaining, endsAtMs);
          }
        }
      }

      // End activities that are no longer active
      for (const id of activeActivitiesRef.current) {
        if (!currentActiveIds.has(id)) {
          console.log(`[LiveActivitySync] Ending Live Activity for event ID: ${id}`);
          LiveActivityModule.endActivity(id);
          activeActivitiesRef.current.delete(id);
        }
      }
    }

    // Run sync immediately and then on a short interval (every 4 seconds)
    // to catch AsyncStorage photo count updates in real-time
    syncActivities();
    const interval = setInterval(syncActivities, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [celebrations]);

  return null;
}
