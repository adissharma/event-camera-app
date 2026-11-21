import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { AppleSignInButton, GoogleSignInButton } from '@/components/auth/auth-buttons';
import { useAuth } from '@/features/auth/context';
import { fetchMyProfile, firstNameFrom, updateDisplayName } from '@/services/profile';
import { resetToAuthenticatedRoot } from '@/lib/navigation/session-root';
import {
  FINAL_LINE,
  FINAL_STEP,
  CONTINUE_HINT,
  INTRO_TIMINGS,
  REVEALS,
  SLIDE_ONE_GROUPS,
  SLIDE_RANGES,
  SLIDE_THREE_START,
  SLIDE_TWO_LINE,
  SLIDE_TWO_START,
  CLOSING_COMMA,
  CLOSING_TAILS,
  hasSeenStillIntro,
  markStillIntroSeen,
} from '@/features/onboarding/still-intro';
import { fitDisplayFace, fontFamilies, layout, radii, spacing, useMotion } from '@/design';
import { copy } from '@/i18n';
import { STILL_LETTERS_PATH } from '@/components/brand/still-letters-path';

/**
 * Welcome — the first screen on a cold start, and on the very first launch,
 * the brand intro that resolves into it.
 *
 * These are one screen rather than two on purpose. The intro's closing move is
 * the sentence "Still, with you forever." becoming the wordmark, and the
 * wordmark it becomes is the one the login screen keeps: the same text node,
 * never unmounted, never faded out and replaced. A separate intro route would
 * have to hand a logo across a navigation boundary, and whatever arrived on
 * the other side would be a different object no matter how carefully it was
 * positioned.
 */

/** Pure black, not the near-black page token — the intro is a cinema screen. */
const BLACK = '#000000';

/** The paragraphs. Sized so a whole slide fits without crowding its edges. */
const PARAGRAPH_SIZE = 21;
const PARAGRAPH_LEADING = 30;
/** Space between paragraphs — the pause between them, made visible. */
const PARAGRAPH_GAP = 24;

/**
 * The closing three lines, set a little larger as the poem turns.
 *
 * Also the size the final line is measured at, which is why it is not larger
 * still: scaled up to the wordmark it has to stay inside the screen, or the
 * tail would meet the edge before it finished fading and would read as
 * cropped rather than as disappearing.
 */
const CLOSING_SIZE = 24;
const CLOSING_LEADING = 34;

/** The wordmark's size once the sentence has resolved into it. */
const MARK_SIZE = 46;
const MARK_SCALE = MARK_SIZE / CLOSING_SIZE;

/** Premium easing: symmetric, no overshoot anywhere in this file. */
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * The wordmark: "Still" with a full stop hung off its right edge.
 *
 * One component for both the intro's transformation and the cold-open screen,
 * because they are supposed to be the same object and had already drifted —
 * built twice, the second copy rendered no full stop at all. Sharing the
 * implementation makes that class of divergence impossible rather than
 * something to keep noticing.
 *
 * The stop is absolutely positioned so it contributes no width. Inline it
 * would occupy space even at zero opacity, and the sentence it grows out of
 * would read "Still ., with you forever." with a gap where the punctuation
 * was waiting. Hanging it also means "Still" is centred as if the stop were
 * not there, which is what puts the word itself on the centre line.
 */
function Wordmark({
  size,
  lineHeight,
  stopOpacity,
  onLayout,
  onStopWidth,
}: {
  size: number;
  lineHeight: number;
  stopOpacity: Animated.Value | number;
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * How wide the hanging suffix is, once laid out.
   *
   * The caller needs it to centre the mark: the suffix contributes no width,
   * so a container that centres this component centres "Still" and lets
   * "s." hang off the right — which puts the finished wordmark visibly right
   * of centre. Half this number, taken off the left, puts it back.
   */
  onStopWidth?: (width: number) => void;
}) {
  // Points per artwork pixel, so the logo's capitals stand as tall as the
  // sentence's would at this type size.
  const pt = (size * LOGO_CAP_PER_EM) / LOGO_ART.capHeight;
  const markWidth = (LOGO_ART.stillEnd - LOGO_ART.left) * pt;
  const stopWidth = (LOGO_ART.right - LOGO_ART.stillEnd) * pt;
  // The text baseline within a line box of this height, so the artwork sits
  // on the same line as the comma and the words after it.
  const baselineY = lineHeight / 2 + size * LOGO_BASELINE_FROM_CENTRE;

  useEffect(() => {
    onStopWidth?.(stopWidth);
  }, [onStopWidth, stopWidth]);

  return (
    <View
      onLayout={onLayout}
      collapsable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={FINAL_LINE.mark}
    >
      <StillLetters pt={pt} height={lineHeight} baselineY={baselineY} />
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: markWidth,
          opacity: stopOpacity,
        }}
      >
        <LogoCrop
          pt={pt}
          from={LOGO_ART.stillEnd}
          to={LOGO_ART.right}
          height={lineHeight}
          baselineY={baselineY}
        />
      </Animated.View>
    </View>
  );
}

/**
 * The supplied logo artwork and where its parts fall, in its own pixels.
 * "Still" runs to `stillEnd`; the "s" and the gradient dot are the rest.
 */
const LOGO_IMAGE = require('../../assets/brand/logo-lockup.png');
const LOGO_ART = {
  width: 1974,
  height: 797,
  left: 99,
  stillEnd: 1426,
  right: 1900,
  baseline: 748,
  capHeight: 655,
} as const;
/** Cap height of the display face, as a fraction of its size. */
const LOGO_CAP_PER_EM = 0.68;
/** How far below a line box's middle the display face's baseline falls, per em. */
const LOGO_BASELINE_FROM_CENTRE = 0.3;
/**
 * "Still", as a vector traced from the logo.
 *
 * The word grows from sentence size into the logo, and a bitmap grown on
 * screen goes soft. An outline is redrawn sharp at every size.
 */
function StillLetters({
  pt,
  height,
  baselineY,
}: {
  pt: number;
  height: number;
  baselineY: number;
}) {
  return (
    <Svg width={(LOGO_ART.stillEnd - LOGO_ART.left) * pt} height={height}>
      <Path
        d={STILL_LETTERS_PATH}
        fill={LOGO_LETTER_COLOUR}
        transform={`translate(${-LOGO_ART.left * pt} ${baselineY - LOGO_ART.baseline * pt}) scale(${pt})`}
      />
    </Svg>
  );
}

/** The letters' colour in the artwork, so the traced word and the bitmap "s." match. */
const LOGO_LETTER_COLOUR = '#FDFDFD';

/**
 * One horizontal slice of the logo artwork, sitting on a text baseline. Used
 * for the "s." and the gradient dot, which only ever appear at rest.
 */
function LogoCrop({
  pt,
  from,
  to,
  height,
  baselineY,
}: {
  pt: number;
  from: number;
  to: number;
  height: number;
  baselineY: number;
}) {
  return (
    <View style={{ width: (to - from) * pt, height, overflow: 'hidden' }}>
      <Image
        source={LOGO_IMAGE}
        contentFit="fill"
        style={{
          position: 'absolute',
          left: -from * pt,
          top: baselineY - LOGO_ART.baseline * pt,
          width: LOGO_ART.width * pt,
          height: LOGO_ART.height * pt,
        }}
      />
    </View>
  );
}

function LegacyWelcomeScreen({
  disableIntro = false,
  hideWordmark = false,
  showAuthControls = true,
  transparent = false,
  onControlsTopLayout,
  onIntroComplete,
}: {
  disableIntro?: boolean;
  hideWordmark?: boolean;
  showAuthControls?: boolean;
  transparent?: boolean;
  onControlsTopLayout?: (top: number) => void;
  /** Once the poem has resolved into the wordmark, or straight away when it does not play. */
  onIntroComplete?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isSignedIn, isRestoring, signInWithApple, signInWithGoogle, isBackendConfigured } =
    useAuth();

  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [appleIsTakingLong, setAppleIsTakingLong] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isAppleLoading) {
      setAppleIsTakingLong(false);
      return;
    }
    const timer = setTimeout(() => setAppleIsTakingLong(true), 12000);
    return () => clearTimeout(timer);
  }, [isAppleLoading]);

  // ── Intro state ───────────────────────────────────────────────────────────

  /**
   * `null` until storage has answered. The screen is black either way, so
   * there is nothing to flash — but committing to a path before the answer
   * arrives would either replay the intro for someone who has seen it or skip
   * it for someone who has not.
   */
  const [introEnabled, setIntroEnabled] = useState<boolean | null>(null);

  /** Which reveal we are on, across both slides. `Infinity` once the intro is over. */
  const [step, setStep] = useState(0);
  const [morphing, setMorphing] = useState(false);
  /**
   * "Tap to continue", shown once the first slide has finished filling. The
   * first slide waits for a tap; the rest of the poem plays through.
   */
  const hintIn = useRef(new Animated.Value(0)).current;
  /** The first slide is full and waiting; the only time a tap does anything. */
  const [awaitingTap, setAwaitingTap] = useState(false);

  /**
   * One opacity per revealed unit, created once.
   *
   * Every unit is mounted from the first frame at zero opacity, so a slide's
   * layout is computed once and never changes as it fills. Reveals are then
   * purely opacity — nothing reflows, nothing above shifts to make room, and
   * the final line's position is known and measurable long before it is
   * needed.
   */
  const reveals = useRef(
    Array.from({ length: FINAL_STEP + 1 }, () => new Animated.Value(0)),
  ).current;
  /**
   * One exit per slide that has to leave — the first two.
   *
   * The third never fades as a slide: the morph takes it apart instead,
   * lifting the last statement out while the two above it clear.
   */
  const slideOut = useRef([new Animated.Value(1), new Animated.Value(1)]).current;
  /** 0 = the sentence in place. 1 = the wordmark, centred. */
  const morph = useRef(new Animated.Value(0)).current;
  const controlsIn = useRef(new Animated.Value(0)).current;
  /** The wordmark's full stop, which exists only once the zoom has finished. */
  const stopIn = useRef(new Animated.Value(0)).current;

  const lastAdvanceAt = useRef(0);
  /**
   * The transformation runs once, and only once. A ref rather than the state
   * flag because the guard has to hold within a single render pass, before
   * the state has landed.
   */
  const morphStarted = useRef(false);

  /**
   * Where the final line sits on screen, and where "Still" sits inside it.
   *
   * Measured rather than derived: the line is the last of five stacked units,
   * so its distance from the centre depends on how every paragraph above it
   * wrapped, which depends on the device's width and the user's text size.
   */
  const finalRowRef = useRef<View>(null);
  const [rowBox, setRowBox] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const [markBox, setMarkBox] = useState<{ x: number; width: number } | null>(null);
  /**
   * The hanging "s." — measured at the size it is drawn, so the morph can be
   * told where "Still" has to land for the finished wordmark to be centred
   * rather than for the word alone to be.
   */
  const [stopWidth, setStopWidth] = useState(0);
  /** The same measurement for the cold-open wordmark, drawn at logo size. */
  const [settledStopWidth, setSettledStopWidth] = useState(0);
  /**
   * Where the endings begin: the right edge of "Still,".
   *
   * Measured off the comma rather than added up from the word's width, because
   * the comma is in the flow and the endings are not — only a measurement of
   * what was actually laid out can put them flush against it.
   */
  const [tailLeft, setTailLeft] = useState(0);

  /**
   * The top edge of the login controls, measured.
   *
   * The wordmark is centred in the space above this rather than on the screen,
   * because the screen's lower third is buttons — centring on it left roughly
   * 315pt of black above the mark and 220 below, which reads as the mark
   * having drifted down toward the controls rather than as a composition.
   *
   * Measured because the block's height is four buttons and their gaps, all of
   * which belong to the button component. Copying a number here would go stale
   * the first time one of them changed.
   */
  const [controlsTop, setControlsTop] = useState<number | null>(null);

  useEffect(() => {
    if (disableIntro) {
      setIntroEnabled(false);
      reveals[FINAL_STEP]!.setValue(1);
      morph.setValue(1);
      stopIn.setValue(1);
      morphStarted.current = true;
      setStep(Infinity);
      return;
    }
    let cancelled = false;
    void hasSeenStillIntro().then((seen) => {
      if (cancelled) return;
      setIntroEnabled(!seen);
      if (seen) {
        // Straight to the settled composition, with no animation to replay.
        reveals[FINAL_STEP]!.setValue(1);
        morph.setValue(1);
        stopIn.setValue(1);
        controlsIn.setValue(1);
        morphStarted.current = true;
        setStep(Infinity);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [disableIntro, morph, controlsIn, stopIn, reveals]);

  // The video splash owns the brand reveal. When it is active, the welcome
  // controls remain mounted behind it but are only allowed to arrive once the
  // original video has settled as the full stop.
  useEffect(() => {
    if (!disableIntro) return;
    if (!showAuthControls) {
      controlsIn.setValue(0);
      return;
    }
    Animated.timing(controlsIn, {
      toValue: 1,
      duration: 420,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [disableIntro, showAuthControls, controlsIn]);

  const ms = useCallback(
    (value: number) => (motion.reduceMotion ? Math.round(value * 0.45) : value),
    [motion.reduceMotion],
  );

  const measureRow = useCallback(() => {
    finalRowRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setRowBox((box) =>
        box &&
        Math.abs(box.x - x) < 0.5 &&
        Math.abs(box.y - y) < 0.5 &&
        Math.abs(box.width - width) < 0.5
          ? box
          : { x, y, width, height },
      );
    });
  }, []);

  /**
   * Where the final line has to travel for "Still" to land dead centre.
   *
   * The row scales about its own middle, so a point sitting `d` from that
   * middle ends up `k · d` from it. "Still" sits left of centre by half the
   * tail's width; the scale multiplies that offset, and the translation has to
   * undo the result. Vertically the row's middle is simply moved to the
   * screen's middle — the scale does not shift it, because it is the centre
   * the scale happens about.
   */
  /**
   * Where the wordmark comes to rest: horizontally centred on the screen,
   * vertically centred between the safe area and the controls.
   */
  const markCentreY = ((controlsTop ?? screenHeight) + insets.top) / 2;

  const travel = useMemo(() => {
    if (!rowBox || !markBox) return { x: 0, y: 0 };
    const rowCentreX = rowBox.x + rowBox.width / 2;
    const markCentreX = rowBox.x + markBox.x + markBox.width / 2;
    // Left of the screen's middle by half the suffix that is about to appear
    // beside it, so "Stills." is centred once it is whole. The word alone sits
    // a few points off-centre for the length of the settle pause, which is not
    // a position anyone reads — the logo is what gets looked at.
    const target = screenWidth / 2 - (stopWidth * MARK_SCALE) / 2;
    return {
      x: target - (rowCentreX + MARK_SCALE * (markCentreX - rowCentreX)),
      y: markCentreY - (rowBox.y + rowBox.height / 2),
    };
  }, [rowBox, markBox, screenWidth, markCentreY, stopWidth]);

  const measured = rowBox !== null && markBox !== null;

  /**
   * Where the word sits in the sentence, as an offset from where the logo
   * comes to rest — the starting point for the full-size logo that stands in
   * for it.
   */
  const markStart = useMemo(() => {
    if (!rowBox || !markBox) return { x: 0, y: 0 };
    return {
      x: rowBox.x + markBox.x + markBox.width / 2 - (screenWidth / 2 - settledStopWidth / 2),
      y: rowBox.y + rowBox.height / 2 - markCentreY,
    };
  }, [rowBox, markBox, screenWidth, settledStopWidth, markCentreY]);

  // ── The sequence ──────────────────────────────────────────────────────────

  const runMorph = useCallback(() => {
    if (morphStarted.current) return;
    morphStarted.current = true;
    setMorphing(true);
    Animated.timing(morph, {
      toValue: 1,
      duration: ms(INTRO_TIMINGS.MORPH_DURATION),
      easing: EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      Animated.sequence([
        // The full stop arrives with the wordmark at rest, inside the pause
        // rather than after it — so the silence before the login controls is
        // the length it was, and the punctuation happens during it.
        Animated.parallel([
          Animated.timing(stopIn, {
            toValue: 1,
            duration: ms(INTRO_TIMINGS.STOP_FADE_IN),
            easing: EASE,
            useNativeDriver: true,
          }),
          Animated.delay(ms(INTRO_TIMINGS.SETTLE_PAUSE)),
        ]),
        Animated.timing(controlsIn, {
          toValue: 1,
          duration: ms(INTRO_TIMINGS.CONTROLS_FADE_IN),
          easing: EASE,
          useNativeDriver: true,
        }),
      ]).start(({ finished: settled }) => {
        if (!settled) return;
        setStep(Infinity);
        setMorphing(false);
        void markStillIntroSeen();
      });
    });
  }, [morph, controlsIn, stopIn, ms]);

  /**
   * The tap that moves on from the first slide once it is full.
   *
   * Taps at any other moment do nothing, so the poem always plays at its own
   * pace. The debounce keeps a resting thumb from counting twice.
   */
  const advance = useCallback(() => {
    // Only the pause at the end of the first slide answers a tap; the poem
    // keeps its own pace everywhere else.
    if (introEnabled !== true || morphing || !awaitingTap) return;
    const now = Date.now();
    if (now - lastAdvanceAt.current < INTRO_TIMINGS.TAP_DEBOUNCE) return;
    lastAdvanceAt.current = now;

    setAwaitingTap(false);
    setStep((index) => index + 1);
  }, [introEnabled, morphing, awaitingTap]);

  /**
   * Reveal the current unit and start its clock.
   *
   * Keyed on `step`, so a tap cancels the pending timer through the effect's
   * own cleanup — the clock is reset by the step changing rather than by
   * anything having to remember to reset it.
   */
  useEffect(() => {
    if (introEnabled !== true || morphing || step > FINAL_STEP) return;

    const entering = REVEALS[step];
    const revealValue = reveals[step];
    if (!entering || !revealValue) return;

    // One number for how long this reveal lasts, shared by the timer that
    // ends it and the bar that measures it. Two copies could disagree, and a
    // bar that finishes early — or late — is exactly the stutter this is
    // meant to remove.
    const opening = step === SLIDE_TWO_START || step === SLIDE_THREE_START;
    const holdMs = ms(entering.hold + (opening ? INTRO_TIMINGS.SLIDE_OVERLAP : 0));

    const animations: Animated.CompositeAnimation[] = [];

    // Crossing into a new slide: the last one clears while this one's first
    // reveal is already arriving. Sequential instead, the black gap between
    // them reads as the app having stopped.
    if (opening) {
      animations.push(
        Animated.timing(slideOut[entering.slide - 2]!, {
          toValue: 0,
          duration: ms(INTRO_TIMINGS.SLIDE_FADE_OUT),
          easing: EASE,
          useNativeDriver: true,
        }),
      );
    }

    const entrance = Animated.timing(revealValue, {
      toValue: 1,
      // A word or an ending arrives faster than a line of the poem — it is
      // part of a sentence already on screen, not a new thought.
      duration: ms(
        entering.part === 'mark' || entering.part === 'tail'
          ? INTRO_TIMINGS.PART_FADE_IN
          : INTRO_TIMINGS.REVEAL_FADE_IN,
      ),
      delay: opening ? ms(INTRO_TIMINGS.SLIDE_OVERLAP) : 0,
      easing: EASE,
      useNativeDriver: true,
    });

    // An ending that replaces another waits for it to go. The two sit in the
    // same place and run to different lengths, so overlapping them would show
    // one sentence through the other rather than reading as a change.
    const outgoing = entering.part === 'tail' && entering.tail! > 0 ? reveals[step - 1] : null;
    animations.push(
      outgoing
        ? Animated.sequence([
            Animated.timing(outgoing, {
              toValue: 0,
              duration: ms(INTRO_TIMINGS.TAIL_SWAP_OUT),
              easing: EASE,
              useNativeDriver: true,
            }),
            entrance,
          ])
        : entrance,
    );

    const running = Animated.parallel(animations);
    running.start();

    // The hint belongs to the finished first slide; a new reveal takes it away.
    Animated.timing(hintIn, {
      toValue: 0,
      duration: ms(200),
      easing: EASE,
      useNativeDriver: true,
    }).start();

    // The first slide waits for a tap once it is full, and says so. After
    // that the poem plays through on its own, and the closing line runs
    // straight on into the wordmark.
    const waitsForTap = entering.slide === 1 && REVEALS[step + 1]?.slide !== 1;
    let hint: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(
      () => {
        if (waitsForTap) {
          setAwaitingTap(true);
          hint = Animated.timing(hintIn, {
            toValue: 1,
            duration: ms(500),
            easing: EASE,
            useNativeDriver: true,
          });
          hint.start();
        } else if (step >= FINAL_STEP) runMorph();
        else setStep((index) => index + 1);
      },
      waitsForTap ? Math.min(holdMs, ms(1200)) : holdMs,
    );

    return () => {
      clearTimeout(timer);
      running.stop();
      hint?.stop();
    };
  }, [step, introEnabled, morphing, reveals, slideOut, hintIn, ms, runMorph]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const introComplete = introEnabled === false || step === Infinity;

  useEffect(() => {
    if (introComplete) onIntroComplete?.();
  }, [introComplete, onIntroComplete]);

  const handlePostSignIn = useCallback(async () => {
    try {
      const profile = await fetchMyProfile();
      if (profile?.onboarding_completed_at) {
        resetToAuthenticatedRoot(router);
        return;
      }

      // Google and Apple accounts arrive with a name, so don't ask for it again.
      // It can still be changed from the profile.
      const providerName = firstNameFrom(profile);
      if (providerName) {
        await updateDisplayName(providerName);
        resetToAuthenticatedRoot(router);
        return;
      }

      router.replace('/your-name');
    } catch {
      // A profile read failure should never silently bypass onboarding.
      router.replace('/your-name');
    }
  }, [router]);

  useEffect(() => {
    // A restored session does not get to cut the intro off mid-sentence — but
    // it does get to redirect the moment the intro is over.
    if (!introComplete || !showAuthControls) return;
    if (!isRestoring && isSignedIn) {
      void handlePostSignIn();
    }
  }, [handlePostSignIn, isSignedIn, isRestoring, introComplete, showAuthControls]);

  async function handleAppleSignIn() {
    setError(undefined);
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (!result.ok) {
        setError(result.error.code === 'cancelled'
          ? 'Apple sign in was cancelled. Tap Continue with Apple to try again.'
          : result.error.message);
        return;
      }
    } catch {
      setError('Could not complete Apple sign in. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(undefined);
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        if (result.error.code !== 'cancelled') {
          setError(result.error.message);
        }
        return;
      }
    } catch {
      setError('Could not complete Google sign in. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  }

  /**
   * Counts the taps that reveal email sign-in.
   *
   * Refs rather than state: nothing on screen changes until the fifth tap,
   * and re-rendering the welcome screen on every touch would be work done
   * for no one to see.
   */
  const secretTapCount = useRef(0);
  const secretTapAt = useRef(0);

  const registerSecretTap = useCallback(() => {
    const now = Date.now();
    secretTapCount.current =
      now - secretTapAt.current > SECRET_TAP_WINDOW_MS ? 1 : secretTapCount.current + 1;
    secretTapAt.current = now;

    if (secretTapCount.current < SECRET_TAPS) return;
    secretTapCount.current = 0;
    // Confirms the gesture landed: without a button there is nothing else to
    // tell you it worked until the next screen arrives.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.push('/sign-in');
  }, [router]);

  // ── Render ────────────────────────────────────────────────────────────────

  const introRunning = introEnabled === true && step !== Infinity;
  const currentSlide = REVEALS[Math.min(step, FINAL_STEP)]?.slide ?? 1;
  const showIntro = introEnabled !== null;
  /**
   * Each screen outlives the step that ends it.
   *
   * Unmounting one on the step that starts its fade-out would cut it instantly
   * — a crossfade needs both screens on the glass at once, which is the whole
   * reason they are absolutely positioned over the same centred column.
   */
  /**
   * Each slide outlives the step that ends it — a crossfade needs both on the
   * glass at once, which is why they are absolutely positioned over the same
   * centred column.
   */
  const slideOneMounted = introEnabled === true && step <= SLIDE_TWO_START;
  const slideTwoMounted =
    introEnabled === true && step >= SLIDE_TWO_START && step <= SLIDE_THREE_START;
  /**
   * The closing slide outlives the sequence.
   *
   * `step` becomes `Infinity` when the intro finishes, and the first two
   * slides fall out of their ranges and unmount on their own — but this one
   * must not. It holds the wordmark the morph created, and that node is what
   * the login screen keeps: unmounting it here left the finished screen with
   * its buttons and no logo at all.
   */
  const slideThreeMounted = introEnabled === true && step >= SLIDE_THREE_START;

  /**
   * The progress bar, clearing inside the morph rather than before it.
   *
   * It belongs to the reading, and the reading is over the moment the word
   * starts moving — but it has to leave while that is happening, or the screen
   * loses a piece of itself and then something else moves.
   */
  /**
   * Everything on the closing line except the word itself, leaving as it
   * grows.
   *
   * Gone before the line can reach the screen edge, so the sentence fades
   * rather than appearing to be cropped by it.
   */
  const tailMorphFade = morph.interpolate({
    inputRange: [0, INTRO_TIMINGS.TAIL_FADE_UNTIL, 1],
    outputRange: [1, 0, 0],
  });

  const chromeOut = morph.interpolate({
    inputRange: [0, INTRO_TIMINGS.REST_FADE_UNTIL, 1],
    outputRange: [1, 0, 0],
  });

  return (
    <View style={[S.screen, transparent && { backgroundColor: 'transparent' }]}>
      {/* "Tap to continue", under the first slide once it is full. */}
      {slideOneMounted ? (
        <Animated.View
          style={[
            S.hint,
            { bottom: insets.bottom + spacing.lg + 22, opacity: hintIn },
          ]}
          pointerEvents="none"
        >
          <AppText variant="caption" align="center" style={S.hintText}>
            {CONTINUE_HINT}
          </AppText>
        </Animated.View>
      ) : null}

      {/* Carousel dots: which of the three slides this is. */}
      {introRunning ? (
        <Animated.View
          style={[S.dots, { bottom: insets.bottom + spacing.lg, opacity: chromeOut }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {SLIDE_RANGES.map(({ slide }) => (
            <View key={slide} style={[S.dot, slide === currentSlide && S.dotActive]} />
          ))}
        </Animated.View>
      ) : null}

      {/* Slide one, a line at a time. Every line is mounted from the first
          frame so the block's layout is settled before anything is visible —
          a line arriving into a centred column that then re-centres itself
          would shove its neighbours around, which is motion nobody asked for.
          The grouping is the spacing: lines within a group are one sentence
          continuing, the gap between groups is the pause between thoughts. */}
      {slideOneMounted ? (
        <Animated.View style={[S.slide, { opacity: slideOut[0] }]} pointerEvents="none">
          {SLIDE_ONE_GROUPS.map((group, groupIndex) => {
            // Parts are numbered across the whole slide, not within a group —
            // the reveals are one sequence and the grouping is only layout.
            let reveal = SLIDE_ONE_GROUPS.slice(0, groupIndex)
              .flat()
              .reduce((total, parts) => total + parts.length, 0);
            return (
              <View key={groupIndex} style={S.lineGroup}>
                {group.map((parts, lineIndex) => {
                  const first = reveal;
                  reveal += parts.length;
                  // A line in parts is drawn once per part, stacked, each
                  // copy showing only its own part. Every copy holds the whole
                  // sentence, so all of them wrap identically and the second
                  // part lands exactly where it belongs after the first.
                  return (
                    <View key={lineIndex}>
                      {parts.map((_, partIndex) => (
                        <Animated.View
                          key={partIndex}
                          style={[
                            partIndex > 0 && StyleSheet.absoluteFill,
                            { opacity: reveals[first + partIndex] },
                          ]}
                          accessibilityElementsHidden={partIndex > 0}
                          importantForAccessibility={partIndex > 0 ? 'no-hide-descendants' : 'auto'}
                        >
                          <AppText
                            align="left"
                            style={S.paragraph}
                            accessibilityLabel={parts.join('')}
                          >
                            {parts.map((text, index) => (
                              <AppText
                                key={index}
                                style={[S.paragraph, index !== partIndex && S.hiddenPart]}
                              >
                                {text}
                              </AppText>
                            ))}
                          </AppText>
                        </Animated.View>
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </Animated.View>
      ) : null}

      {/* Slide two: the promise, alone. */}
      {slideTwoMounted ? (
        <Animated.View style={[S.slide, { opacity: slideOut[1] }]} pointerEvents="none">
          <Animated.View style={{ opacity: reveals[SLIDE_TWO_START] }}>
            <AppText align="left" style={S.paragraph} accessibilityLiveRegion="polite">
              {SLIDE_TWO_LINE}
            </AppText>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/*
        Slide three: one line, with the name fixed and the sentence changing
        after it.

        The row holds exactly one in-flow child — the wordmark — so its width
        is the word's width, and the three endings hang off that edge
        absolutely. That is what keeps "Still" from shifting as the sentence
        behind it changes length: an in-flow row would re-centre itself on
        every swap, and the one thing this slide is built on is that the word
        does not move.

        It is also the object the morph transforms. "Still" is never
        re-rendered, never replaced and never crosses a fade — at the end it is
        the same text node that arrived at the top of the slide.
      */}
      {slideThreeMounted ? (
        <View style={S.slide} pointerEvents="none">
          <Animated.View
            ref={finalRowRef}
            collapsable={false}
            style={[
              S.finalRow,
              {
                transform: [
                  {
                    translateX: morph.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, travel.x],
                    }),
                  },
                  {
                    translateY: morph.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, travel.y],
                    }),
                  },
                  {
                    scale: morph.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, MARK_SCALE],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Measured here rather than inside `Wordmark`, so the rect is
                relative to the row the travel is computed against. */}
            <Animated.View
              onLayout={measureRow}
              style={{ opacity: reveals[SLIDE_THREE_START] }}
            >
              {/* Laid out for its measurements but never seen: the word on
                  screen is the full-size logo below, shrunk to sit here. A
                  bitmap scaled up blurs; one scaled down stays sharp. */}
              <View style={{ opacity: 0 }}>
                <Wordmark
                  size={CLOSING_SIZE}
                  lineHeight={CLOSING_LEADING}
                  stopOpacity={0}
                  onStopWidth={setStopWidth}
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    setMarkBox((box) =>
                      box && Math.abs(box.x - x) < 0.5 && Math.abs(box.width - width) < 0.5
                        ? box
                        : { x, width },
                    );
                  }}
                />
              </View>
            </Animated.View>

            {/*
              The comma, in the flow beside the word so the two read as one
              piece and the endings can hang off the pair. It leaves with the
              sentence during the morph — the logo is "Stills.", not "Still,".
            */}
            <Animated.Text
              style={[
                S.closingLine,
                {
                  opacity: Animated.multiply(reveals[SLIDE_THREE_START]!, tailMorphFade),
                },
              ]}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setTailLeft((current) => (Math.abs(current - (x + width)) < 0.5 ? current : x + width));
              }}
              allowFontScaling={false}
            >
              {CLOSING_COMMA}
            </Animated.Text>

            {CLOSING_TAILS.map((tail, index) => (
              <Animated.Text
                key={index}
                style={[
                  S.closingLine,
                  // Stacked at the word's right edge, all three in the same
                  // place. Only one is ever visible, and taking them out of
                  // the flow means the longest of them cannot widen the row
                  // and drag the word off its spot.
                  { position: 'absolute', top: 0, left: tailLeft },
                  {
                    opacity: Animated.multiply(
                      reveals[SLIDE_THREE_START + 1 + index]!,
                      tailMorphFade,
                    ),
                  },
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {tail}
              </Animated.Text>
            ))}
          </Animated.View>
        </View>
      ) : null}

      {/*
        The wordmark, on a launch where the intro does not run.

        Rendered plainly rather than through the morphing row, because there
        is no transformation to preserve here — nothing preceded it. The row
        positions itself from a measurement that only lands after the first
        layout pass, so with `morph` already at its end value it painted once
        at the sentence's own left-aligned position and then snapped to centre
        the moment the measurement arrived. Continuity is worth a measured
        transform during the intro; on a cold open it buys a visible jump and
        nothing else.
      */}
      {showIntro && (!introEnabled || slideThreeMounted) && controlsTop !== null && !hideWordmark ? (
        <View
          style={[S.settledMark, { top: insets.top, height: controlsTop - insets.top }]}
          pointerEvents="none"
        >
          {/*
            Nudged left by half the hanging suffix, for the same reason the
            morph aims left of centre: the suffix contributes no width, so
            centring this component would centre "Still" and leave "Stills."
            sitting right of the middle. Both paths land in the same place.
          */}
          <View style={{ transform: [{ translateX: -settledStopWidth / 2 }] }}>
            {/*
              During the intro this is also the word in the sentence: drawn at
              logo size, shrunk and moved onto the hidden word's spot, then
              brought back to rest as the sentence grows. Its path matches the
              row's exactly — both move linearly with \`morph\`.
            */}
            <View style={{ opacity: !introEnabled || measured ? 1 : 0 }}>
              <Animated.View
                style={
                  introEnabled
                    ? {
                        opacity: reveals[SLIDE_THREE_START],
                        transform: [
                          {
                            translateX: morph.interpolate({
                              inputRange: [0, 1],
                              outputRange: [markStart.x, 0],
                            }),
                          },
                          {
                            translateY: morph.interpolate({
                              inputRange: [0, 1],
                              outputRange: [markStart.y, 0],
                            }),
                          },
                          {
                            scale: morph.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1 / MARK_SCALE, 1],
                            }),
                          },
                        ],
                      }
                    : undefined
                }
              >
                <Wordmark
                  size={MARK_SIZE}
                  lineHeight={CLOSING_LEADING * MARK_SCALE}
                  stopOpacity={introEnabled ? stopIn : 1}
                  onStopWidth={setSettledStopWidth}
                />
              </Animated.View>
            </View>
          </View>
        </View>
      ) : null}

      {/*
        The login screen, revealed around the wordmark rather than replacing
        it. One opacity for the whole block: the controls arrive as a single
        composition, not as four separate entrances.
      */}
      {/*
        Email sign-in, without a button for it.

        The screen offers Apple and Google only. Email remains reachable for
        our own testing through five taps anywhere the visible controls are
        not: this sits *beneath* the controls block, which passes touches
        through the space around its buttons, so a tap on Apple, Google or
        Join event is consumed there and never counted here.

        Taps must be consecutive — see `SECRET_TAP_WINDOW_MS` — so five stray
        touches spread across a session cannot open it by accident.
      */}
      {!introRunning && showAuthControls ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={registerSecretTap}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}

      <Animated.View
        style={[
          S.controls,
          {
            paddingBottom: insets.bottom + spacing.base,
            opacity: showAuthControls ? controlsIn : 0,
          },
        ]}
        pointerEvents={introRunning || !showAuthControls ? 'none' : 'box-none'}
        // Fires whether or not the block is visible, so the wordmark knows
        // where to sit long before the controls fade in.
        onLayout={(event) => {
          const { y } = event.nativeEvent.layout;
          setControlsTop((current) => (current !== null && Math.abs(current - y) < 0.5 ? current : y));
          onControlsTopLayout?.(y);
        }}
      >
        {error || !isBackendConfigured || appleIsTakingLong ? (
          <View style={S.errorBanner}>
            <AppText variant="bodySmall" style={S.errorText}>
              {error ?? (!isBackendConfigured
                ? 'Sign in is temporarily unavailable. Please try again later.'
                : 'Still waiting for Apple sign in. You can cancel and try again.')}
            </AppText>
          </View>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <AppleSignInButton
            onPress={handleAppleSignIn}
            loading={isAppleLoading}
            disabled={isGoogleLoading || !isBackendConfigured}
          />

          <GoogleSignInButton
            onPress={handleGoogleSignIn}
            loading={isGoogleLoading}
            disabled={isAppleLoading || !isBackendConfigured}
          />

          <View style={{ paddingTop: spacing.xs }}>
            <Button
              label={copy.welcome.joinEvent}
              variant="quiet"
              labelStyle={{ fontSize: 16, lineHeight: 20 }}
              onPress={() => router.push('/j')}
            />
          </View>
        </View>
      </Animated.View>

      {/*
        The whole screen is the control. No button, no progress dots — the
        sequence should read as titles, and titles do not ask to be operated.
      */}
      {introRunning && awaitingTap ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={advance}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityHint="Continues the introduction"
        />
      ) : null}
    </View>
  );
}

/** Taps that reveal email sign-in, and how long a tap waits for the next. */
const SECRET_TAPS = 5;
const SECRET_TAP_WINDOW_MS = 3000;

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },

  /**
   * Where the wordmark rests once the intro is over — and where the intro's
   * own transformation delivers it, which is why this is plain centring
   * rather than a second opinion about the position.
   */
  settledMark: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Both slides occupy the same centred column. */
  slide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    gap: PARAGRAPH_GAP,
  },

  paragraph: fitDisplayFace({
    fontFamily: fontFamilies.display,
    color: '#FFFFFF',
    textAlign: 'left',
    fontSize: PARAGRAPH_SIZE,
    lineHeight: PARAGRAPH_LEADING,
    letterSpacing: -0.3,
  }),

  /** The three closing lines sit closer together than the paragraphs do. */
  /**
   * Lines within one paragraph, set tight.
   *
   * The slide's own `gap` separates the groups; this leaves none inside them,
   * so a paragraph reads as continuous text rather than as a stack of
   * separate statements that happen to be near each other.
   */
  lineGroup: { alignSelf: 'stretch', alignItems: 'flex-start' },
  /** The parts of a line that another stacked copy is showing. */
  hiddenPart: { color: 'transparent' },

  /** The tap affordance: at the foot of the screen, and quieter than the poem. */
  hint: { position: 'absolute', left: layout.gutter, right: layout.gutter },
  hintText: { color: 'rgba(255, 255, 255, 0.38)', letterSpacing: 0.6 },

  /** The closing slide's one line, and the endings that take turns after it. */
  closingLine: fitDisplayFace({
    fontFamily: fontFamilies.display,
    color: '#FFFFFF',
    textAlign: 'left',
    fontSize: CLOSING_SIZE,
    lineHeight: CLOSING_LEADING,
    letterSpacing: -0.3,
  }),
  /**
   * Hugs the wordmark, which is its only in-flow child — so the row's width is
   * the word's width and a longer ending cannot push it around.
   */
  finalRow: { flexDirection: 'row', alignSelf: 'flex-start' },

  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  dotActive: { backgroundColor: 'rgba(255, 255, 255, 0.9)' },

  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.gutter,
    gap: spacing.sm,
  },

  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: layout.hairline,
    marginBottom: spacing.xs,
  },
  errorText: { color: '#F87171' },
});

/**
 * Launch entry point. The original prose presentation above is intentionally
 * retained as `LegacyWelcomeScreen` and can be restored by changing this
 * wrapper; only the video mark is active today.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { isSignedIn, isRestoring } = useAuth();
  const [showVideoSplash, setShowVideoSplash] = useState<boolean | null>(null);
  const [authVisible, setAuthVisible] = useState(false);

  // No account is asked for at the door. Someone signed out goes straight to the
  // dashboard, and is asked to sign in when publishing needs it or when they tap
  // the profile button. A signed-in host is routed on by the screen below.
  const introDone = showVideoSplash === false || authVisible;
  useEffect(() => {
    if (introDone && !isRestoring && !isSignedIn) router.replace('/home');
  }, [introDone, isRestoring, isSignedIn, router]);

  useEffect(() => {
    let cancelled = false;
    void hasSeenStillIntro().then((seen) => {
      if (!cancelled) setShowVideoSplash(!seen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The poem marks itself seen when it finishes.
  const handleIntroComplete = useCallback(() => setAuthVisible(true), []);

  // First launch: the poem on plain black, a line at a time, resolving into
  // the wordmark. (The film intro is parked in features/onboarding/film-intro.)
  if (showVideoSplash === true) {
    return (
      <LegacyWelcomeScreen
        showAuthControls={authVisible && isSignedIn}
        onIntroComplete={handleIntroComplete}
      />
    );
  }

  // Keep the native launch canvas quiet while the first-run flag resolves;
  // rendering the welcome controls here would create a visible flash before
  // the video splash on a cold start.
  if (showVideoSplash === null) {
    return <View style={{ flex: 1, backgroundColor: BLACK }} />;
  }

  // Signed out, this is on its way to the dashboard: drawing the sign-in buttons
  // would flash them for a frame on the way past.
  if (isRestoring || !isSignedIn) {
    return <View style={{ flex: 1, backgroundColor: BLACK }} />;
  }

  // Keep the established signed-in redirect behaviour, while explicitly
  // suppressing the legacy prose intro.
  return <LegacyWelcomeScreen disableIntro />;
}
