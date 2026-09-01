import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import {
  AppleSignInButton,
  GoogleSignInButton,
  EmailSignInButton,
} from '@/components/auth/auth-buttons';
import { useAuth } from '@/features/auth/context';
import { fetchMyProfile } from '@/services/profile';
import { resetToAuthenticatedRoot } from '@/lib/navigation/session-root';
import {
  CONTINUE_HINT,
  FINAL_LINE,
  FINAL_STEP,
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
import { fontFamilies, layout, radii, spacing, useMotion } from '@/design';
import { copy } from '@/i18n';

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
const PARAGRAPH_SIZE = 26;
const PARAGRAPH_LEADING = 38;
/** Space between paragraphs — the pause between them, made visible. */
const PARAGRAPH_GAP = 30;

/**
 * The closing three lines, set a little larger as the poem turns.
 *
 * Also the size the final line is measured at, which is why it is not larger
 * still: scaled up to the wordmark it has to stay inside the screen, or the
 * tail would meet the edge before it finished fading and would read as
 * cropped rather than as disappearing.
 */
const CLOSING_SIZE = 30;
const CLOSING_LEADING = 42;

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
  const face = {
    fontFamily: fontFamilies.display,
    color: '#FFFFFF',
    fontSize: size,
    lineHeight,
    letterSpacing: -0.3,
  } as const;

  /**
   * The mark's own width, so the stop can be placed at a pixel offset.
   *
   * `left: '100%'` reads better but does not survive every parent: under a
   * centring container the percentage resolved against nothing and the stop
   * was not painted at all — silently, and only on the cold-open screen,
   * because that is the one path whose parent centres. A measured number
   * resolves the same way wherever this is mounted.
   */
  const [markWidth, setMarkWidth] = useState(0);

  return (
    <View onLayout={onLayout} collapsable={false}>
      <Text
        style={face}
        numberOfLines={1}
        allowFontScaling={false}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          setMarkWidth((current) => (Math.abs(current - width) < 0.5 ? current : width));
        }}
      >
        {FINAL_LINE.mark}
      </Text>
      <Animated.Text
        style={[
          face,
          { position: 'absolute', top: 0, left: markWidth },
          { opacity: stopOpacity },
        ]}
        allowFontScaling={false}
        onLayout={(event) => onStopWidth?.(event.nativeEvent.layout.width)}
      >
        {FINAL_LINE.stop}
      </Animated.Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isSignedIn, isRestoring, signInWithApple, signInWithGoogle, isBackendConfigured } =
    useAuth();

  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

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
  /**
   * One filling line per slide, so the poem declares its own length.
   *
   * The original brief ruled out progress indicators; this is the exception it
   * asked for afterwards, and it earns its place by answering a real question
   * — "how much more of this is there?" — that eight silent reveals otherwise
   * leave open. Two hairlines rather than dots or a percentage: it says *two
   * slides* at a glance and nothing else.
   */
  const slideProgress = useRef(SLIDE_RANGES.map(() => new Animated.Value(0))).current;
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
  }, [morph, controlsIn, stopIn, reveals]);

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

  // ── The sequence ──────────────────────────────────────────────────────────

  const runMorph = useCallback(() => {
    if (morphStarted.current) return;
    morphStarted.current = true;
    setMorphing(true);
    Animated.sequence([
      Animated.timing(morph, {
        toValue: 1,
        duration: ms(INTRO_TIMINGS.MORPH_DURATION),
        easing: EASE,
        useNativeDriver: true,
      }),
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
    ]).start(({ finished }) => {
      if (!finished) return;
      setStep(Infinity);
      setMorphing(false);
      void markStillIntroSeen();
    });
  }, [morph, controlsIn, stopIn, ms]);

  /**
   * One reveal forward, whether the timer asked or a thumb did.
   *
   * Unlike a crossfade sequence there is nothing to fade out first — the next
   * paragraph simply arrives beneath the last — so a tap takes effect on the
   * frame it lands. The debounce is therefore the only thing standing between
   * a resting thumb and a skipped paragraph.
   */
  const advance = useCallback(() => {
    if (introEnabled !== true || morphing) return;
    const now = Date.now();
    if (now - lastAdvanceAt.current < INTRO_TIMINGS.TAP_DEBOUNCE) return;
    lastAdvanceAt.current = now;

    if (step >= FINAL_STEP) {
      if (measured) runMorph();
      return;
    }
    setStep((index) => index + 1);
  }, [introEnabled, morphing, step, measured, runMorph]);

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

    /*
     * Each line creeps across its screen, one reveal's worth at a time, taking
     * exactly as long as that reveal does.
     *
     * Linear, and stretched over the whole hold rather than over a short fade:
     * a segment finishes precisely as the next begins, so consecutive segments
     * read as one unbroken travel at a constant speed. Filling quickly and
     * then waiting — which is what a short eased timing does — is what made it
     * lurch.
     *
     * A tap simply re-targets mid-segment. The bar keeps moving; it just
     * covers the remaining distance at a different rate.
     */
    animations.push(
      ...SLIDE_RANGES.map(({ first, count }, index) =>
        Animated.timing(slideProgress[index]!, {
          toValue: Math.max(0, Math.min(1, (step - first + 1) / count)),
          duration: holdMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    );

    const running = Animated.parallel(animations);
    running.start();

    const timer = setTimeout(() => {
      if (step >= FINAL_STEP) runMorph();
      else setStep((index) => index + 1);
    }, holdMs);

    return () => {
      clearTimeout(timer);
      running.stop();
    };
  }, [step, introEnabled, morphing, reveals, slideOut, slideProgress, ms, runMorph]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const introComplete = introEnabled === false || step === Infinity;

  const handlePostSignIn = useCallback(async () => {
    try {
      const profile = await fetchMyProfile();
      if (profile?.onboarding_completed_at) {
        resetToAuthenticatedRoot(router);
      } else {
        router.replace('/your-name');
      }
    } catch {
      // A profile read failure should never silently bypass onboarding.
      router.replace('/your-name');
    }
  }, [router]);

  useEffect(() => {
    // A restored session does not get to cut the intro off mid-sentence — but
    // it does get to redirect the moment the intro is over.
    if (!introComplete) return;
    if (!isRestoring && isSignedIn) {
      void handlePostSignIn();
    }
  }, [handlePostSignIn, isSignedIn, isRestoring, introComplete]);

  async function handleAppleSignIn() {
    setError(undefined);
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (!result.ok) {
        if (result.error.code !== 'cancelled') {
          setError(result.error.message);
        }
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

  // ── Render ────────────────────────────────────────────────────────────────

  const introRunning = introEnabled === true && step !== Infinity;
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
    <View style={S.screen}>
      {introRunning ? (
        <Animated.View
          style={[S.progress, { top: insets.top + spacing.md, opacity: chromeOut }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {slideProgress.map((fill, index) => (
            <View key={index} style={S.progressTrack}>
              <Animated.View style={[S.progressFill, { transform: [{ scaleX: fill }] }]} />
            </View>
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
            // Lines are numbered across the whole slide, not within a group —
            // the reveals are one sequence and the grouping is only layout.
            const offset = SLIDE_ONE_GROUPS.slice(0, groupIndex).reduce(
              (total, previous) => total + previous.length,
              0,
            );
            return (
              <View key={groupIndex} style={S.lineGroup}>
                {group.map((line, lineIndex) => (
                  <Animated.View key={lineIndex} style={{ opacity: reveals[offset + lineIndex] }}>
                    <AppText align="left" style={S.paragraph} accessibilityLiveRegion="polite">
                      {line}
                    </AppText>
                  </Animated.View>
                ))}
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
        The hint, across the two reading slides. Quieter than the poem: it is
        an affordance, not a line of it, and it goes once the statements start
        — by then the sequence is finishing itself.
      */}
      {slideOneMounted || slideTwoMounted ? (
        <Animated.View
          style={[
            S.hint,
            { bottom: insets.bottom + spacing.xl, opacity: reveals[0] },
          ]}
          pointerEvents="none"
        >
          <AppText variant="caption" align="center" style={S.hintText}>
            {CONTINUE_HINT}
          </AppText>
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
                  { translateX: morph.interpolate({ inputRange: [0, 1], outputRange: [0, travel.x] }) },
                  { translateY: morph.interpolate({ inputRange: [0, 1], outputRange: [0, travel.y] }) },
                  { scale: morph.interpolate({ inputRange: [0, 1], outputRange: [1, MARK_SCALE] }) },
                ],
              },
            ]}
          >
            {/* Measured here rather than inside `Wordmark`, so the rect is
                relative to the row the travel is computed against. */}
            <Animated.View onLayout={measureRow} style={{ opacity: reveals[SLIDE_THREE_START] }}>
              <Wordmark
                size={CLOSING_SIZE}
                lineHeight={CLOSING_LEADING}
                stopOpacity={stopIn}
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
      {showIntro && !introEnabled && controlsTop !== null ? (
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
            <Wordmark
              size={MARK_SIZE}
              lineHeight={Math.round(CLOSING_LEADING * MARK_SCALE)}
              stopOpacity={1}
              onStopWidth={setSettledStopWidth}
            />
          </View>
        </View>
      ) : null}

      {/*
        The login screen, revealed around the wordmark rather than replacing
        it. One opacity for the whole block: the controls arrive as a single
        composition, not as four separate entrances.
      */}
      <Animated.View
        style={[S.controls, { paddingBottom: insets.bottom + spacing.base, opacity: controlsIn }]}
        pointerEvents={introRunning ? 'none' : 'box-none'}
        // Fires whether or not the block is visible, so the wordmark knows
        // where to sit long before the controls fade in.
        onLayout={(event) => {
          const { y } = event.nativeEvent.layout;
          setControlsTop((current) => (current !== null && Math.abs(current - y) < 0.5 ? current : y));
        }}
      >
        {error ? (
          <View style={S.errorBanner}>
            <AppText variant="bodySmall" style={S.errorText}>
              {error}
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

          <EmailSignInButton
            onPress={() => router.push('/sign-in')}
            disabled={isAppleLoading || isGoogleLoading}
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
      {introRunning ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={advance}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityHint="Reveals the next line"
        />
      ) : null}
    </View>
  );
}

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

  paragraph: {
    fontFamily: fontFamilies.display,
    color: '#FFFFFF',
    textAlign: 'left',
    fontSize: PARAGRAPH_SIZE,
    lineHeight: PARAGRAPH_LEADING,
    letterSpacing: -0.3,
  },

  /** The three closing lines sit closer together than the paragraphs do. */
  /**
   * Lines within one paragraph, set tight.
   *
   * The slide's own `gap` separates the groups; this leaves none inside them,
   * so a paragraph reads as continuous text rather than as a stack of
   * separate statements that happen to be near each other.
   */
  lineGroup: { alignSelf: 'stretch', alignItems: 'flex-start' },

  /** The tap affordance: at the foot of the screen, and quieter than the poem. */
  hint: { position: 'absolute', left: layout.gutter, right: layout.gutter },
  hintText: { color: 'rgba(255, 255, 255, 0.38)', letterSpacing: 0.6 },

  /** The closing slide's one line, and the endings that take turns after it. */
  closingLine: {
    fontFamily: fontFamilies.display,
    color: '#FFFFFF',
    textAlign: 'left',
    fontSize: CLOSING_SIZE,
    lineHeight: CLOSING_LEADING,
    letterSpacing: -0.3,
  },
  /**
   * Hugs the wordmark, which is its only in-flow child — so the row's width is
   * the word's width and a longer ending cannot push it around.
   */
  finalRow: { flexDirection: 'row', alignSelf: 'flex-start' },

  progress: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    flexDirection: 'row',
    gap: 6,
  },

  progressTrack: {
    flex: 1,
    height: 1.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    transformOrigin: 'left center',
  },

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
