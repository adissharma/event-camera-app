import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { CelebrationIcon, ClockIcon, ImageIcon } from '@/components/ui/icons';
import { useMotion } from '@/design/use-motion';
import { colours, fontFamilies, layout, radii, spacing } from '@/design';

export interface EventRevealModalProps {
  visible: boolean;
  /** Which of the two moments this is. */
  state: 'awaiting_reveal' | 'revealed';
  eventName: string;
  /** Total captured. The counter animates from zero to this. */
  photoCount: number;
  /** Countdown copy for the awaiting state, e.g. "2h 14m". */
  countdownLabel: string;
  /** Thumbnails to scatter. Four to eight; anything beyond eight is ignored. */
  thumbnails: ImageSourcePropType[];
  /** True while the post-countdown server confirmation is in flight. */
  confirming?: boolean;
  onDismiss: () => void;
  /** Revealed state only — dismiss and open the gallery. */
  onViewPhotos: () => void;
}

/** How long the counter takes to reach its total. */
const COUNT_DURATION_MS = 1800;

/** Ticks during the count. Enough to feel mechanical, few enough not to buzz. */
const HAPTIC_TICKS = 12;

/**
 * Where the thumbnails sit, as fractions of the screen. The centre column stays
 * clear for the type.
 *
 * Ordered so that any prefix is balanced, not so that it reads down the page.
 * An event with four photographs takes the first four slots, and those four
 * need to be the corners — taking them in visual order piles every thumbnail
 * into the top half and leaves the bottom bare.
 */
const SLOTS = [
  { x: 0.15, y: 0.11, size: 96, rotation: -13 },
  // The bottom pair sits below the message line, not beside it. Blurred they
  // read as texture, but once they sharpen they turn the supporting copy
  // illegible — the one line on the screen that has to be readable.
  { x: 0.86, y: 0.83, size: 92, rotation: -11 },
  { x: 0.85, y: 0.17, size: 84, rotation: 11 },
  { x: 0.14, y: 0.82, size: 80, rotation: 10 },
  { x: 0.13, y: 0.34, size: 104, rotation: 7 },
  { x: 0.88, y: 0.55, size: 100, rotation: 12 },
  { x: 0.89, y: 0.37, size: 92, rotation: -8 },
  { x: 0.14, y: 0.57, size: 88, rotation: -6 },
] as const;

/**
 * The end of the event, as a moment rather than a state change.
 *
 * Two faces of one screen. Before the reveal it withholds — the count is real,
 * the photographs behind it are not legible — and after the reveal it opens.
 * Keeping them as one component is deliberate: the transition between them
 * happens live, under the viewer, and a component swap would throw away the
 * counter and the thumbnails mid-animation.
 */
export function EventRevealModal({
  visible,
  state,
  eventName,
  photoCount,
  countdownLabel,
  thumbnails,
  confirming = false,
  onDismiss,
  onViewPhotos,
}: EventRevealModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotion();

  const revealed = state === 'revealed';
  const slots = useMemo(() => SLOTS.slice(0, Math.min(thumbnails.length, SLOTS.length)), [thumbnails.length]);

  // ── The count ─────────────────────────────────────────────────────

  const progress = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = useState(0);

  // The animation plays once per appearance, never on a re-render and never
  // again when the state flips from awaiting to revealed — the viewer has
  // already watched the number climb and does not need it reset.
  const hasPlayed = useRef(false);
  const driftLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      hasPlayed.current = false;
      progress.setValue(0);
      setDisplayCount(0);
      return;
    }

    if (hasPlayed.current) return;
    hasPlayed.current = true;

    if (motion.reduceMotion || photoCount <= 0) {
      // Reduce motion keeps the outcome and drops the journey. The success
      // haptic stays: it is feedback, not movement.
      progress.setValue(1);
      setDisplayCount(photoCount);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }

    let lastShown = -1;
    let ticksFired = 0;

    const listener = progress.addListener(({ value }) => {
      const current = Math.round(value * photoCount);
      if (current !== lastShown) {
        lastShown = current;
        setDisplayCount(current);
      }

      // Evenly spaced through the climb, capped so a 2000-photo event does not
      // vibrate two thousand times.
      const dueTicks = Math.floor(value * HAPTIC_TICKS);
      if (dueTicks > ticksFired && dueTicks < HAPTIC_TICKS) {
        ticksFired = dueTicks;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });

    Animated.timing(progress, {
      toValue: 1,
      duration: COUNT_DURATION_MS,
      // Decelerating, so the last few numbers land rather than stopping dead.
      easing: Easing.out(Easing.cubic),
      // Read on the JS thread to drive the counter, so this cannot go native.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setDisplayCount(photoCount);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

    return () => progress.removeListener(listener);
  }, [visible, photoCount, motion.reduceMotion, progress]);

  // ── The live transition ───────────────────────────────────────────

  // One success haptic when the photos unlock under an open modal. Skipped on
  // first mount, or the reveal state would double-buzz with the count's finish.
  const wasRevealed = useRef(revealed);
  useEffect(() => {
    if (!visible) {
      wasRevealed.current = revealed;
      return;
    }
    if (!wasRevealed.current && revealed) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasRevealed.current = revealed;
  }, [revealed, visible]);

  // Unblurring is a change of substance, so it crossfades rather than cutting.
  const clarity = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(clarity, {
      toValue: revealed ? 1 : 0,
      duration: motion.duration('emotional'),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealed, clarity, motion]);

  // ── Continuous drift animation ────────────────────────────────────

  // Smooth, continuous looping drift for the bouncing photos.
  // Using Animated.loop ensures a seamless cycle with no janky restart.
  useEffect(() => {
    if (motion.reduceMotion) return;

    const driftAnimation = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 20000, // 20-second loop
        easing: Easing.linear,
        useNativeDriver: false, // Interpolation requires JS thread
      }),
    );

    driftAnimation.start();

    return () => {
      driftAnimation.stop();
      drift.setValue(0);
    };
  }, [motion.reduceMotion, drift]);

  const label = revealed ? 'The moments are in' : 'Event complete';
  const message = revealed
    ? 'Your photos are ready for you to see.'
    : confirming
      ? 'Unlocking your photos…'
      : `Photos reveal in ${countdownLabel}`;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onDismiss}
      presentationStyle="fullScreen"
    >
      <View style={S.root}>
        {/* ── Scattered thumbnails ──────────────────────────────── */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {slots.map((slot, index) => (
            <Thumbnail
              key={index}
              source={thumbnails[index]}
              slot={slot}
              screen={{ width, height }}
              progress={progress}
              clarity={clarity}
              drift={drift}
              index={index}
              // Each arrives as the counter passes its share of the climb.
              threshold={(index + 0.5) / slots.length}
              reduceMotion={motion.reduceMotion}
            />
          ))}
        </View>

        {/* ── Close ─────────────────────────────────────────────── */}
        <View style={[S.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={({ pressed }) => [S.closeButton, pressed && S.pressed]}
          >
            <CloseGlyph />
          </Pressable>
        </View>

        {/* ── The announcement ──────────────────────────────────── */}
        <View style={S.centre} pointerEvents="box-none">
          <View style={S.badge}>
            {revealed ? (
              <CelebrationIcon size={30} color={colours.accentWarm} />
            ) : (
              <ClockIcon size={26} color={colours.accentWarm} />
            )}
          </View>

          <AppText variant="eyebrow" align="center" style={S.eyebrowGold}>
            {label}
          </AppText>

          <AppText
            variant="displayLarge"
            align="center"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={S.title}
          >
            {eventName}
          </AppText>

          <AppText
            align="center"
            style={S.count}
            accessibilityLabel={`${photoCount} moments captured`}
          >
            {displayCount}
          </AppText>

          <AppText variant="eyebrow" align="center" style={S.eyebrowGold}>
            Moments captured
          </AppText>

          <View style={S.rule} />

          <AppText variant="body" align="center" tone="secondary" style={S.message}>
            {message}
          </AppText>
        </View>

        {/* ── Action ────────────────────────────────────────────── */}
        <View style={[S.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Pressable
            onPress={revealed ? onViewPhotos : onDismiss}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'View photos' : 'Back to event'}
            style={({ pressed }) => [S.cta, pressed && S.pressed]}
          >
            {revealed ? (
              <ImageIcon size={20} color={colours.textOnBrand} />
            ) : (
              <BackGlyph />
            )}
            <AppText variant="labelLarge" style={S.ctaLabel}>
              {revealed ? 'View Photos' : 'Back to event'}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────
   Thumbnail
   ──────────────────────────────────────────────────────────────── */

interface ThumbnailProps {
  source: ImageSourcePropType;
  slot: (typeof SLOTS)[number];
  screen: { width: number; height: number };
  progress: Animated.Value;
  clarity: Animated.Value;
  drift: Animated.Value;
  index: number;
  threshold: number;
  reduceMotion: boolean;
}

/**
 * One photograph, arriving as the count passes it.
 *
 * Driven off the same progress value as the counter rather than its own timer,
 * so the two can never drift apart — the photographs are literally the number
 * being counted.
 */
function Thumbnail({
  source,
  slot,
  screen,
  progress,
  clarity,
  drift,
  index,
  threshold,
  reduceMotion,
}: ThumbnailProps) {
  // Phase offset so each photo bounces at a different time, creating a
  // choreographed effect around the screen.
  const phaseOffset = (index * 0.125) % 1; // Each photo offset by 1/8th of cycle
  // A short ramp starting at this slot's threshold. Clamped, so a thumbnail
  // that has arrived stays arrived for the rest of the climb.
  const entrance = progress.interpolate({
    inputRange: [threshold, Math.min(1, threshold + 0.22)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Fade happens either way — it is what makes the arrival legible. Only the
  // movement is dropped under reduce-motion.
  const scale = reduceMotion
    ? 1
    : entrance.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  const rotate = reduceMotion
    ? '0deg'
    : entrance.interpolate({
        inputRange: [0, 1],
        // Overshoots its resting angle slightly, then settles into it.
        outputRange: [`${slot.rotation * 2.4}deg`, `${slot.rotation}deg`],
      });

  // Bouncy drift animation with phase offset: each photo bounces at a different time
  // Creates a choreographed, wave-like effect around the screen edges
  // Shift the input range by the phase offset so each photo starts at a different point in the cycle
  const baseInputs = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84, 1];
  const shiftedInputs = baseInputs.map((val) => (val + phaseOffset) % 1).sort((a, b) => a - b);

  const phasedDriftX = drift.interpolate({
    inputRange: shiftedInputs,
    outputRange: [0, 8, -5, 7, -4, 6, -3, 4, 0], // Quick bounces with decreasing amplitude
    extrapolate: 'clamp',
  });

  const phasedDriftY = drift.interpolate({
    inputRange: shiftedInputs,
    outputRange: [0, -6, 4, -5, 3, -4, 2, -3, 0], // Offset bounces for natural motion
    extrapolate: 'clamp',
  });

  const left = screen.width * slot.x - slot.size / 2;
  const top = screen.height * slot.y - slot.size / 2;

  // Zoom in on photos: creates an intimate, premium crop of the images.
  // The drift movement becomes more apparent with the larger scale.
  const zoomedScale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [1.38, 1.38], // Stays zoomed in throughout
  });

  return (
    <Animated.View
      style={[
        S.thumbnail,
        {
          left,
          top,
          width: slot.size,
          height: slot.size,
          opacity: entrance,
          transform: [{ scale: Animated.multiply(scale, zoomedScale) }, { rotate }, { translateX: phasedDriftX }, { translateY: phasedDriftY }],
          overflow: 'hidden',
        },
      ]}
    >
      {/* Two copies rather than an animated `blurRadius`: the prop is not
          animatable, and crossfading between a blurred and a sharp layer is
          what makes the unlock read as the photograph coming into focus. */}
      <Animated.Image
        source={source}
        style={[S.thumbnailImage, { opacity: clarity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        blurRadius={22}
        resizeMode="cover"
      />
      <Animated.Image
        source={source}
        style={[StyleSheet.absoluteFill, S.thumbnailImage, { opacity: clarity }]}
        resizeMode="cover"
      />

      {/* Holds the locked state back further than blur alone manages — a heavy
          blur still leaks composition and skin tone. */}
      <Animated.View
        pointerEvents="none"
        style={[
          S.thumbnailVeil,
          { opacity: clarity.interpolate({ inputRange: [0, 1], outputRange: [1, 0.18] }) },
        ]}
      />
    </Animated.View>
  );
}

/* ────────────────────────────────────────────────────────────────
   Glyphs
   ──────────────────────────────────────────────────────────────── */

function CloseGlyph() {
  return (
    <View style={S.glyphBox}>
      <View style={[S.glyphBar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[S.glyphBar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

function BackGlyph() {
  return (
    <View style={S.chevronBox}>
      <View style={[S.chevronBar, { transform: [{ rotate: '-45deg' }], top: 4 }]} />
      <View style={[S.chevronBar, { transform: [{ rotate: '45deg' }], bottom: 4 }]} />
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────
   Styles
   ──────────────────────────────────────────────────────────────── */

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: layout.gutter,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    backgroundColor: 'rgba(245, 242, 237, 0.04)',
  },

  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  badge: { marginBottom: spacing.md },

  eyebrowGold: { color: colours.accentWarm, letterSpacing: 2.4 },
  eyebrowMuted: { color: colours.textSecondary, letterSpacing: 2.4 },

  title: {
    color: colours.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  // The one number on the screen, and the reason the screen exists.
  count: {
    fontFamily: fontFamilies.display,
    fontSize: 108,
    lineHeight: 118,
    color: colours.accentWarm,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },

  rule: {
    width: 120,
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
    marginTop: spacing.xl,
    marginBottom: spacing.base,
  },
  message: { maxWidth: 280 },

  footer: { paddingHorizontal: layout.gutter, paddingTop: spacing.base },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 62,
    borderRadius: radii.pill,
    backgroundColor: colours.brandPrimary,
  },
  ctaLabel: { color: colours.textOnBrand, fontSize: 17 },
  pressed: { opacity: 0.9 },

  thumbnail: {
    position: 'absolute',
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: 'rgba(245, 242, 237, 0.10)',
  },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 11, 12, 0.55)',
  },

  glyphBox: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  glyphBar: {
    position: 'absolute',
    width: 16,
    height: 1.6,
    borderRadius: 1,
    backgroundColor: colours.textPrimary,
  },
  chevronBox: { width: 14, height: 18, alignItems: 'center', justifyContent: 'center' },
  chevronBar: {
    position: 'absolute',
    width: 10,
    height: 1.8,
    borderRadius: 1,
    backgroundColor: colours.textOnBrand,
  },
});
