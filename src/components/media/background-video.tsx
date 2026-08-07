import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colours, easing, useMotion } from '@/design';
import { getMotionAsset, type MotionAssetKey } from '@/config/motion-assets';
import { VisualPlaceholder } from './visual-placeholder';

export interface BackgroundVideoProps {
  assetKey: MotionAssetKey;
  /** Fade-in duration once the first frame is decoded. */
  fadeMs?: number;
}

/**
 * Ambient background video.
 *
 * Behaviour that matters:
 *
 * - **Fades up from the canvas.** The canvas is near-black and so is this
 *   footage, so there is no flash — the image simply arrives. The fade only
 *   starts once the player reports `readyToPlay`, so it never cross-fades into
 *   an undecoded black rectangle.
 * - **Always muted, no controls, not interactive.** It is wallpaper.
 * - **Hidden from assistive technology.** A decorative background is noise in a
 *   screen-reader tree, and it would otherwise be announced as a video control.
 *   The meaning on this screen lives in the text.
 * - **Falls back to the manifest placeholder** on error, at the same size.
 *
 * ## Reduce motion
 *
 * This is the important part. A looping background video is exactly the content
 * WCAG 2.2.2 (Pause, Stop, Hide) is about — it moves indefinitely, and the user
 * cannot stop it. It is also a common migraine and vestibular trigger.
 *
 * When the OS reduce-motion setting is on, the video is **paused on its first
 * frame** rather than removed. The composition, the scrim and the crop are all
 * preserved — the user gets the same photograph everyone else gets, it simply
 * does not move. Removing it entirely would give reduce-motion users a visibly
 * poorer screen, which is not the point of the setting.
 */
export function BackgroundVideo({ assetKey, fadeMs = 900 }: BackgroundVideoProps) {
  const asset = getMotionAsset(assetKey);
  const motion = useMotion();
  const opacity = useSharedValue(0);

  const player = useVideoPlayer(asset.source, (instance) => {
    instance.loop = true;
    instance.muted = true;
    // Never let ambient wallpaper interrupt the user's music.
    instance.audioMixingMode = 'mixWithOthers';
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const isReady = status === 'readyToPlay';
  const failed = status === 'error';

  // Play or hold on the first frame, following the reduce-motion setting. This
  // is kept in an effect rather than the setup callback so that toggling the
  // system setting while the app is open takes effect immediately.
  useEffect(() => {
    if (!isReady) return;
    if (motion.reduceMotion) {
      // Pause only — deliberately no seek back to the start. Holding the
      // current frame means enabling reduce-motion mid-playback simply stops
      // the movement, rather than jumping the image, which is itself motion.
      // (Assigning `player.currentTime` would also mutate a hook return value,
      // which the React Compiler correctly rejects.)
      player.pause();
    } else {
      player.play();
    }
  }, [isReady, motion.reduceMotion, player]);

  useEffect(() => {
    if (!isReady) return;
    // The fade itself is motion, so it honours the setting too.
    opacity.value = withTiming(1, {
      duration: motion.reduceMotion ? 120 : fadeMs,
      easing: easing.standard,
    });
  }, [isReady, motion.reduceMotion, fadeMs, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colours.background }]}>
        <VisualPlaceholder assetKey={asset.fallbackAssetKey} fill radius="none" style={{ borderWidth: 0 }} />
      </View>
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colours.background,
          // Required. The underlying element renders at the video's own
          // dimensions rather than the container's, so without clipping it
          // spills outside the app bounds — visible as raw footage beyond the
          // scrim on any viewport smaller than the source.
          overflow: 'hidden',
        },
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <VideoView
          player={player}
          // Explicit 100%/100% rather than `absoluteFill`: inset-based
          // positioning alone does not constrain the intrinsic size here.
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          nativeControls={false}
          // Prevents the OS from offering picture-in-picture on wallpaper.
          allowsPictureInPicture={false}
        />
      </Animated.View>
    </View>
  );
}
