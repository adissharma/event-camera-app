import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { fontFamilies } from '@/design';

const blobSource = require('../../../assets/video/welcome-blob.mov');
const WORDMARK_SIZE = 52;
const DOT_SIZE = 13;
// The wordmark container is centred on its line box, but a full stop belongs
// on the baseline in the lower part of that box.
const DOT_BASELINE_OFFSET = WORDMARK_SIZE * 0.18;
const VIDEO_HORIZONTAL_INSET = 24;
const CENTER_HOLD_MS = 2000;
const ANIMATION_MS = 2600;
const HOLD_MS = 650;

interface VideoSplashProps {
  onSettled: (played: boolean) => void;
  /** The measured centre line of the final welcome wordmark. */
  logoCenterY: number | null;
}

/** The launch-only video mark. The old prose intro remains in index.tsx for easy re-enabling. */
export function VideoSplash({ onSettled, logoCenterY }: VideoSplashProps) {
  const { width, height } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  const [wordWidth, setWordWidth] = useState(0);
  const completed = useRef(false);
  const sequenceStarted = useRef(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const wordOpacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // This is an opening visual, not a full-bleed splash: keep the square
  // visibly inside the phone's horizontal margins and vertically centred.
  const frameSize = Math.min(width - VIDEO_HORIZONTAL_INSET * 2, height * 0.42);
  const centerX = width / 2;
  const centerY = height / 2;
  const dotPosition = useMemo(() => {
    // “Stills” is centred as a complete mark; the animated punctuation is
    // placed just after its measured word width and down on the same baseline.
    const left = centerX - (wordWidth + DOT_SIZE + 5) / 2;
    return {
      x: left + wordWidth + 5 + DOT_SIZE / 2,
      y: (logoCenterY ?? centerY) + DOT_BASELINE_OFFSET,
    };
  }, [centerX, centerY, logoCenterY, wordWidth]);

  const player = useVideoPlayer(blobSource, (instance) => {
    instance.muted = true;
    // The same player remains mounted after it becomes punctuation.
    instance.loop = true;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const finish = useCallback((played = true) => {
    if (completed.current) return;
    completed.current = true;
    onSettled(played);
  }, [onSettled]);

  useEffect(() => {
    if (status === 'error') setFailed(true);
  }, [status]);

  // Start playback as soon as the local asset is decoded. The transformation
  // waits only for the measured final logo anchor, never for another player.
  useEffect(() => {
    if (status !== 'readyToPlay') return;
    player.play();
    opacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) });
  }, [status, player, opacity]);

  // A bounded fallback keeps an unavailable/corrupt video from blocking auth.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status !== 'readyToPlay') setFailed(true);
    }, 3200);
    return () => clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (failed) {
      finish(false);
      return;
    }
    if (
      status !== 'readyToPlay' ||
      wordWidth <= 0 ||
      logoCenterY === null ||
      sequenceStarted.current
    ) {
      return;
    }
    sequenceStarted.current = true;
    const targetScale = DOT_SIZE / frameSize;
    // Let the supplied animation be the focus first. Only after two seconds
    // does the same video begin its continuous transformation into the stop.
    scale.value = withDelay(
      CENTER_HOLD_MS,
      withTiming(targetScale, {
        duration: ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    translateX.value = withDelay(
      CENTER_HOLD_MS,
      withTiming(dotPosition.x - centerX, { duration: ANIMATION_MS, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      CENTER_HOLD_MS,
      withTiming(dotPosition.y - centerY, { duration: ANIMATION_MS, easing: Easing.out(Easing.cubic) }),
    );
    wordOpacity.value = withDelay(
      CENTER_HOLD_MS + ANIMATION_MS * 0.62,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
    );
    const timeout = setTimeout(finish, CENTER_HOLD_MS + ANIMATION_MS + HOLD_MS);
    return () => clearTimeout(timeout);
  }, [
    failed,
    status,
    wordWidth,
    logoCenterY,
    player,
    frameSize,
    centerX,
    centerY,
    dotPosition,
    scale,
    opacity,
    wordOpacity,
    translateX,
    translateY,
    finish,
  ]);

  const videoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      // React Native composes this array as matrices. Translation must precede
      // scale here, otherwise the target offset is itself scaled down toward
      // zero and the video appears to shrink in place at screen centre.
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (failed) return null;

  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          styles.videoFrame,
          {
            width: frameSize,
            height: frameSize,
            left: (width - frameSize) / 2,
            top: (height - frameSize) / 2,
          },
          videoStyle,
        ]}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.wordmark,
          { opacity: wordOpacity, transform: [{ translateY: (logoCenterY ?? centerY) - centerY }] },
        ]}
        pointerEvents="none"
      >
        <Text
          style={styles.word}
          allowFontScaling={false}
          onLayout={(event) => setWordWidth(event.nativeEvent.layout.width)}
        >
          Stills
        </Text>
        <View style={{ width: DOT_SIZE + 5 }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#000000', overflow: 'hidden' },
  videoFrame: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  wordmark: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  word: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.display,
    fontSize: WORDMARK_SIZE,
    lineHeight: WORDMARK_SIZE + 8,
    letterSpacing: -0.4,
  },
});
