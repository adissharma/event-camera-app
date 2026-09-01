import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { publishDraft, PublicationError } from '@/services/publication';
import { setPublicationResult } from '@/features/celebrations/creation/publication-result';
import { celebrationKeys } from '@/services/celebrations';
import {
  CreatingOverlay,
  REVEAL_TIMINGS,
  useRevealSequence,
} from '@/features/celebrations/creation/pricing-reveal';
import {
  PREVIEW_CHALLENGES,
  hasShownPricingReveal,
  markPricingRevealShown,
  previewMediaFor,
} from '@/features/celebrations/creation/reveal-preview';
import { buildPreviewDetail } from '@/features/celebrations/creation/reveal-preview-detail';
// The event screen itself. Mounting the real component is the whole point:
// a preview assembled from the same tokens still drifts the moment that screen
// changes, and it did.
import {
  EventDetailView,
  formatEventHeroDate,
  galleryHeroHeight,
} from '@/app/celebration/[celebrationId]/index';
import {
  FREE_PAYWALL_PLAN,
  PAID_PAYWALL_PLANS,
  RECOMMENDED_PLAN_ID,
  getPaywallPlan,
  planAccessibilityLabel,
  planFeatureRows,
  planForCatalogueKey,
  planGuestSubtitle,
  planPriceLabel,
  type PaywallPlan,
  type PaywallPlanId,
} from '@/features/payments/plan-catalogue';
import { colours, layout, radii, spacing } from '@/design';

/**
 * The paywall hero is exactly as tall as the event screen's hero.
 *
 * Not approximately — `galleryHeroHeight` is that screen's own function, so
 * the cover cannot change size across the transition however that hero is
 * later retuned. This used to be a local 0.52 sitting beside the gallery's
 * 0.49 + 24pt bleed: five points apart on a large phone, and drifting on
 * every other size.
 */

/**
 * The least room the sheet can work in: three stacked rows, the free link,
 * the button, and the home indicator. Below this the layout would clip rather
 * than tighten, so on a short device the hero yields instead.
 */
const MIN_SHEET_HEIGHT = 396;

/** How far the sheet rides up over the photograph. */
const SHEET_OVERLAP = 26;

/** Left gutter for the hero column, shared by the title in both positions. */
const HERO_GUTTER = 22;

/**
 * REVIEW SWITCH — set to `false` before this ships.
 *
 * The reveal is a one-time celebration: `hasShownPricingReveal` normally
 * suppresses it on every visit after the first, which is the behaviour the
 * screen should ship with. While the animation is being tuned that makes it
 * almost impossible to look at twice, so this bypasses the check and replays
 * the whole sequence on every entry.
 *
 * It also brings the back control forward to the first frame, so a pass can be
 * cut short rather than waited out. Flipping this one constant restores both:
 * the reveal plays once per draft, and the back control fades in with the
 * pricing sheet.
 */
const REPLAY_REVEAL_ON_EVERY_VISIT = true;

const INK = '#0B0B0C';
const SHEET_BG = '#FBF9F6';
const CARD_BORDER = 'rgba(11, 11, 12, 0.10)';
const SUBTITLE_GREY = '#6E6862';
/** Warm and low-chroma on purpose — a tick, not a highlight. */
const GOLD = '#C9A227';
const CROSS_GREY = 'rgba(255, 255, 255, 0.34)';
const FEATURE_OFF_TEXT = 'rgba(255, 255, 255, 0.46)';

const FEATURE_FADE_MS = 190;

function TickIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 12.6l5 5L19.5 6.9"
        stroke={GOLD}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CrossIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={CROSS_GREY} strokeWidth={2.3} strokeLinecap="round" />
    </Svg>
  );
}

function BackChevronIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StarIcon({ size = 9 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * The entitlement list: staggered in once, then crossfaded whenever the
 * selected plan changes.
 *
 * Two different motions for two different events. The entrance is a stagger,
 * because the rows are arriving for the first time and arriving in order reads
 * as a list being written. A plan change is a crossfade of the whole block,
 * because the rows change wording, state and colour together, and five
 * separate transitions would read as a list reshuffling rather than as one
 * answer being replaced.
 *
 * The stagger is derived from a single driver rather than five timers, so it
 * cannot drift out of step with the title travel it overlaps.
 */
function HeroFeatures({
  plan,
  entrance,
}: {
  plan: PaywallPlan;
  entrance: Animated.Value;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(plan);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (shown.id === plan.id) return;

    Animated.timing(opacity, {
      toValue: 0,
      duration: FEATURE_FADE_MS / 2,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShown(plan);
      Animated.timing(opacity, {
        toValue: 1,
        duration: FEATURE_FADE_MS / 2,
        useNativeDriver: true,
      }).start();
    });
  }, [plan, shown.id, opacity]);

  const rows = planFeatureRows(shown);

  return (
    <Animated.View style={{ opacity, gap: 8 }}>
      {rows.map((row, index) => {
        // Each row's own window inside the single 0→1 sweep, derived from the
        // published step and fade rather than from a fraction picked by eye —
        // so changing either timing changes the sequence and nothing has to be
        // recalculated here. Row 0 opens immediately; row 4 closes exactly as
        // the driver lands.
        const step = REVEAL_TIMINGS.ENTITLEMENT_STAGGER_STEP;
        const fade = REVEAL_TIMINGS.ENTITLEMENT_FADE_DURATION;
        const total = fade + step * Math.max(rows.length - 1, 1);
        const start = (step * index) / total;
        const end = (step * index + fade) / total;
        return (
          <Animated.View
            key={row.key}
            style={[
              S.featureRow,
              {
                opacity: entrance.interpolate({
                  inputRange: [start, end],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            {row.included ? <TickIcon /> : <CrossIcon />}
            <AppText
              variant="labelLarge"
              style={[S.featureLabel, !row.included && { color: FEATURE_OFF_TEXT }]}
              numberOfLines={1}
            >
              {row.label}
            </AppText>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

export default function PackageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { height: screenHeight } = useWindowDimensions();
  const { draft, update } = useCreationDraft();

  const coverSource = useCoverSource(draft.coverLocalUri ?? draft.coverStoragePath);

  // Restores a selection made earlier in this creation flow — the draft
  // persists `planKey`, so returning to this step should not silently reset
  // the host's choice. Falls back to the recommended tier for a new session.
  const [selectedId, setSelectedId] = useState<PaywallPlanId>(
    () => planForCatalogueKey(draft.planKey)?.id ?? RECOMMENDED_PLAN_ID,
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [freeConfirmVisible, setFreeConfirmVisible] = useState(false);

  const selectedPlan =
    getPaywallPlan(selectedId) ?? PAID_PAYWALL_PLANS[PAID_PAYWALL_PLANS.length - 1]!;

  // The hero describes the selected plan, so a plan is only truly selected
  // once the draft agrees — this keeps `draft.planKey` the single source of
  // truth that `publishDraft` later reads.
  useEffect(() => {
    if (draft.planKey !== selectedPlan.catalogueKey) {
      update({ planKey: selectedPlan.catalogueKey });
    }
  }, [selectedPlan.catalogueKey, draft.planKey, update]);

  const heroHeight = useMemo(() => {
    const preferred = galleryHeroHeight(screenHeight);
    const ceiling = screenHeight - (MIN_SHEET_HEIGHT + insets.bottom);
    return Math.max(Math.min(preferred, ceiling), screenHeight * 0.42);
  }, [screenHeight, insets.bottom]);

  // ── The reveal ────────────────────────────────────────────────────────────

  // Decided once, on mount. Reading the flag during render would flip the
  // answer the moment the sequence marks itself shown, and the screen would
  // tear its own animation down halfway through.
  const [shouldReveal] = useState(
    () => REPLAY_REVEAL_ON_EVERY_VISIT || !hasShownPricingReveal(draft.createdAt),
  );

  /**
   * The one piece of real work the creating stage waits on.
   *
   * Worth being precise about what this stage is and is not. No event record
   * exists yet — `publishDraft` does not run until Continue — so "Creating
   * your event" is not narrating a server round trip. What it *is* waiting
   * for is the host's cover: `useCoverSource` may still be minting a signed
   * URL, and the bytes have to be in the image cache before the crossfade, or
   * the `ready` stage reveals an empty frame. That is genuine setup, and gating
   * it is what keeps the stage from being pure theatre.
   */
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const uri = typeof coverSource === 'object' && coverSource && 'uri' in coverSource
      ? coverSource.uri
      : null;

    // A bundled fallback (`require`, a number) is already in the binary; there
    // is nothing to fetch and the stage runs to its target duration instead.
    if (!uri) {
      setSetupComplete(true);
      return;
    }

    void Image.prefetch(uri)
      .catch(() => false)
      // A prefetch failure is not a reason to hold the host on a loading
      // screen. The <Image> will retry on mount, and `useCoverSource` falls
      // back to the placeholder rather than rendering nothing.
      .finally(() => {
        if (!cancelled) setSetupComplete(true);
      });

    return () => {
      cancelled = true;
    };
  }, [coverSource]);

  const reveal = useRevealSequence({
    enabled: shouldReveal,
    setupComplete,
    onComplete: useCallback(() => markPricingRevealShown(draft.createdAt), [draft.createdAt]),
  });

  const { stage, isInteractive } = reveal;
  const settled = !shouldReveal;

  // Every layer's driver. Initialised at their end state when the reveal is
  // being skipped, so a repeat visit renders the finished paywall on its first
  // frame rather than animating to it.
  /**
   * The real event page fading up out of the creation state.
   *
   * Runs 0 → 1 once and never comes back down. This is the cover's only
   * animation in the entire sequence.
   */
  const pageIn = useRef(new Animated.Value(settled ? 1 : 0)).current;
  /**
   * The panel over everything below the hero: down for the preview, back up
   * for the transition into pricing.
   */
  const lowerMaskIn = useRef(new Animated.Value(1)).current;
  /**
   * The cover's gradient direction. Split from `toPaywall` — which still
   * drives the title's travel — precisely so the two can be sequenced apart:
   * the title moves during the transition, the gradient turns afterwards.
   */
  const gradientSwap = useRef(new Animated.Value(settled ? 1 : 0)).current;
  /** The challenge strip's horizontal nudge, during the preview stage. */
  const chipNudge = useRef(new Animated.Value(0)).current;
  /** The paywall's own title, which takes over from the event page's. */
  const titleIn = useRef(new Animated.Value(settled ? 1 : 0)).current;
  const toPaywall = useRef(new Animated.Value(settled ? 1 : 0)).current;
  const galleryOut = useRef(new Animated.Value(settled ? 1 : 0)).current;
  const featuresIn = useRef(new Animated.Value(settled ? 1 : 0)).current;
  const panelIn = useRef(new Animated.Value(settled ? 1 : 0)).current;

  /**
   * The travelling block's own height, so it can be centred rather than
   * top-anchored. Measured because it is not knowable in advance: the title
   * wraps to one, two or three lines depending on the event's name.
   */
  const [identityHeight, setIdentityHeight] = useState(0);

  /**
   * Where the block ends up: centred in the cover, not pinned under the back
   * control.
   *
   * Date, title and the five entitlement rows are one block, and it is
   * balanced in the space between the back control and the top of the pricing
   * sheet. Top-anchoring it left the whole lower half of the photograph empty
   * — the composition read as content that had run out rather than content
   * that had been placed.
   *
   * Falls back to the top anchor until the block has been measured, which is
   * only ever the first frame or two and always while it is still invisible.
   */
  // The field the block is centred in: from the underside of the back control
  // to the top of the pricing sheet. Stated as the real bounds rather than as
  // bounds already inset for breathing room, so that the clamp below is the
  // only thing expressing a minimum and the centre is not quietly a function
  // of padding.
  const identityFieldTop = insets.top + 6 + 38;
  const identityFieldBottom = heroHeight - SHEET_OVERLAP;
  /** The block never rides up under the back control, however tall it gets. */
  const identityTopLimit = identityFieldTop + spacing.sm;
  const paywallTitleTop = identityHeight
    ? Math.max(
        identityTopLimit,
        identityFieldTop + (identityFieldBottom - identityFieldTop - identityHeight) / 2,
      )
    : identityTopLimit;

  /**
   * Where the event page actually draws its title, in window coordinates.
   *
   * Reported by the event screen itself rather than recomputed here. That is
   * what makes the travel survive a redesign of the hero: move the title on
   * that screen and this animation starts from its new home, with nothing to
   * update. Before this the reveal held its own copy of the hero's geometry —
   * stat-strip height, title margin, gutter — and every one of them was a
   * chance to disagree.
   */
  const [galleryTitleRect, setGalleryTitleRect] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);

  // Until the event page has been laid out — and on a repeat visit, where it
  // is never mounted — the title simply starts where it will finish, so the
  // transition degrades to a fade rather than to a jump.
  const titleLeft = galleryTitleRect?.x ?? HERO_GUTTER;
  const titleWidth = galleryTitleRect?.width ?? undefined;

  /**
   * The travel, as a distance rather than as two layouts.
   *
   * The title is one text node that moves. It is never faded out in one
   * position and faded back in at another — that would be two titles, and the
   * continuity between the event page and the paywall is the whole idea of the
   * sequence. It is also why the box keeps one width and one type size across
   * both positions: any change to either would re-wrap the line mid-flight,
   * and a shared element that reflows is not shared.
   *
   * Under reduce-motion the element does not travel at all: it starts where it
   * will end, and the preview simply composes around a title that is already
   * at the top of the cover. Shortening the movement rather than removing it
   * would still be movement, and this is the one element on the screen whose
   * entire purpose is to move.
   */
  const galleryTitleTop = galleryTitleRect?.y ?? paywallTitleTop;
  const titleStartTop = reveal.reduceMotion ? paywallTitleTop : galleryTitleTop;
  const titleTravel = reveal.reduceMotion ? 0 : paywallTitleTop - galleryTitleTop;

  useEffect(() => {
    if (!shouldReveal) return;

    const timing = (value: Animated.Value, toValue: number, duration: number, delay = 0) =>
      Animated.timing(value, {
        toValue,
        duration: reveal.ms(duration),
        delay: reveal.ms(delay),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    if (stage === 'ready') {
      // The event page arrives whole, but masked below the hero — so what the
      // host sees is their cover and their title, which is the beat this stage
      // is for. The mask lifts at `preview`.
      timing(pageIn, 1, REVEAL_TIMINGS.READY_REVEAL_DURATION).start();
      return;
    }

    if (stage === 'preview') {
      const content = timing(lowerMaskIn, 0, REVEAL_TIMINGS.PREVIEW_REVEAL_DURATION);

      // Under reduce-motion the strip stays put. A repeating horizontal
      // translation is precisely the pattern that triggers people, and this
      // one is decoration — the strip is still there and still scrollable
      // without it.
      if (reveal.reduceMotion) {
        content.start();
        return;
      }

      // Once the gallery has finished assembling, the strip slides and comes
      // back to show it carries more than fits. Sequenced off the same clock
      // as everything else, so it is over before the fade-out begins rather
      // than being interrupted by it.
      Animated.parallel([
        content,
        Animated.sequence([
          Animated.delay(
            reveal.ms(REVEAL_TIMINGS.PREVIEW_REVEAL_DURATION + REVEAL_TIMINGS.CHIP_NUDGE_DELAY),
          ),
          ...REVEAL_TIMINGS.CHIP_NUDGE_STEPS.map(([fraction, duration]) =>
            Animated.timing(chipNudge, {
              toValue: REVEAL_TIMINGS.CHIP_NUDGE_TRAVEL * fraction,
              duration: reveal.ms(duration),
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true,
            }),
          ),
        ]),
      ]).start();
      return;
    }

    if (stage === 'transitioningToPaywall') {
      const T = REVEAL_TIMINGS;
      // Phase three's start, referenced by all three of its members so they
      // cannot drift apart into separate movements.
      const coordinated = T.COORDINATED_PHASE_START;

      Animated.parallel([
        // ── Phase one: the gallery leaves ─────────────────────────────────
        //
        // Stats strip, guestbook, challenges and grid, as one coordinated
        // fade of the whole layer rather than a component-by-component exit.
        // The title, the date and the gradient stay exactly as the gallery
        // had them while this runs — nothing else has started yet.
        timing(galleryOut, 1, T.GALLERY_FADE_OUT_DURATION),
        timing(lowerMaskIn, 1, T.GALLERY_FADE_OUT_DURATION),
        // The paywall's title fades up on the same curve, in the same place,
        // as the event page's fades out — two nodes briefly superimposed at
        // identical coordinates, which is what lets one hand off to the other
        // without a visible swap. It does not move yet.
        timing(titleIn, 1, T.GALLERY_FADE_OUT_DURATION),

        // ── Phase two: the card arrives ───────────────────────────────────
        //
        // Starts while the gallery is still going, so the screen is never
        // empty and the card reads as replacing that content rather than as
        // following it.
        timing(panelIn, 1, T.PANEL_RISE_DURATION, T.PANEL_RISE_START),

        // ── Phase three: title, gradient and points, together ─────────────
        //
        // Fired at one shared offset while the card is a little under half
        // in. These three are the transition's single gesture; splitting them
        // across the card's completion is what made it read as a series of
        // steps with pauses between.
        Animated.timing(toPaywall, {
          toValue: 1,
          duration: reveal.ms(T.TITLE_TRAVEL_DURATION),
          delay: reveal.ms(coordinated),
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(gradientSwap, {
          toValue: 1,
          duration: reveal.ms(T.GRADIENT_SWAP_DURATION),
          delay: reveal.ms(coordinated),
          // Eased both ends: barely moves through its first third, by which
          // point the card is opaque over the foot of the cover. That is what
          // lets it begin here rather than after the card lands, without the
          // hard bottom edge the earlier ordering exposed.
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // Linear, unlike everything else here. The rows' windows are carved
        // out of this driver as equal slices, so an eased driver would bunch
        // the first rows together and stretch the last — the opposite of the
        // even, unhurried sequence the stagger is for. Each row's own fade is
        // what carries the softness.
        Animated.timing(featuresIn, {
          toValue: 1,
          duration: reveal.ms(
            T.ENTITLEMENT_FADE_DURATION + T.ENTITLEMENT_STAGGER_STEP * 4,
          ),
          delay: reveal.ms(coordinated + T.ENTITLEMENT_START_OFFSET),
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    stage,
    shouldReveal,
    reveal,
    pageIn,
    titleIn,
    gradientSwap,
    chipNudge,
    lowerMaskIn,
    toPaywall,
    galleryOut,
    featuresIn,
    panelIn,
  ]);

  /**
   * What the event page hands the reveal control of.
   *
   * Note what is *not* here: the cover. The page's opacity is `pageIn`, which
   * only ever runs 0 → 1 at `ready` and then stays there — so once the
   * photograph is on screen it is never faded, moved, scaled or recropped
   * again. Everything that changes on the way to the paywall changes *around*
   * it: the vertical scrim gives way to the horizontal one, and the chrome
   * leaves so the purchase copy can take its place.
   */
  const previewOverlays = useMemo(
    () => ({
      scrimOpacity: gradientSwap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      chromeOpacity: galleryOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    }),
    [gradientSwap, galleryOut],
  );

  const previewDetail = useMemo(() => buildPreviewDetail(draft), [draft]);
  const previewPhotos = useMemo(
    () => previewMediaFor(draft.celebrationType),
    [draft.celebrationType],
  );
  const previewConfig = useMemo(
    () => ({
      photos: previewPhotos,
      challenges: PREVIEW_CHALLENGES.map((challenge) => ({ ...challenge })),
      overlays: previewOverlays,
      chipStripNudge: chipNudge,
      onHeroIdentityLayout: ({ x, y, width }: { x: number; y: number; width: number }) =>
        setGalleryTitleRect((current) =>
          current && current.x === x && current.y === y && current.width === width
            ? current
            : { x, y, width },
        ),
    }),
    [previewPhotos, previewOverlays, chipNudge],
  );

  /**
   * Held still across re-renders so that tapping a plan — which updates the
   * draft, and therefore `previewDetail` — does not reconcile the event page
   * behind the paywall on every tap.
   */
  const previewElement = useMemo(
    () => (
      <EventDetailView
        detail={previewDetail}
        previewMode={previewConfig}
        onArchive={() => {}}
        archiving={false}
      />
    ),
    [previewDetail, previewConfig],
  );

  // The event hero's own formatter, not a second `Intl.DateTimeFormat`
  // configured from memory here. Two copies is how "19 September 2026"
  // quietly becomes "Sept 19, 2026" halfway through the animation.
  const eventDate = useMemo(
    () => formatEventHeroDate(previewDetail.celebration.ends_at, previewDetail.celebration.timezone),
    [previewDetail],
  );

  const eventTitle = draft.title.trim() || 'Your event';

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectPlan = useCallback(
    (id: PaywallPlanId) => {
      if (!isInteractive) return;
      setSelectedId(id);
      void Haptics.selectionAsync().catch(() => {});
    },
    [isInteractive],
  );

  const publish = useCallback(
    async (plan: PaywallPlan) => {
      if (isPublishing) return;
      setIsPublishing(true);
      setPublishError(null);
      try {
        // The purchase itself lives in `publishDraft`, which walks the
        // existing draft → cover → purchase → publish sequence. The free tier
        // is skipped at the purchase stage by `isFreePlanKey`, so this call is
        // identical either way and there is no second payment path here.
        const result = await publishDraft({ ...draft, planKey: plan.catalogueKey, addOnKeys: [] });
        setPublicationResult(result);
        await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
        router.replace('/create/success');
      } catch (error) {
        const stage = error instanceof PublicationError ? error.stage : null;
        setPublishError(
          stage === 'purchase'
            ? 'That payment did not go through. Nothing has been charged.'
            : stage === 'publish'
              ? 'Your event was saved but could not be published. Try again.'
              : 'We could not create your event. Check your connection and try again.',
        );
      } finally {
        setIsPublishing(false);
      }
    },
    [draft, isPublishing, queryClient, router],
  );

  const chooseFree = useCallback(() => {
    if (!isInteractive) return;
    void Haptics.selectionAsync().catch(() => {});
    setFreeConfirmVisible(true);
  }, [isInteractive]);

  const continueWithFree = useCallback(() => {
    setFreeConfirmVisible(false);
    setSelectedId(FREE_PAYWALL_PLAN.id);
    void Haptics.selectionAsync().catch(() => {});
    void publish(FREE_PAYWALL_PLAN);
  }, [publish]);

  const upgradeToUnlimited = useCallback(() => {
    setFreeConfirmVisible(false);
    setSelectedId(RECOMMENDED_PLAN_ID);
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const locked = !isInteractive || isPublishing;

  return (
    <View style={S.screen}>
      {/*
        The event page itself — the real component, with the real layout,
        rendering the host's real draft.

        Not a reconstruction of it. Spacing, typography, the stat strip, the
        tilted challenge chips, the tab bar, the 4:5 grid and the cover
        treatment are all whatever that screen currently says they are, so a
        change made there shows up here with nothing to keep in step.

        Mounted for the life of this screen, including on a repeat visit where
        the reveal is skipped entirely — because this is where the paywall's
        cover photograph comes from too. There is no second copy of it
        anywhere. That is what keeps the image *completely* still: nothing can
        drift against it when there is nothing else to drift.
      */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: pageIn }]} pointerEvents="none">
        {previewElement}
      </Animated.View>

      {/*
        Covers the page below the hero.

        Up before the preview (so `ready` shows the cover and the event's name
        alone) and up again through the transition (so the grid and chips are
        gone before the pricing sheet slides over where they were). One opaque
        panel in the page's own background colour, rather than fading a dozen
        components separately — and, importantly, rather than fading the page
        itself, which would take the photograph with it.
      */}
      <Animated.View
        pointerEvents="none"
        style={[S.lowerMask, { top: heroHeight, opacity: lowerMaskIn }]}
      />

      {/*
        The paywall's gradient, and nothing else.

        There is exactly one cover image in this whole sequence — the event
        page's, mounted above and never touched. This layer used to hold a
        second copy of it, crossfading in under a scale and a horizontal
        nudge, which is what made the photograph appear to fade, drift and
        recrop midway through: two images of the same scene, at slightly
        different sizes, dissolving into one another.

        What is left is the treatment. The event page's vertical ramp fades
        out (driven through `previewMode.overlays`) exactly as this horizontal
        one fades in, over the same still photograph. Two static gradient
        layers under opposing opacities, rather than one gradient whose stops
        are interpolated: colour arrays have to be rebuilt on the JS thread
        every frame, opacities do not.
      */}
      <Animated.View
        style={[S.coverLayer, { height: heroHeight, opacity: gradientSwap }]}
        pointerEvents="none"
      >
        {/*
          The photograph is the host's, so its contents are unknowable — a
          bright sky behind white type is as likely as a dark room.

          The ramp is deliberately long and many-stopped. A short one with a
          steep middle reads as a panel laid over the image, with a visible
          seam where it ends; spreading the same darkness across the full
          width in small steps keeps it reading as light falling off. The left
          stays dark enough to carry the title, and no stop sits far enough
          from its neighbour to show a boundary.
        */}
        <LinearGradient
          colors={[
            'rgba(8, 8, 9, 0.93)',
            'rgba(8, 8, 9, 0.90)',
            'rgba(8, 8, 9, 0.83)',
            'rgba(8, 8, 9, 0.72)',
            'rgba(8, 8, 9, 0.58)',
            'rgba(8, 8, 9, 0.42)',
            'rgba(8, 8, 9, 0.27)',
            'rgba(8, 8, 9, 0.15)',
            'rgba(8, 8, 9, 0.07)',
          ]}
          locations={[0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.86, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {/*
          A vertical wash into the sheet's own edge. Without it the photograph
          stops dead at the rounded corners; letting the bottom fall away makes
          the sheet appear to sit on the image rather than cut it off.
        */}
        <LinearGradient
          colors={['rgba(8, 8, 9, 0)', 'rgba(8, 8, 9, 0.5)']}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0.62 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* A little overall weight, so white type holds on a pale image. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8, 8, 9, 0.16)' }]} />
      </Animated.View>

      {/* Reserves the hero's height in the flow so the sheet lands under it. */}
      <View style={{ height: heroHeight }} pointerEvents="none" />

      <Animated.View
        style={[
          S.sheet,
          {
            marginTop: -SHEET_OVERLAP,
            paddingBottom: Math.max(insets.bottom, 12) + 6,
            opacity: panelIn,
            transform: [
              {
                translateY: panelIn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [reveal.reduceMotion ? 0 : REVEAL_TIMINGS.PANEL_RISE_DISTANCE, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={isInteractive ? 'auto' : 'none'}
      >
        {/*
          Stacked rather than in a row. Three narrow columns forced the name,
          the capacity and the price into a vertical stack inside each card,
          which is three separate things to read per plan; laid out full width
          those same three sit on one line, and comparing plans becomes reading
          straight down a single column of prices.
        */}
        <View style={S.cardsColumn}>
          {PAID_PAYWALL_PLANS.map((plan) => {
            const selected = plan.id === selectedId;
            return (
              <Pressable
                key={plan.id}
                onPress={() => selectPlan(plan.id)}
                disabled={locked}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: locked }}
                accessibilityLabel={planAccessibilityLabel(plan)}
                style={[
                  S.card,
                  selected ? S.cardSelected : S.cardIdle,
                  // Room for the badge, which overhangs this card's top edge
                  // and would otherwise sit on the card above it.
                  plan.isRecommended && { marginTop: 8 },
                ]}
              >
                {/*
                  Stays on Stories+ whichever plan is selected — it marks the
                  recommendation, not the selection. The two are told apart by
                  the border and the filled radio, which follow the tap.
                */}
                {plan.isRecommended && (
                  <View style={S.badge} pointerEvents="none">
                    <StarIcon />
                    <AppText variant="eyebrow" style={S.badgeText}>
                      Most popular
                    </AppText>
                  </View>
                )}

                <View style={[S.radio, selected && S.radioSelected]}>
                  {selected && <View style={S.radioDot} />}
                </View>

                <View style={S.cardCopy}>
                  <AppText variant="heading" style={S.cardName} numberOfLines={1}>
                    {plan.displayName}
                  </AppText>
                  <AppText variant="bodySmall" style={S.cardSubtitle} numberOfLines={1}>
                    {planGuestSubtitle(plan)}
                  </AppText>
                </View>

                {/*
                  `numericLarge` is the system's own "price on a plan" role —
                  the serif's old-style figures, set tabular so the three
                  prices align down the column.
                */}
                <AppText variant="numericLarge" style={S.cardPrice} numberOfLines={1}>
                  {planPriceLabel(plan)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={chooseFree}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={`Try for free with ${FREE_PAYWALL_PLAN.guestLimit} guests`}
          // Reads as a link but needs a real target: the row is short text, so
          // the tappable area is padded out rather than left at the glyph.
          hitSlop={10}
          style={S.freeCta}
        >
          <AppText variant="labelLarge" style={S.freeCtaText}>
            Try for free with {FREE_PAYWALL_PLAN.guestLimit} guests
          </AppText>
        </Pressable>

        {publishError && (
          <AppText variant="bodySmall" tone="error" align="center" style={S.errorText}>
            {publishError}
          </AppText>
        )}

        <Pressable
          onPress={() => void publish(selectedPlan)}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: locked }}
          style={({ pressed }) => [S.continueButton, pressed && !locked && { opacity: 0.86 }]}
        >
          {isPublishing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AppText variant="button" style={S.continueLabel}>
              Continue
            </AppText>
          )}
        </Pressable>
      </Animated.View>

      {/*
        The paywall's hero copy: the event's own title, and nothing else above
        it. No marketing line, no subtitle. The host has just named this thing;
        putting a slogan where its name should be would break the one thread
        running through the whole sequence.

        This is a second node rendering the same string as the event page's
        title, and deliberately so. The alternative — animating the real
        screen's title out of its own hero — means reaching into that component
        to move a child of its layout, which is exactly the coupling this
        change was made to remove. Instead the two are superimposed at the
        measured rect and crossfaded on one curve, so the handoff is invisible,
        and this one then travels alone.
      */}
      <Animated.View
        style={[
          S.identityLayer,
          {
            left: titleLeft,
            width: titleWidth,
            top: titleStartTop,
            opacity: titleIn,
            transform: [
              {
                translateY: toPaywall.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, titleTravel],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          setIdentityHeight((current) => (Math.abs(current - height) < 1 ? current : height));
        }}
      >
        {/*
          Date and title travel as one block, in the event page's own order,
          typography and 4pt rhythm — the same grouping that screen wraps them
          in. The date is not decoration that gets dropped on the way: it is
          half of what identifies the event, and arriving at the purchase
          screen it still says when the event is.
        */}
        {eventDate ? (
          <AppText variant="eyebrow" tone="secondary" align="left">
            {eventDate}
          </AppText>
        ) : null}

        <AppText variant="displayHero" align="left" style={S.heroTitle} numberOfLines={3}>
          {eventTitle}
        </AppText>

        <Animated.View style={{ opacity: featuresIn, marginTop: spacing.base }}>
          <HeroFeatures plan={selectedPlan} entrance={featuresIn} />
        </Animated.View>
      </Animated.View>

      {shouldReveal && <CreatingOverlay visible={stage === 'creating'} />}

      {/*
        Back rather than close, and on the left, because this is a step in the
        creation flow: the thing behind it is the treatment step, not the
        screen the host came from. It matches the chevron every other creation
        step puts in the same corner.

        It normally arrives with the paywall. Leaving before then would be
        harmless — no event exists until Continue is tapped, so there is no
        partial state to strand — but a dismiss control on a two-second
        loading screen invites a tap that cancels a celebration mid-sentence.
        While the reveal is under review it is available from the first frame
        instead, so a pass can be abandoned without sitting through it.
      */}
      <Animated.View
        style={[
          S.backRow,
          { top: insets.top + 6, opacity: REPLAY_REVEAL_ON_EVERY_VISIT ? 1 : panelIn },
        ]}
        pointerEvents={isInteractive || REPLAY_REVEAL_ON_EVERY_VISIT ? 'box-none' : 'none'}
      >
        <Pressable
          onPress={() => router.back()}
          style={S.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <BackChevronIcon />
        </Pressable>
      </Animated.View>

      <Modal
        visible={freeConfirmVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setFreeConfirmVisible(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setFreeConfirmVisible(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[S.confirmSheet, { paddingBottom: Math.max(insets.bottom - spacing.md, spacing.sm) }]}
          >
            <View style={S.sheetHandle} />
            <View style={S.confirmCopy}>
              <AppText variant="titleLarge" style={S.confirmTitle}>
                Keep it small, or unlock the full experience?
              </AppText>
              <AppText variant="bodySmall" tone="secondary" style={S.confirmSubtitle}>
                The free option does not include videos, challenges, or guestbook.
              </AppText>
            </View>

            <Pressable
              onPress={upgradeToUnlimited}
              disabled={isPublishing}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Stories+"
              accessibilityState={{ disabled: isPublishing }}
              style={({ pressed }) => [
                S.continueButton,
                pressed && !isPublishing && { opacity: 0.86 },
              ]}
            >
              <AppText variant="button" style={S.continueLabel}>
                Upgrade to Stories+
              </AppText>
            </Pressable>
            <Pressable
              onPress={continueWithFree}
              disabled={isPublishing}
              accessibilityRole="button"
              accessibilityLabel="Continue with 5 guests"
              accessibilityState={{ disabled: isPublishing, busy: isPublishing }}
              hitSlop={10}
              style={({ pressed }) => [S.confirmSecondary, pressed && !isPublishing && { opacity: 0.7 }]}
            >
              {isPublishing ? (
                <ActivityIndicator color={SUBTITLE_GREY} />
              ) : (
                <AppText variant="bodySmall" tone="secondary" style={S.confirmSecondaryText}>
                  Continue with 5 guests
                </AppText>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: INK },

  coverLayer: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },

  identityLayer: {
    position: 'absolute',
    alignItems: 'flex-start',
    gap: 4,
  },
  /** Covers the page below the hero until the preview stage lifts it. */
  lowerMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colours.background,
  },
  heroTitle: {
    color: '#FFFFFF',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureLabel: { color: '#FFFFFF', flexShrink: 1 },

  backRow: {
    position: 'absolute',
    left: HERO_GUTTER,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20, 20, 22, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheet: {
    flex: 1,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  // Takes the sheet's spare height rather than leaving it stranded under the
  // button, capped so the rows gain presence without becoming panels.
  cardsColumn: { gap: 10, flexGrow: 1, flexShrink: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 68,
    maxHeight: 104,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  cardIdle: { borderColor: CARD_BORDER },
  cardSelected: { borderColor: INK },

  badge: {
    position: 'absolute',
    top: -10,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: INK,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    zIndex: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, letterSpacing: 1 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(11, 11, 12, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: INK },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: INK },

  cardCopy: { flex: 1, gap: 1 },
  cardName: { color: INK },
  cardSubtitle: { color: SUBTITLE_GREY },
  cardPrice: { color: INK, fontSize: 26, lineHeight: 31 },

  freeCta: {
    alignSelf: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  freeCtaText: { color: INK, textDecorationLine: 'underline' },

  errorText: { marginBottom: 8 },

  continueButton: {
    backgroundColor: INK,
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: { color: '#FFFFFF' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,5,6,0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  confirmSheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(11, 11, 12, 0.22)',
    alignSelf: 'center',
  },
  confirmCopy: { gap: spacing.sm },
  confirmTitle: { color: INK },
  confirmSubtitle: { color: SUBTITLE_GREY },
  confirmSecondary: {
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  confirmSecondaryText: { color: SUBTITLE_GREY, textDecorationLine: 'underline' },
});
