import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { RevealMode } from '@/types/database';
import { serverNow, syncServerClock } from '@/services/server-time';
import {
  canViewerSeePhotos,
  formatRevealCountdown,
  isEventEnded,
  msUntilReveal,
  resolveRevealModalState,
  type RevealModalState,
} from './state';
import {
  markAcknowledged,
  readAcknowledgement,
  type RevealAcknowledgement,
  type RevealMilestone,
} from './acknowledgement';

export interface UseRevealModalOptions {
  celebrationId: string;
  /** Stable per-viewer id. See `acknowledgement.ts` for what counts as stable. */
  viewerId: string | null;
  endsAt: string | null | undefined;
  revealAt: string | null | undefined;
  revealMode: RevealMode | null | undefined;
  /** False while the event is still loading — nothing is decided until it lands. */
  ready: boolean;
  /**
   * Refetches the event from the server. Awaited before any transition that
   * would expose photos, so the unlock is never taken on the local clock alone.
   */
  refresh: () => Promise<unknown>;
}

export interface RevealModalController {
  /** Whether to mount the modal at all. */
  visible: boolean;
  /** Which version to render. Meaningless while `visible` is false. */
  state: Exclude<RevealModalState, 'hidden'>;
  /** Countdown copy for the awaiting state, e.g. "2h 14m". */
  countdownLabel: string;
  /** True while the post-countdown server confirmation is in flight. */
  confirming: boolean;
  /** Dismisses and records the milestone currently on screen. */
  dismiss: () => void;
  /**
   * Records the revealed milestone without showing it. Call when the viewer
   * reaches the unlocked gallery some other way — the news has been delivered,
   * so announcing it afterwards would be a non-sequitur.
   */
  markRevealedSeen: () => void;
  /** Forces a re-evaluation. For pull-to-refresh. */
  recheck: () => void;
}

/** The acknowledgement field each state writes to. */
const MILESTONE: Record<Exclude<RevealModalState, 'hidden'>, RevealMilestone> = {
  awaiting_reveal: 'eventEndedModalSeenAt',
  revealed: 'photosRevealedModalSeenAt',
};

/**
 * Decides whether the end-of-event modal should be on screen, and which of its
 * two faces to show.
 *
 * The awkward part this exists to contain is that "the photos are ready" must
 * never be announced on the strength of a local countdown. When the timer
 * reaches zero the hook does not flip the state — it refetches the event and
 * re-derives permission from what came back. A device with a fast clock reaches
 * zero early, refetches, is told no, and keeps waiting.
 */
export function useRevealModal(options: UseRevealModalOptions): RevealModalController {
  const { celebrationId, viewerId, endsAt, revealAt, revealMode, ready, refresh } = options;

  const [ack, setAck] = useState<RevealAcknowledgement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dismissed, setDismissed] = useState<RevealModalState | null>(null);

  // Bumped by every re-check trigger. The state below is derived, so a bump is
  // all it takes to re-evaluate against a fresh clock.
  const [tick, setTick] = useState(0);
  const recheck = useCallback(() => setTick((n) => n + 1), []);

  // Held in a ref so the countdown effect does not depend on its identity.
  // Callers pass an inline arrow, which would otherwise change every render and
  // tear down and rebuild the one-second interval each time — and since the
  // interval itself sets state, that is a self-sustaining loop.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // ── Acknowledgement ───────────────────────────────────────────────
  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;

    void readAcknowledgement(viewerId, celebrationId).then((value) => {
      if (!cancelled) setAck(value);
    });

    return () => {
      cancelled = true;
    };
  }, [viewerId, celebrationId]);

  // ── Re-check triggers ─────────────────────────────────────────────

  // 1. The event data landed or changed.
  useEffect(() => {
    if (!ready) return;
    void syncServerClock().then(recheck);
  }, [ready, endsAt, revealAt, revealMode, recheck]);

  // 2. The app came back to the foreground. Time passed while it was away and
  //    the offset may have drifted, so the clock is re-synced, not just read.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void syncServerClock(true).then(recheck);
    });
    return () => subscription.remove();
  }, [recheck]);

  // ── Derived state ─────────────────────────────────────────────────

  const now = useMemo(() => {
    // `tick` is the dependency that matters; reading the clock is the point.
    void tick;
    return serverNow();
  }, [tick]);

  const ended = isEventEnded({ now, endsAt });
  const remaining = msUntilReveal({ now, revealAt, revealMode });

  const state = resolveRevealModalState({ now, endsAt, revealAt, revealMode });

  // ── The countdown, and the confirmation at zero ───────────────────

  const [countdownLabel, setCountdownLabel] = useState(() =>
    remaining === null ? '' : formatRevealCountdown(remaining),
  );

  // Guards the confirm-at-zero path so a 1s tick cannot queue a refetch storm.
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (!ready || !ended || state !== 'awaiting_reveal') return;

    let cancelled = false;

    async function confirmReveal() {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      if (!cancelled) setConfirming(true);

      try {
        // Order matters. Refetch first so the permission check below reads the
        // server's current answer rather than the snapshot that just expired,
        // then re-sync the clock so `serverNow()` agrees with it.
        await refreshRef.current();
        await syncServerClock(true);
      } catch {
        // Offline at the moment of reveal. Stay in the awaiting state and let
        // the next tick try again — better than unlocking on a failed check.
      } finally {
        confirmingRef.current = false;
        if (!cancelled) {
          setConfirming(false);
          recheck();
        }
      }
    }

    function evaluate() {
      const current = serverNow();
      const left = msUntilReveal({ now: current, revealAt, revealMode });

      if (left === null || left <= 0) {
        void confirmReveal();
        return;
      }

      const next = formatRevealCountdown(left);
      setCountdownLabel((previous) => (previous === next ? previous : next));
    }

    evaluate();
    const interval = setInterval(evaluate, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, ended, state, revealAt, revealMode, recheck]);

  // ── Visibility ────────────────────────────────────────────────────

  const milestone = state === 'hidden' ? null : MILESTONE[state];

  const visible =
    ready &&
    state !== 'hidden' &&
    ack !== null &&
    milestone !== null &&
    !ack[milestone] &&
    dismissed !== state;

  // A state change is new news. Clear the in-session dismissal so the revealed
  // modal still arrives for someone who dismissed the awaiting one and left the
  // screen open across the unlock.
  const previousState = useRef(state);
  useEffect(() => {
    if (previousState.current !== state) {
      previousState.current = state;
      setDismissed(null);
    }
  }, [state]);

  // ── Actions ───────────────────────────────────────────────────────

  const record = useCallback(
    (which: RevealMilestone) => {
      if (!viewerId) return;
      void markAcknowledged(viewerId, celebrationId, which).then(setAck);
    },
    [viewerId, celebrationId],
  );

  const dismiss = useCallback(() => {
    if (state === 'hidden') return;
    setDismissed(state);
    record(MILESTONE[state]);
  }, [state, record]);

  const markRevealedSeen = useCallback(() => {
    record('photosRevealedModalSeenAt');
  }, [record]);

  return {
    visible,
    state: state === 'hidden' ? 'awaiting_reveal' : state,
    countdownLabel,
    confirming,
    dismiss,
    markRevealedSeen,
    recheck,
  };
}

/** Re-exported so screens need only one import from this feature. */
export { canViewerSeePhotos, isEventEnded };
