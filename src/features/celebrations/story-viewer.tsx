/**
 * The full-screen story viewer shared by Challenges and the Guestbook.
 *
 * Both features present the same thing: an intro slide that explains the brief,
 * followed by one slide per submission, with tap-to-advance, swipe-down to
 * dismiss, and a per-slide overflow menu. They differ only in their backdrop
 * (Challenges blur a cover photo, the Guestbook is flat black) and their copy,
 * so everything else lives here rather than in two places.
 *
 * `activeSlideIndex` is controlled by the caller because the owner of the
 * submissions list also owns deletion, and deleting has to know which slide is
 * showing and where to land afterwards. Mute, the mount animation and the drag
 * gesture are internal — nothing outside needs to read them.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import ReanimatedAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { CloseIcon } from '@/components/ui/icons';
import { radii, spacing } from '@/design';

const ABSOLUTE_FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

// ── Icons ──

export function OverflowDotsIcon({ size = 18, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={12} r={2} fill={color} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Circle cx={19} cy={12} r={2} fill={color} />
    </Svg>
  );
}

export function VolumeIcon({
  muted,
  size = 18,
  color = '#FFFFFF',
}: {
  muted: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={color}
      />
      {muted ? (
        <Path d="M17 9l5 6M22 9l-5 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      ) : (
        <Path
          d="M16.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

// ── Playback helpers ──

function getWebVideoElement(container: unknown): HTMLVideoElement | null {
  if (Platform.OS !== 'web') return null;
  if (!container || typeof (container as Element).querySelector !== 'function') return null;
  const video = (container as Element).querySelector('video');
  return video instanceof HTMLVideoElement ? video : null;
}

/**
 * Starts playback with sound, falling back to muted if the browser blocks it.
 *
 * `expo-video`'s own `player.play()` is fire-and-forget on web — it calls the
 * underlying `<video>`'s `play()` but never looks at the promise it returns,
 * so a browser autoplay-policy rejection (unmuted playback outside a direct
 * user gesture) is silently swallowed and the video is left paused with no
 * retry. Driving the real `<video>` element here recovers that promise: on a
 * rejection this falls back to a muted autoplay, which browsers always allow,
 * rather than leaving the viewer looking at a frozen frame.
 *
 * A no-op on native, where there is no such restriction and `player.play()`
 * already works.
 */
export function playWithSoundFallback(
  container: unknown,
  player: { muted: boolean; play: () => void },
  onFallbackToMuted?: () => void,
) {
  const video = getWebVideoElement(container);
  if (!video) {
    player.play();
    return;
  }
  const playResult = video.play();
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch(() => {
      player.muted = true;
      onFallbackToMuted?.();
      player.play();
    });
  }
}

export function formatStoryTimestamp(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay) return `Today at ${time}`;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Video slide ──

/**
 * A story slide that plays its video and advances when it finishes.
 *
 * The URI is pinned on first render. Signed URLs are refreshed on a poll, and
 * re-creating the player on a new URL would restart playback mid-watch.
 *
 * On Android the view is a TextureView. A SurfaceView punches a hole through
 * the window, which renders black inside the transformed, Reanimated-driven
 * story overlay this sits in.
 *
 * Mute is a controlled prop rather than internal state: the toggle button lives
 * in the story header, outside this component, and needs to affect whichever
 * slide is currently playing.
 */
export function StoryVideoSlide({
  uri,
  muted,
  onMutedByBrowser,
  onEnd,
}: {
  uri: string;
  muted: boolean;
  /** Fires if the browser silently blocked unmuted autoplay and this fell
   * back to muted, so the header toggle can reflect what's actually playing. */
  onMutedByBrowser: () => void;
  onEnd: () => void;
}) {
  const pinnedUri = useRef(uri).current;
  const containerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const player = useVideoPlayer({ uri: pinnedUri }, (instance) => {
    instance.loop = false;
    instance.muted = muted;
    // The container ref is not attached yet on this first call — see the
    // `statusChange` listener below, which is what actually lands playback.
    playWithSoundFallback(containerRef.current, instance, onMutedByBrowser);
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'readyToPlay') return;
    setReady(true);
    playWithSoundFallback(containerRef.current, player, onMutedByBrowser);
  });

  useEventListener(player, 'playToEnd', () => {
    player.pause();
    onEnd();
  });

  // Reflects the header mute toggle onto whichever slide is live.
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  // Leaving the slide has to silence the video, not merely hide it. The player
  // is released when this unmounts, but release is asynchronous on native and
  // the audio carries on until it lands.
  useEffect(
    () => () => {
      try {
        player.pause();
      } catch {
        // Already released by the time the story closed. Nothing to stop.
      }
    },
    [player],
  );

  return (
    <View ref={containerRef} style={[ABSOLUTE_FILL, { backgroundColor: '#000000' }]}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
        {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : null)}
      />
      {ready ? null : (
        <View
          style={[ABSOLUTE_FILL, { alignItems: 'center', justifyContent: 'center' }]}
          pointerEvents="none"
        >
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

// ── Viewer ──

export type StorySlideItem = {
  id?: string | null;
  submissionId?: string | null;
  uri: string;
  takenBy?: string | null;
  postedAt?: string | null;
  caption?: string | null;
  mediaType?: 'photo' | 'video' | 'audio' | null;
};

/**
 * The intro slide's backdrop. Challenges blur a still from the event; the
 * Guestbook has no cover of its own and uses flat black instead.
 */
export type StoryBackdrop =
  | { kind: 'blurredImage'; source: ImageSourcePropType }
  | { kind: 'solid'; color: string };

export type StoryViewerProps = {
  backdrop: StoryBackdrop;
  /** Rendered inside the hero's ring on the intro slide. */
  icon: ReactNode;
  title: string;
  description: string;
  /** Smaller line under the description — the Guestbook's privacy note. */
  footnote?: string;
  submissions: StorySlideItem[];
  activeSlideIndex: number;
  onChangeSlideIndex: (index: number) => void;
  onDismiss: () => void;
  /** Omit to render no call to action — the host viewing a Guestbook, say. */
  cta?: { label: string; onPress: () => void };
  /** Shows the overflow button on the active submission slide. */
  canDeleteActive?: boolean;
  onPressOverflow?: () => void;
  /**
   * Replaces the default "who posted this, and when" caption. The Guestbook
   * uses this to say "Your message" rather than naming the guest to themselves.
   */
  renderSlideCaption?: (item: StorySlideItem) => ReactNode;
  /**
   * Takes over rendering a slide's media. Return `null` to fall through to the
   * built-in photo/video handling. The Guestbook uses this for the audio
   * messages it no longer records but still has to play back.
   */
  renderSlideMedia?: (item: StorySlideItem, onEnd: () => void) => ReactNode | null;
};

export function StoryViewer({
  backdrop,
  icon,
  title,
  description,
  footnote,
  submissions,
  activeSlideIndex,
  onChangeSlideIndex,
  onDismiss,
  cta,
  canDeleteActive = false,
  onPressOverflow,
  renderSlideCaption,
  renderSlideMedia,
}: StoryViewerProps) {
  const insets = useSafeAreaInsets();
  const totalSlides = 1 + submissions.length;
  const activeSubmission = activeSlideIndex > 0 ? submissions[activeSlideIndex - 1] : null;

  // Unmuted by default — `onMutedByBrowser` flips this if a browser silently
  // blocks unmuted autoplay, so the toggle reflects what is actually playing.
  const [muted, setMuted] = useState(false);

  const [mountAnim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    mountAnim.setValue(0);
    Animated.spring(mountAnim, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [mountAnim]);

  // ── Drag to dismiss ──
  // A Reanimated shared value so gesture updates run on the UI thread and never
  // cross the bridge — the swipe stays smooth while a video decodes.
  const dragY = useSharedValue(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (dismissTimerRef.current !== null) clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  const handlePanEvent = (event: any) => {
    if (event.translationY !== undefined && event.translationY > 0) {
      dragY.value = event.translationY;
    }
  };

  const handlePanStateChange = (event: any) => {
    // 5 = END, 3 = FAILED.
    if (event.nativeEvent.state === 5) {
      const { height } = Dimensions.get('window');
      if (event.nativeEvent.translationY > 60 || event.nativeEvent.velocityY > 1.2) {
        // Slide the rest of the way out before unmounting, so the story does
        // not vanish from under the finger.
        dragY.value = withTiming(height, { duration: 200 });
        dismissTimerRef.current = setTimeout(onDismiss, 220);
      } else {
        dragY.value = withSpring(0, { damping: 10, mass: 1, stiffness: 100 });
      }
    } else if (event.nativeEvent.state === 3) {
      dragY.value = withSpring(0);
    }
  };

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  function goToSlide(direction: 'prev' | 'next') {
    if (direction === 'prev') {
      if (activeSlideIndex > 0) onChangeSlideIndex(activeSlideIndex - 1);
      return;
    }
    if (activeSlideIndex < totalSlides - 1) {
      onChangeSlideIndex(activeSlideIndex + 1);
    } else {
      onDismiss();
    }
  }

  /** Advances on video end, but never dismisses — the last slide holds. */
  function advanceAfterMediaEnds() {
    if (activeSlideIndex < totalSlides - 1) {
      onChangeSlideIndex(activeSlideIndex + 1);
    }
  }

  const customSlide = activeSubmission
    ? renderSlideMedia?.(activeSubmission, advanceAfterMediaEnds) ?? null
    : null;

  return (
    <PanGestureHandler
      onGestureEvent={handlePanEvent}
      onHandlerStateChange={handlePanStateChange}
      activeOffsetY={[-12, 12]}
      failOffsetX={[-24, 24]}
    >
      <ReanimatedAnimated.View style={[S.overlay, overlayAnimatedStyle]}>
        {activeSlideIndex === 0 ? (
          backdrop.kind === 'blurredImage' ? (
            <Image
              source={backdrop.source}
              style={[ABSOLUTE_FILL, { width: '100%', height: '100%' }]}
              resizeMode="cover"
              blurRadius={35}
            />
          ) : (
            <View style={[ABSOLUTE_FILL, { backgroundColor: backdrop.color }]} />
          )
        ) : customSlide ? (
          customSlide
        ) : activeSubmission?.mediaType === 'video' ? (
          // Keyed by submission, not by URL: the URL is re-signed on every
          // poll, and remounting on that would restart playback every ten
          // seconds. Keying by submission still gives each video its own
          // player, including two videos back to back.
          <StoryVideoSlide
            key={activeSubmission.submissionId ?? activeSubmission.id ?? `slide-${activeSlideIndex}`}
            uri={activeSubmission.uri}
            muted={muted}
            onMutedByBrowser={() => setMuted(true)}
            onEnd={advanceAfterMediaEnds}
          />
        ) : (
          <Image
            source={{ uri: activeSubmission?.uri }}
            style={[ABSOLUTE_FILL, { width: '100%', height: '100%' }]}
            resizeMode="cover"
          />
        )}

        {/* Scrim. Heavier over the intro slide, where text sits on top of it. */}
        <View
          style={[
            ABSOLUTE_FILL,
            {
              backgroundColor:
                activeSlideIndex === 0 ? 'rgba(0, 0, 0, 0.40)' : 'rgba(11, 11, 12, 0.25)',
            },
          ]}
        />

        <View style={ABSOLUTE_FILL} pointerEvents="box-none">
          <View style={{ flex: 1, flexDirection: 'row' }} pointerEvents="box-none">
            <Pressable
              style={S.tapZone}
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              onPress={() => goToSlide('prev')}
            />
            <Pressable
              style={S.tapZone}
              accessibilityRole="button"
              accessibilityLabel="Next slide"
              onPress={() => goToSlide('next')}
            />
          </View>
        </View>

        {activeSlideIndex === 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              S.heroContainer,
              {
                opacity: mountAnim,
                transform: [
                  {
                    translateY: mountAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={S.heroIconRing}>{icon}</View>
            <AppText style={S.heroTitle}>{title}</AppText>

            <View style={S.heroDividerRow}>
              <View style={S.heroDividerLine} />
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <Path
                  d="M7 0C7 3.866 3.866 7 0 7C3.866 7 7 10.134 7 14C7 10.134 10.134 7 14 7C10.134 7 7 3.866 7 0Z"
                  fill="rgba(255, 255, 255, 0.6)"
                />
              </Svg>
              <View style={S.heroDividerLine} />
            </View>

            <AppText style={S.heroDesc}>{description}</AppText>
            {footnote ? <AppText style={S.heroFootnote}>{footnote}</AppText> : null}
          </Animated.View>
        ) : null}

        <View style={[S.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={S.progressBarRow}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <View key={i} style={S.progressBarOuter}>
                <View
                  style={[S.progressBarInner, { width: i <= activeSlideIndex ? '100%' : '0%' }]}
                />
              </View>
            ))}
          </View>

          <View style={S.headerRow}>
            <View style={{ flex: 1, paddingLeft: 4 }}>
              {activeSubmission
                ? renderSlideCaption?.(activeSubmission) ?? (
                    <View style={{ gap: 2 }}>
                      <AppText style={S.captionPrimary}>{activeSubmission.takenBy || 'Guest'}</AppText>
                      {formatStoryTimestamp(activeSubmission.postedAt) ? (
                        <AppText style={S.captionSecondary}>
                          {formatStoryTimestamp(activeSubmission.postedAt)}
                        </AppText>
                      ) : null}
                    </View>
                  )
                : null}
            </View>
            <View style={S.headerActions}>
              {activeSubmission?.mediaType === 'video' ? (
                <Pressable
                  onPress={() => setMuted((prev) => !prev)}
                  style={S.headerIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
                >
                  <VolumeIcon muted={muted} size={20} />
                </Pressable>
              ) : null}
              {activeSubmission && canDeleteActive && onPressOverflow ? (
                <Pressable
                  onPress={onPressOverflow}
                  style={S.headerIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                >
                  <OverflowDotsIcon size={20} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={onDismiss}
                style={S.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Close story"
              >
                <CloseIcon size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {Boolean(activeSubmission?.caption && activeSubmission.caption.trim()) && (
          <View style={S.captionBoxWrap} pointerEvents="none">
            <View style={S.captionBoxInner}>
              <AppText style={S.captionBoxText}>
                {activeSubmission?.caption?.trim()}
              </AppText>
            </View>
          </View>
        )}

        {cta ? (
          activeSlideIndex === 0 ? (
            <Animated.View
              style={[
                S.heroCTAWrap,
                {
                  bottom: insets.bottom + 24,
                  opacity: mountAnim,
                  transform: [
                    {
                      translateY: mountAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Pressable
                onPress={cta.onPress}
                style={({ pressed }) => [
                  S.heroCTA,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={cta.label}
              >
                <AppText style={S.heroCTAText}>{cta.label}</AppText>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={[S.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
              <Pressable
                onPress={cta.onPress}
                style={({ pressed }) => [S.bottomBarBtn, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel={cta.label}
              >
                <AppText style={S.bottomBarBtnText}>{cta.label}</AppText>
              </Pressable>
            </View>
          )
        ) : null}
      </ReanimatedAnimated.View>
    </PanGestureHandler>
  );
}

const S = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 250,
    elevation: 250,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    zIndex: 10,
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    marginBottom: spacing.sm,
  },
  progressBarOuter: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconBtn: {
    padding: spacing.xs,
  },
  captionPrimary: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captionSecondary: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  heroIconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 40,
    lineHeight: 46,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  heroDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
    width: 140,
  },
  heroDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroDesc: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
  },
  heroFootnote: {
    marginTop: spacing.base,
    color: 'rgba(255, 255, 255, 0.62)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  heroCTAWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  tapZone: {
    flex: 1,
  },
  heroCTA: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCTAText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 16,
    color: '#0B0B0C',
  },
  captionBoxWrap: {
    position: 'absolute',
    top: '72%',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 30,
  },
  captionBoxInner: {
    backgroundColor: 'rgba(11, 11, 12, 0.76)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  captionBoxText: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 10,
  },
  bottomBarBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    height: 50,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    width: '100%',
  },
  bottomBarBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
});
