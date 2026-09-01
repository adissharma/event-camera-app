import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useEventEntitlements } from './use-event-entitlements';
import { upgradesForFeature, type FeatureKey } from './event-entitlements';
import { UpgradeSheet } from './upgrade-sheet';
import { colours } from '@/design';

/**
 * Wraps a screen that only exists on some packages.
 *
 * The row or chip that opens such a screen is already gated, but a route can
 * be reached other ways — a deep link, a back-stack, a notification, a
 * refactor that adds a second entry point and forgets. Gating only the doorway
 * means the screen itself is one missed call site away from being free, so the
 * check lives here, on the thing being protected.
 *
 * The two audiences are handled oppositely, which is the whole point:
 *
 *  - A host without the package is shown the upgrade. They can buy it, so the
 *    feature should be discoverable to them.
 *  - A guest without it is simply sent back. They have nothing to buy, so a
 *    paywall would be a dead end — and it would tell them what their host
 *    chose to spend, which is not theirs to know.
 */
export function FeatureGate({
  celebrationId,
  feature,
  title,
  isHost,
  children,
}: {
  celebrationId: string;
  feature: FeatureKey;
  /** e.g. `Unlock Challenges`. What the host was reaching for. */
  title: string;
  isHost: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const entitlements = useEventEntitlements(celebrationId);
  const allowed = entitlements.has(feature);

  // A guest who should not be here leaves without ever seeing the screen.
  // In an effect rather than during render, because navigating mid-render is
  // a React warning and, on some stacks, a dropped navigation.
  //
  // `replace` onto the event, not `back`: the ways a guest reaches a locked
  // route are mostly the ways that leave no history to pop — a deep link, a
  // pasted URL, a QR code, a notification. `back` does nothing there, and
  // "does nothing" means the guest sits on the blank screen this gate
  // renders, with no way out. Replacing also keeps the locked route off the
  // stack, so a subsequent back cannot land on it again.
  useEffect(() => {
    if (entitlements.isLoading || allowed || isHost) return;
    router.replace(`/celebration/${celebrationId}` as never);
  }, [entitlements.isLoading, allowed, isHost, router, celebrationId]);

  if (entitlements.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colours.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  if (allowed) return <>{children}</>;

  // Host, unentitled. The screen behind stays unmounted rather than rendering
  // under the sheet: these screens load challenges, recordings and uploads,
  // and none of that should run for an event that has not bought them.
  if (!isHost) return <View style={{ flex: 1, backgroundColor: colours.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      <UpgradeSheet
        visible
        celebrationId={celebrationId}
        currentPlan={entitlements.plan}
        options={upgradesForFeature(entitlements.plan, feature)}
        title={title}
        // Closing without buying means they did not want it. `back` when
        // there is somewhere to go back to, so a host who opened this from
        // the gallery returns to their scroll position; otherwise the same
        // `replace` the guest path uses, for the deep-link case where there
        // is no history and `back` would strand them on the empty screen
        // behind the sheet.
        onClose={() =>
          router.canGoBack()
            ? router.back()
            : router.replace(`/celebration/${celebrationId}` as never)
        }
        // No navigation on success: the gate re-renders with the feature
        // unlocked and the screen appears underneath, which is exactly the
        // thing they were opening.
        onUpgraded={() => {}}
      />
    </View>
  );
}
