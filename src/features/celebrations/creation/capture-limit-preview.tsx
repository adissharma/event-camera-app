import { useCallback } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colours, easing, layout, spacing, useMotion } from '@/design';
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
  coverSource: ImageSourcePropType;
}

const ZOOM_OPTIONS = [
  { label: '0.5', value: 'wide' },
  { label: '1x', value: 'standard' },
  { label: '2.5', value: 'telephoto' },
] as const;

/** A cropped, inert slice of the guest camera's lower viewfinder. */
export function CaptureLimitPreview({ limit, coverSource }: CaptureLimitPreviewProps) {
  const motion = useMotion();
  const shake = useSharedValue(0);
  const travel = motion.translate(6);
  const delayMs = motion.reduceMotion ? 0 : 360;
  const stepDuration = motion.duration('microFast');

  useFocusEffect(
    useCallback(() => {
      shake.value = 0;
      shake.value = withDelay(
        delayMs,
        withSequence(
          withTiming(-1, { duration: stepDuration, easing: easing.inOut }),
          withTiming(0.8, { duration: stepDuration, easing: easing.inOut }),
          withTiming(-0.45, { duration: stepDuration, easing: easing.inOut }),
          withTiming(0, { duration: stepDuration, easing: easing.standard }),
        ),
      );

      const settle = setTimeout(() => {
        shake.value = 0;
      }, delayMs + stepDuration * 4 + 250);

      return () => {
        clearTimeout(settle);
        cancelAnimation(shake);
        shake.value = 0;
      };
    }, [delayMs, shake, stepDuration]),
  );

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: travel * shake.value }],
  }));

  return (
    <Animated.View
      style={[S.frame, shakeStyle]}
      accessibilityLabel="Guest camera capture-limit preview"
    >
      <View style={S.viewfinder}>
        <Image source={coverSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.45)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {limit !== undefined ? (
          <ViewfinderShotCounter
            value={limit === null ? '∞' : limit}
            animateChanges={limit !== null}
            haptics={limit !== null}
            rollFrom={1}
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
          gallerySource={coverSource}
          interactive={false}
        />
      </View>

      <View style={S.lowerEdge} pointerEvents="none" />
      <LinearGradient
        colors={[colours.background, 'rgba(11,11,12,0.72)', 'rgba(11,11,12,0)']}
        locations={[0, 0.36, 1]}
        style={S.topFade}
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
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    right: 0,
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
    borderLeftWidth: layout.hairline,
    borderRightWidth: layout.hairline,
    borderBottomWidth: layout.hairline,
    borderColor: colours.borderStrong,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    zIndex: 40,
  },
  viewfinder: { flex: 1, position: 'relative', backgroundColor: '#000000' },
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
    backgroundColor: '#0B0B0C',
  },
});
