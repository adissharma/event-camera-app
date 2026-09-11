import { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { ColorMatrix, type Matrix as NativeMatrix } from 'react-native-color-matrix-image-filters';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { colours, easing, layout, spacing, useMotion } from '@/design';
import { TREATMENT_VISUALS } from '@/features/media/photo-treatment';
import {
  ViewfinderBottomControls,
  ViewfinderCameraRollPlusIcon,
  ViewfinderZoomPill,
} from '@/features/media/viewfinder-chrome';
import {
  ViewfinderShotCounter,
  VIEWFINDER_PILL_HEIGHT,
  VIEWFINDER_PILL_INSET,
} from '@/features/media/viewfinder-shot-counter';

export interface CaptureLimitPreviewProps {
  limit: number | null | undefined;
}

const STATIC_PREVIEW_SOURCE = require('../../../../assets/sample-event/07.jpg');

const ZOOM_OPTIONS = [
  { label: '0.5', value: 'wide' },
  { label: '1x', value: 'standard' },
  { label: '2.5', value: 'telephoto' },
] as const;

const COUNTER_FOCUS_ORIGIN_X = VIEWFINDER_PILL_INSET + VIEWFINDER_PILL_HEIGHT / 2;
const COUNTER_FOCUS_ORIGIN_Y = 78;
/**
 * How far the viewfinder drifts toward the shots-remaining counter.
 *
 * A gentle push, not a close-up: at 2.55 the counter filled the frame and the
 * preview stopped reading as a camera at all. The translations are the scale's
 * partners — they keep the counter in shot as the layer grows, so changing one
 * without the other slides the subject out of frame.
 */
const COUNTER_FOCUS_SCALE = 1.7;
const COUNTER_FOCUS_TRANSLATE_X = 33;
const COUNTER_FOCUS_TRANSLATE_Y = 11;

/**
 * Three seconds, well past any motion token.
 *
 * The move is meant to be noticed rather than watched — slow enough that it
 * reads as the frame settling while the host reads the question, not as an
 * animation demanding attention. Reduce-motion still collapses it.
 */
const COUNTER_FOCUS_DURATION_MS = 3000;

/** A cropped, inert slice of the guest camera's lower viewfinder. */
export function CaptureLimitPreview({ limit }: CaptureLimitPreviewProps) {
  const previewSource = STATIC_PREVIEW_SOURCE;
  const motion = useMotion();
  const focusProgress = useSharedValue(0);
  const delayMs = motion.reduceMotion ? 0 : 360;
  const focusDuration = motion.reduceMotion
    ? motion.duration('emotionalSlow')
    : COUNTER_FOCUS_DURATION_MS;
  const focusScale = motion.reduceMotion ? 1 : COUNTER_FOCUS_SCALE;
  const focusTranslateX = motion.translate(COUNTER_FOCUS_TRANSLATE_X);
  const focusTranslateY = motion.translate(COUNTER_FOCUS_TRANSLATE_Y);

  useFocusEffect(
    useCallback(() => {
      focusProgress.set(0);
      focusProgress.set(withDelay(
        delayMs,
        withTiming(1, { duration: focusDuration, easing: easing.inOut }),
      ));

      return () => {
        cancelAnimation(focusProgress);
        focusProgress.set(0);
      };
    }, [delayMs, focusDuration, focusProgress]),
  );

  const focusStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: focusTranslateX * focusProgress.get() },
      { translateY: focusTranslateY * focusProgress.get() },
      { scale: 1 + (focusScale - 1) * focusProgress.get() },
    ],
  }));

  return (
    <Animated.View
      style={S.frame}
      accessibilityLabel="Guest camera capture-limit preview"
    >
      <Animated.View style={[S.zoomLayer, focusStyle]}>
        <View style={S.viewfinder}>
          <ColorMatrix
            matrix={TREATMENT_VISUALS.black_and_white.colorMatrix as unknown as NativeMatrix}
            style={S.absoluteFill}
          >
            <Image source={previewSource} style={S.viewfinderImage} resizeMode="cover" />
          </ColorMatrix>
          <LinearGradient
            colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.45)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {limit !== undefined ? (
            <ViewfinderShotCounter
              value={limit === null ? '∞' : limit}
              animateChanges={limit !== null}
              haptics={false}
              rollFrom={0}
              rollDelayMs={0}
            />
          ) : null}

          <View style={S.zoomPill}>
            <ViewfinderZoomPill options={ZOOM_OPTIONS} activeLabel="1x" />
          </View>

          <View style={S.cameraRollTag}>
            <ViewfinderCameraRollPlusIcon size={20} />
          </View>
        </View>

        <View style={S.bottomPanel}>
          <ViewfinderBottomControls
            flashMode="off"
            gallerySource={previewSource}
            monochromeGalleryPreview
            interactive={false}
          />
        </View>

        <View style={S.lowerEdge} pointerEvents="none" />
      </Animated.View>
      <LinearGradient
        colors={[colours.background, 'rgba(11,11,12,0.72)', 'rgba(11,11,12,0)']}
        locations={[0, 0.36, 1]}
        style={S.topFade}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(11,11,12,0)', 'rgba(11,11,12,0.72)', colours.background]}
        locations={[0, 0.64, 1]}
        style={S.bottomFade}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

const S = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 340,
    height: 231,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  zoomLayer: {
    flex: 1,
    transformOrigin: `${COUNTER_FOCUS_ORIGIN_X}px ${COUNTER_FOCUS_ORIGIN_Y}px`,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 54,
    zIndex: 50,
  },
  bottomFade: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 54,
    zIndex: 50,
  },
  lowerEdge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 0,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    zIndex: 40,
  },
  viewfinder: { flex: 1, position: 'relative', backgroundColor: '#000000' },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  viewfinderImage: {
    width: '100%',
    height: '100%',
  },
  zoomPill: {
    position: 'absolute',
    bottom: VIEWFINDER_PILL_INSET,
    alignSelf: 'center',
  },
  cameraRollTag: {
    position: 'absolute',
    right: VIEWFINDER_PILL_INSET,
    bottom: VIEWFINDER_PILL_INSET,
    width: VIEWFINDER_PILL_HEIGHT,
    height: VIEWFINDER_PILL_HEIGHT,
    borderRadius: VIEWFINDER_PILL_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,11,12,0.65)',
  },
  bottomPanel: {
    height: 115,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
    backgroundColor: '#141417',
  },
});
