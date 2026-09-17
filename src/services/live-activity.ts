import { NativeModules, Platform } from 'react-native';

/**
 * The intentionally small JavaScript seam around ActivityKit.
 *
 * Both the full app and the App Clip send the same serialisable event snapshot
 * through this module. The native bridge owns ActivityKit's duplicate handling
 * (an existing activity is updated rather than recreated), keeping lifecycle
 * rules in one place without pulling the host dashboard into the Clip.
 */
export type LiveActivitySnapshot = {
  celebrationId: string;
  eventName: string;
  endsAt: string | number | Date | null | undefined;
  /** Null and undefined are the existing unlimited representation. */
  shotLimit: number | null | undefined;
  /** The current participant's used shots, never the gallery-wide total. */
  shotsUsed: number | null | undefined;
};

type LiveActivityBridge = {
  startActivity: (
    eventName: string,
    celebrationId: string,
    photosLeft: number,
    photoAllowance: number,
    endTimeMs: number,
  ) => void;
  updateActivity: (
    celebrationId: string,
    photosLeft: number,
    photoAllowance: number,
    endTimeMs: number,
  ) => void;
  endActivity: (celebrationId: string) => void;
};

// React Query refreshes and navigation can surface the same event snapshot
// many times. ActivityKit updates are not free, so only cross the native
// bridge when the rendered Live Activity state has actually changed.
const lastSubmittedState = new Map<string, string>();

export type LiveActivityState = {
  endTimeMs: number;
  photoAllowance: number;
  photosLeft: number;
};

function debug(message: string): void {
  // These messages are deliberately useful when checking an App Clip build,
  // but a Live Activity can refresh often enough that they do not belong in
  // production device logs.
  if (__DEV__) console.info(message);
}

function getBridge(): LiveActivityBridge | null {
  if (Platform.OS !== 'ios') return null;
  const candidate = NativeModules.LiveActivityModule as LiveActivityBridge | undefined;
  return candidate && typeof candidate.startActivity === 'function' ? candidate : null;
}

/**
 * Maps an event snapshot to the exact primitive values understood by the
 * ActivityKit bridge. Returning null is an intentional no-op: an expired or
 * incomplete event must never stop a guest from reaching the event itself.
 */
export function getLiveActivityState(snapshot: LiveActivitySnapshot): LiveActivityState | null {
  const endTimeMs = new Date(snapshot.endsAt ?? '').getTime();
  if (!Number.isFinite(endTimeMs) || endTimeMs <= Date.now()) return null;

  const finiteLimit =
    typeof snapshot.shotLimit === 'number' && Number.isFinite(snapshot.shotLimit) && snapshot.shotLimit > 0
      ? Math.floor(snapshot.shotLimit)
      : null;

  if (finiteLimit === null) {
    return { endTimeMs, photoAllowance: -1, photosLeft: -1 };
  }

  const used =
    typeof snapshot.shotsUsed === 'number' && Number.isFinite(snapshot.shotsUsed)
      ? Math.max(0, Math.floor(snapshot.shotsUsed))
      : 0;

  return {
    endTimeMs,
    photoAllowance: finiteLimit,
    photosLeft: Math.max(0, finiteLimit - used),
  };
}

/**
 * Start an activity or update the event's existing one. ActivityKit's native
 * lookup makes this operation idempotent across cold launches, foregrounding
 * and repeated query refreshes.
 */
export function syncLiveActivity(snapshot: LiveActivitySnapshot): boolean {
  const bridge = getBridge();
  const state = getLiveActivityState(snapshot);

  if (!bridge) {
    if (Platform.OS === 'ios') {
      debug('[LiveActivity] bridge unavailable; continuing without an activity.');
    }
    return false;
  }
  if (!state) {
    debug('[LiveActivity] skipped: event is not eligible.');
    // An event can become ineligible while its prior activity remains on the
    // lock screen. Ending by celebration id is harmless when none exists and
    // prevents an expired event from lingering after the next refresh.
    bridge.endActivity(snapshot.celebrationId);
    lastSubmittedState.delete(snapshot.celebrationId);
    return false;
  }

  const stateKey = `${state.endTimeMs}:${state.photoAllowance}:${state.photosLeft}`;
  if (lastSubmittedState.get(snapshot.celebrationId) === stateKey) {
    debug('[LiveActivity] skipped: state unchanged.');
    return true;
  }

  debug('[LiveActivity] request/update submitted.');
  bridge.startActivity(
    snapshot.eventName,
    snapshot.celebrationId,
    state.photosLeft,
    state.photoAllowance,
    state.endTimeMs,
  );
  lastSubmittedState.set(snapshot.celebrationId, stateKey);
  return true;
}

/** End an existing activity when the event is no longer eligible. */
export function endLiveActivity(celebrationId: string): void {
  const bridge = getBridge();
  if (!bridge) return;
  debug('[LiveActivity] end submitted.');
  bridge.endActivity(celebrationId);
  lastSubmittedState.delete(celebrationId);
}

/** Test support for the process-local native update dedupe. */
export function resetLiveActivitySyncCache(): void {
  lastSubmittedState.clear();
}
