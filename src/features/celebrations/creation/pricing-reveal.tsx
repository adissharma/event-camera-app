import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, radii, spacing, useMotion } from '@/design';

/**
 * The creation reveal: a single coordinated sequence that carries the host
 * from "Creating your event" to the paywall without a navigation transition.
 *
 * Every duration lives in one table, and the sequence is driven by an explicit
 * stage rather than by timeouts scattered through the components that animate.
 * That is not tidiness for its own sake — the whole effect depends on several
 * layers moving in agreement (the cover fading in while the title is still
 * settling, the gallery fading out while the sheet is already rising), and
 * independent timers drift apart the moment one of them is delayed by a slow
 * frame. One clock, many listeners.
 */

export type RevealStage = 'creating' | 'ready' | 'preview' | 'transitioningToPaywall' | 'paywall';

/**
 * The published timeline, in milliseconds.
 *
 * Tuned to land the interactive paywall around 4.6s. The brief's budget is
 * 3.5–5s, and the lower half of that is too quick for the preview to register
 * as "that's my event" — the dwell is the point of the sequence, not padding
 * around it.
 */
export const REVEAL_TIMINGS = {
  /**
   * The floor, not the target. Setup that finishes sooner still waits this
   * long, because a loading state that flashes past reads as a glitch rather
   * than as work being done.
   */
  MIN_CREATING_DURATION: 1500,
  /**
   * What the stage typically lasts once the floor and a warm cover fetch are
   * both accounted for. Nothing is gated on it — it is the sweep the progress
   * line is drawn against, so the bar is close to full when the stage ends
   * rather than being cut off at a quarter.
   */
  TARGET_CREATING_DURATION: 1900,
  /** The cover and the event's name fading up out of the creation state. */
  READY_REVEAL_DURATION: 500,
  /** How long the cover and name hold alone before the gallery assembles. */
  READY_DWELL_DURATION: 420,
  /** Gallery content and challenges fading up. */
  PREVIEW_REVEAL_DURATION: 600,
  /**
   * How long the preview holds after it has finished assembling.
   *
   * Long enough to contain the challenge strip's nudge with a beat either
   * side, so the strip has finished moving before anything begins to leave —
   * a hint that gets cut off by the fade-out is worse than no hint. Derived
   * below rather than typed, so retiming the nudge cannot leave the dwell too
   * short for it.
   */
  get PREVIEW_DWELL_DURATION(): number {
    return (
      REVEAL_TIMINGS.CHIP_NUDGE_DELAY +
      REVEAL_TIMINGS.CHIP_NUDGE_STEPS.reduce((total, [, ms]) => total + ms, 0) +
      REVEAL_TIMINGS.CHIP_NUDGE_SETTLE
    );
  },

  /**
   * The challenge strip's "there is more here" nudge.
   *
   * Travel and step timings lifted verbatim from the theme and treatment
   * carousels, which make the same gesture on arrival — one slide out and
   * back, then a smaller echo, never a loop. A strip that keeps bouncing
   * reads as broken within seconds, and the motion system forbids looping
   * decoration outright.
   */
  CHIP_NUDGE_DELAY: 160,
  CHIP_NUDGE_SETTLE: 140,
  CHIP_NUDGE_TRAVEL: -14,
  /** `[fraction of travel, duration]`, run in order. */
  CHIP_NUDGE_STEPS: [
    [1, 260],
    [0, 260],
    [0.6, 200],
    [0, 220],
  ] as readonly (readonly [number, number])[],
  /**
   * How long the stage lasts before the paywall becomes interactive.
   *
   * The phases below overlap inside and beyond it — the title is still
   * settling for a moment after the screen is usable, which is deliberate.
   * Waiting for every last motion to finish before accepting a tap would make
   * the screen feel locked, not polished.
   */
  PAYWALL_TRANSITION_DURATION: 700,

  /*
   * The transition is three overlapping phases, not three steps. Every offset
   * below is milliseconds from the moment the transition begins, written out
   * rather than derived from fractions, because the whole point is that the
   * phases start before their predecessors finish and the overlaps have to be
   * readable at a glance:
   *
   *   0    340   gallery content out ──┐
   *   0    700   title travel ──────────┤
   *   0    620   gradient turns ────────┤
   *   60   740   points appear ─────────┤
   *   150  530   pricing card in ───────┘
   *
   * The top half moves the instant the gallery body starts to go, and the
   * card enters underneath it. Nothing waits for anything else at all: the
   * whole transition is one gesture rather than a relay.
   */

  /** Phase one: stats strip, guestbook, challenges and grid clearing out. */
  GALLERY_FADE_OUT_DURATION: 340,

  /** Phase two: the sheet, beginning while the gallery is still fading. */
  PANEL_RISE_START: 150,
  PANEL_RISE_DURATION: 380,
  PANEL_RISE_DISTANCE: 26,

  /**
   * Title travel, gradient turn and entitlement rows, together.
   *
   * Zero: they begin on the same frame the gallery body begins to leave.
   * Holding them back — even until the card was merely *arriving* — read as a
   * pause, because the top half of the screen sat still while the bottom
   * moved. One offset for all three, so they stay a single gesture.
   */
  COORDINATED_PHASE_START: 0,
  TITLE_TRAVEL_DURATION: 700,
  /** A beat behind the title, so the rows follow it rather than race it. */
  ENTITLEMENT_START_OFFSET: 60,

  /**
   * Entitlement rows, once the title is on its way.
   *
   * The step is long enough that the rows genuinely arrive one after another
   * rather than as a block with a slight lean. At 110ms apart with a 240ms
   * fade each, a row is roughly half-way in when the next one starts — which
   * reads as a list being written, not as five things blinking on together
   * and not as five separate events either.
   */
  ENTITLEMENT_FADE_DURATION: 240,
  ENTITLEMENT_STAGGER_STEP: 110,

  /**
   * The cover's vertical ramp giving way to the paywall's horizontal one.
   *
   * Eased in and out rather than run flat, which is what lets it start early
   * without cost. The vertical ramp is what dissolves the foot of the
   * photograph into the page: lift it while the bottom of the hero is still
   * exposed and the image ends at a hard horizontal edge. Under an ease-in-out
   * the ramp has barely moved through the first third of this duration, by
   * which time the sheet is fully opaque over that edge — so the change begins
   * within the coordinated phase but only becomes visible once it is safe.
   */
  GRADIENT_SWAP_DURATION: 620,
} as const;

/**
 * Advances the stage machine, gated on real setup work rather than on a timer
 * alone.
 *
 * `setupComplete` is what makes the creating stage honest. There is genuinely
 * something to wait for here — the host's cover has to be signed and decoded
 * before it can be crossfaded in, and revealing a blank frame would undo the
 * whole effect — so the stage holds until both the floor duration has passed
 * and that work has landed. When the work is quick (a bundled fallback cover)
 * the target duration governs instead, and nothing is blocked artificially
 * beyond it.
 */
export function useRevealSequence({
  enabled,
  setupComplete,
  onComplete,
}: {
  enabled: boolean;
  setupComplete: boolean;
  onComplete?: () => void;
}) {
  const motion = useMotion();
  const [stage, setStage] = useState<RevealStage>(enabled ? 'creating' : 'paywall');
  const startedAt = useRef(Date.now());
  const completed = useRef(!enabled);

  // Reduce-motion keeps every stage — the story is the point, and skipping to
  // the paywall would hide the fact that an event was just built. Only the
  // dwell time shortens, so the same four beats land in noticeably less time.
  const scale = motion.reduceMotion ? 0.6 : 1;

  const advance = useCallback((next: RevealStage) => setStage(next), []);

  useEffect(() => {
    if (!enabled || stage !== 'creating') return;

    // Two conditions, both required: the floor has passed AND setup has
    // landed. Setup that overruns is not raced or timed out — the effect
    // simply does not schedule anything and re-runs when `setupComplete`
    // flips, which is the "remain gracefully in this state" case. Nothing
    // here can advance to a reveal whose cover is not ready to be revealed.
    if (!setupComplete) return;

    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(REVEAL_TIMINGS.MIN_CREATING_DURATION * scale - elapsed, 0);

    const timer = setTimeout(() => advance('ready'), remaining);
    return () => clearTimeout(timer);
  }, [enabled, stage, setupComplete, scale, advance]);

  useEffect(() => {
    if (!enabled) return;

    const next: Partial<Record<RevealStage, [RevealStage, number]>> = {
      ready: ['preview', (REVEAL_TIMINGS.READY_REVEAL_DURATION + REVEAL_TIMINGS.READY_DWELL_DURATION) * scale],
      preview: [
        'transitioningToPaywall',
        (REVEAL_TIMINGS.PREVIEW_REVEAL_DURATION + REVEAL_TIMINGS.PREVIEW_DWELL_DURATION) * scale,
      ],
      transitioningToPaywall: ['paywall', REVEAL_TIMINGS.PAYWALL_TRANSITION_DURATION * scale],
    };

    const step = next[stage];
    if (!step) return;

    const timer = setTimeout(() => advance(step[0]), step[1]);
    return () => clearTimeout(timer);
  }, [enabled, stage, scale, advance]);

  useEffect(() => {
    if (stage !== 'paywall' || completed.current) return;
    completed.current = true;
    onComplete?.();
  }, [stage, onComplete]);

  return useMemo(
    () => ({
      stage,
      /** Nothing on the screen may be touched before this. */
      isInteractive: stage === 'paywall',
      /** The cover exists from here on, and never changes identity again. */
      coverVisible: stage !== 'creating',
      reduceMotion: motion.reduceMotion,
      /** Scales a published duration by the reduce-motion factor. */
      ms: (value: number) => value * scale,
    }),
    [stage, motion.reduceMotion, scale],
  );
}

const BRAND_MARK = require('../../../../assets/brand/logo.png');
const GRAIN = require('../../../../assets/images/textures/dust-1.png');

/**
 * Stage one: a branded holding screen that deliberately shows nothing of the
 * event.
 *
 * The cover is withheld until the `ready` stage so that its arrival *is* the
 * reveal. Showing it here would spend the only surprise the sequence has on a
 * loading state, and the rest would be a long fade between two views of the
 * same photograph.
 */
export function CreatingOverlay({ visible }: { visible: boolean }) {
  const motion = useMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: motion.reduceMotion ? 160 : 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setMounted(false));
  }, [visible, fade, motion.reduceMotion]);

  useEffect(() => {
    if (motion.reduceMotion) return;

    // A slow breath on the mark and the status line, rather than a spinner.
    // A spinner says "this may take a while"; this says "something is being
    // made", which is the impression the stage is for.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, motion.reduceMotion]);

  useEffect(() => {
    // Eases toward full but never arrives on its own: the bar is a measure of
    // attention, not of a percentage we do not have. It is completed by the
    // stage ending, which is the only honest way to finish an indeterminate
    // progress indicator.
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.reduceMotion ? 600 : REVEAL_TIMINGS.TARGET_CREATING_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, motion.reduceMotion]);

  if (!mounted) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, S.creating, { opacity: fade }]} pointerEvents="auto">
      <Image source={GRAIN} style={S.grain} resizeMode="repeat" accessibilityIgnoresInvertColors />

      <Animated.View
        style={{
          alignItems: 'center',
          opacity: motion.reduceMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
        }}
      >
        <Image source={BRAND_MARK} style={S.brandMark} resizeMode="contain" accessibilityIgnoresInvertColors />
      </Animated.View>

      <View style={S.creatingCopy}>
        <AppText
          variant="titleMedium"
          align="center"
          style={S.creatingText}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
        >
          Creating your event
          <Ellipsis />
        </AppText>

        <View style={S.progressTrack}>
          <Animated.View
            style={[
              S.progressFill,
              { transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.04, 1] }) }] },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * The three dots, animated as text rather than as three views.
 *
 * Held in a child component so its once-a-second re-render does not drag the
 * rest of the overlay — including the looping pulse — through React with it.
 */
function Ellipsis() {
  const motion = useMotion();
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (motion.reduceMotion) return;
    const timer = setInterval(() => setCount((value) => (value % 3) + 1), 420);
    return () => clearInterval(timer);
  }, [motion.reduceMotion]);

  // Non-breaking spaces hold the width so the line does not shuffle sideways
  // as dots come and go.
  return <>{'.'.repeat(count) + ' '.repeat(3 - count)}</>;
}

const S = StyleSheet.create({
  creating: {
    backgroundColor: colours.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  brandMark: { width: 132, height: 44, opacity: 0.92 },
  creatingCopy: { alignItems: 'center', gap: spacing.lg },
  creatingText: { color: 'rgba(255, 255, 255, 0.86)' },
  progressTrack: {
    width: 132,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transformOrigin: 'left center',
  },

});
