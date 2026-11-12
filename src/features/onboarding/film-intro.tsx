import { useCallback, useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { fitDisplayFace, fontFamilies, layout, useMotion } from '@/design';
import {
  CLOSING_COMMA,
  CLOSING_MARK,
  CLOSING_TAILS,
  FINAL_LINE,
  SLIDE_ONE_LINES,
  SLIDE_TWO_LINE,
} from './still-intro';

/**
 * The first-launch intro, as a reel of film.
 *
 * Five full-screen scenes from one night, each holding a single line of the
 * poem. The photographs are graded down to dusk and sit under moving grain,
 * so they read as something remembered rather than something displayed. The
 * last scene dims, the three "Still," statements build over it, and the
 * screen clears to the name.
 *
 * Everything hangs off one clock (`t`, in milliseconds), so the sequence is a
 * table of times rather than a chain of callbacks, and a tap can move the
 * whole thing forward by setting one number.
 */

const SCENES = [
  { source: require('../../../assets/images/placeholders/treatment_preview_2.png'), line: SLIDE_ONE_LINES[0]! },
  { source: require('../../../assets/images/placeholders/treatment_preview_1.png'), line: SLIDE_ONE_LINES[1]! },
  { source: require('../../../assets/images/placeholders/iphone_group_4.png'), line: SLIDE_ONE_LINES[2]! },
  { source: require('../../../assets/images/placeholders/iphone_group_5.png'), line: SLIDE_ONE_LINES[3]! },
  { source: require('../../../assets/images/placeholders/create_event_cover.png'), line: SLIDE_TWO_LINE },
] as const;

const GRAIN = require('../../../assets/images/textures/grain.png');
const DUST = require('../../../assets/images/textures/dust-1.png');

/** One scene's share of the clock. */
const BEAT = 2800;
const FIRST_AT = 300;
const SCENE_IN = 900;
const LINE_IN_AT = 500;
const LINE_IN = 700;
const LINE_OUT_AT = BEAT - 350;
const LINE_OUT = 350;

/** The closing: the last scene dims and the three statements build over it. */
const CLOSING_AT = FIRST_AT + BEAT * SCENES.length;
const TAIL_STAGGER = 1200;
const TAIL_IN = 650;
const CLOSING_OUT_AT = CLOSING_AT + 300 + TAIL_STAGGER * CLOSING_TAILS.length + 1300;
const CLOSING_OUT = 700;
const MARK_AT = CLOSING_OUT_AT + CLOSING_OUT + 100;
const MARK_IN = 650;
const STOP_AT = MARK_AT + MARK_IN + 200;
const STOP_IN = 400;
const TOTAL = STOP_AT + STOP_IN + 700;

/** Where a tap lands: the start of whatever comes next. */
const STOPS = [
  ...SCENES.map((_, index) => FIRST_AT + BEAT * index),
  CLOSING_AT,
  CLOSING_OUT_AT,
];

/** Dusk: a cool, dark wash that mutes the photographs toward one palette. */
const WASH = 'rgba(9, 14, 28, 0.46)';
const GRAIN_TILE = 128;

const MARK_SIZE = 46;
const MARK_LEADING = 64;

interface FilmIntroProps {
  onSettled: (played: boolean) => void;
}

function Scene({
  index,
  t,
  reduceMotion,
}: {
  index: number;
  t: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const start = FIRST_AT + BEAT * index;
  const last = index === SCENES.length - 1;
  // The last scene stays for the closing; the others are covered by the next.
  const end = last ? CLOSING_OUT_AT + CLOSING_OUT : start + BEAT + SCENE_IN;

  const style = useAnimatedStyle(() => {
    const enter = interpolate(t.value, [start, start + SCENE_IN], [0, 1], Extrapolation.CLAMP);
    const leave = last
      ? interpolate(t.value, [CLOSING_OUT_AT, CLOSING_OUT_AT + CLOSING_OUT], [0, 1], Extrapolation.CLAMP)
      : interpolate(t.value, [end, end + 1], [0, 1], Extrapolation.CLAMP);
    // A slow push in, alternating direction so consecutive scenes do not
    // drift the same way.
    const life = interpolate(t.value, [start, end], [0, 1], Extrapolation.CLAMP);
    const drift = index % 2 === 0 ? 1 : -1;
    return {
      opacity: enter * (1 - leave),
      transform: reduceMotion
        ? []
        : [{ scale: 1.06 + life * 0.08 }, { translateX: drift * (life - 0.5) * 14 }],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={SCENES[index]!.source}
        // Explicit size: a bundled image otherwise keeps its own pixel
        // dimensions and shows only a corner of itself.
        style={styles.fill}
        resizeMode="cover"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

function SceneLine({
  index,
  t,
  reduceMotion,
}: {
  index: number;
  t: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const start = FIRST_AT + BEAT * index;

  const style = useAnimatedStyle(() => {
    const enter = interpolate(
      t.value,
      [start + LINE_IN_AT, start + LINE_IN_AT + LINE_IN],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const leave = interpolate(
      t.value,
      [start + LINE_OUT_AT, start + LINE_OUT_AT + LINE_OUT],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: enter * (1 - leave),
      transform: [{ translateY: reduceMotion ? 0 : (1 - enter) * 6 }],
    };
  });

  return (
    <Animated.Text style={[styles.line, style]} allowFontScaling={false}>
      {SCENES[index]!.line}
    </Animated.Text>
  );
}

function ClosingLine({ index, t }: { index: number; t: SharedValue<number> }) {
  const start = CLOSING_AT + 300 + TAIL_STAGGER * index;

  const style = useAnimatedStyle(() => {
    const enter = interpolate(t.value, [start, start + TAIL_IN], [0, 1], Extrapolation.CLAMP);
    const leave = interpolate(
      t.value,
      [CLOSING_OUT_AT, CLOSING_OUT_AT + CLOSING_OUT],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: enter * (1 - leave) };
  });

  return (
    <Animated.Text style={[styles.closingLine, style]} allowFontScaling={false}>
      {CLOSING_MARK}
      {CLOSING_COMMA}
      {CLOSING_TAILS[index]}
    </Animated.Text>
  );
}

export function FilmIntro({ onSettled }: FilmIntroProps) {
  const { width, height } = useWindowDimensions();
  const { reduceMotion } = useMotion();
  const settled = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useSharedValue(0);

  const finish = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onSettled(true);
  }, [onSettled]);

  /** Runs the clock from `from` to the end, and moves on when it gets there. */
  const run = useCallback(
    (from: number) => {
      cancelAnimation(t);
      t.value = from;
      t.value = withTiming(TOTAL, { duration: TOTAL - from, easing: Easing.linear });
      if (timer.current) clearTimeout(timer.current);
      // A timer rather than the animation's own callback: the screen must move
      // on even if the animation is interrupted or never reports back.
      timer.current = setTimeout(finish, TOTAL - from + 100);
    },
    [finish, t],
  );

  useEffect(() => {
    run(0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(t);
    };
  }, [run, t]);

  /** A tap moves to whatever comes next, as it did in the poem this replaces. */
  const advance = useCallback(() => {
    if (settled.current) return;
    const next = STOPS.find((stop) => stop > t.value + 150);
    if (next === undefined) return;
    run(next);
  }, [run, t]);

  // Grain that moves. A still texture reads as dirt on the glass; shifting it
  // a dozen times a second is what makes it read as film.
  const grainX = useSharedValue(0);
  const grainY = useSharedValue(0);
  const lastShift = useSharedValue(0);
  useFrameCallback((frame) => {
    if (reduceMotion) return;
    if (frame.timestamp - lastShift.value < 80) return;
    lastShift.value = frame.timestamp;
    grainX.value = -Math.floor(Math.random() * GRAIN_TILE);
    grainY.value = -Math.floor(Math.random() * GRAIN_TILE);
  });
  const grainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: grainX.value }, { translateY: grainY.value }],
  }));

  // The closing dims the last scene so the statements can be read over it.
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [CLOSING_AT, CLOSING_AT + 900], [0, 0.5], Extrapolation.CLAMP),
  }));
  const blackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [CLOSING_OUT_AT, CLOSING_OUT_AT + CLOSING_OUT],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  // The grain and dust leave with the last scene.
  const filmStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [CLOSING_OUT_AT, CLOSING_OUT_AT + CLOSING_OUT],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [MARK_AT, MARK_AT + MARK_IN], [0, 1], Extrapolation.CLAMP),
  }));
  const stopStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [STOP_AT, STOP_AT + STOP_IN], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {SCENES.map((_, index) => (
          <Scene key={index} index={index} t={t} reduceMotion={reduceMotion} />
        ))}
      </View>

      {/* The grade: one wash for every scene, darker toward the edges, and a
          soft band of shadow across the middle where the line sits. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WASH }]} pointerEvents="none" />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0)',
          'rgba(0,0,0,0.34)',
          'rgba(0,0,0,0.34)',
          'rgba(0,0,0,0)',
          'rgba(0,0,0,0.6)',
        ]}
        locations={[0, 0.26, 0.42, 0.58, 0.74, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} pointerEvents="none" />
      {/* True black for the name, so the last frame matches the app behind it. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, blackStyle]} pointerEvents="none" />

      <Animated.View style={[StyleSheet.absoluteFill, filmStyle]} pointerEvents="none">
        <Animated.View
          style={[
            { width: width + GRAIN_TILE, height: height + GRAIN_TILE, opacity: 0.55 },
            grainStyle,
          ]}
        >
          <Image source={GRAIN} style={styles.fill} resizeMode="repeat" accessibilityIgnoresInvertColors />
        </Animated.View>
        <Image
          source={DUST}
          style={[StyleSheet.absoluteFill, styles.dust]}
          resizeMode="repeat"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      <View
        style={styles.centre}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {SCENES.map((_, index) => (
          <SceneLine key={index} index={index} t={t} reduceMotion={reduceMotion} />
        ))}
      </View>

      <View style={styles.centre} pointerEvents="none">
        <View>
          {CLOSING_TAILS.map((_, index) => (
            <ClosingLine key={index} index={index} t={t} />
          ))}
        </View>
      </View>

      <View style={styles.mark} pointerEvents="none">
        <Animated.Text style={[styles.markText, markStyle]} allowFontScaling={false}>
          {FINAL_LINE.mark}
        </Animated.Text>
        <Animated.Text style={[styles.markText, stopStyle]} allowFontScaling={false}>
          {FINAL_LINE.stop}
        </Animated.Text>
      </View>

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={advance}
        accessibilityRole="button"
        accessibilityLabel="Continue"
        accessibilityHint="Moves to the next line"
      />
    </View>
  );
}

const TEXT_SHADOW = {
  textShadowColor: 'rgba(0, 0, 0, 0.55)',
  textShadowRadius: 12,
  textShadowOffset: { width: 0, height: 1 },
} as const;

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#000000', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  dim: { backgroundColor: '#000000' },
  dust: { width: '100%', height: '100%', opacity: 0.6 },
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter + 8,
  },
  line: {
    position: 'absolute',
    left: layout.gutter + 8,
    right: layout.gutter + 8,
    ...fitDisplayFace({
      fontFamily: fontFamilies.display,
      color: '#F5F2ED',
      textAlign: 'center',
      fontSize: 25,
      lineHeight: 36,
      letterSpacing: -0.2,
    }),
    ...TEXT_SHADOW,
  },
  closingLine: {
    ...fitDisplayFace({
      fontFamily: fontFamilies.display,
      color: '#F5F2ED',
      textAlign: 'left',
      fontSize: 24,
      lineHeight: 40,
      letterSpacing: -0.2,
    }),
    ...TEXT_SHADOW,
  },
  mark: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: fitDisplayFace({
    fontFamily: fontFamilies.display,
    color: '#FFFFFF',
    fontSize: MARK_SIZE,
    lineHeight: MARK_LEADING,
    letterSpacing: -0.3,
  }),
});
