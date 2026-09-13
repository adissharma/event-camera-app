import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const welcomeAnimation = require('../../../assets/video/welcome-0913.mov');

interface VideoSplashProps {
  onSettled: (played: boolean) => void;
}

/**
 * The launch animation stays mounted after playback completes so its final
 * frame becomes the welcome screen backdrop while the auth controls appear.
 */
export function VideoSplash({ onSettled }: VideoSplashProps) {
  const completed = useRef(false);
  const opacity = useSharedValue(0);
  const player = useVideoPlayer(welcomeAnimation, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const finish = useCallback(
    (played: boolean) => {
      if (completed.current) return;
      completed.current = true;
      onSettled(played);
    },
    [onSettled],
  );

  useEventListener(player, 'playToEnd', () => {
    // Keep the player and its final rendered frame in place beneath the
    // welcome controls. `loop` is disabled, so no restart can occur.
    player.pause();
    finish(true);
  });

  useEffect(() => {
    if (status === 'readyToPlay') {
      player.play();
      opacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
      return;
    }

    if (status === 'error') {
      finish(false);
    }
  }, [finish, opacity, player, status]);

  // Never leave a user stuck on an unavailable video asset.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status !== 'readyToPlay') finish(false);
    }, 3200);
    return () => clearTimeout(timeout);
  }, [finish, status]);

  const videoStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.video, videoStyle]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#000000' },
  video: StyleSheet.absoluteFill,
});
