/**
 * The persistent phone.
 *
 * Creation used to show three unrelated visuals — a phone frame on the theme
 * step, a cropped viewfinder slice on the capture step, a row of floating
 * tiles on the reveal step — so each step read as its own page. This is the
 * one phone that survives all of them: mounted above the navigator, never
 * unmounted between steps, moved and re-pointed as the host progresses.
 *
 * ── How a step drives it ──
 *
 * A step calls `useStage('capture')` and nothing else. The stage owns the
 * geometry and the cross-fade; a step owns its own controls. That split is
 * what keeps the steps maintainable while the phone stays continuous — a step
 * cannot accidentally remount the phone, because it never renders one.
 *
 * ── Why it lives above the Stack ──
 *
 * expo-router unmounts a screen when it leaves. Anything rendered inside a
 * step is therefore destroyed on navigation, which is exactly the flash this
 * exists to prevent. Mounted in `create/_layout`, it outlives every step in
 * the flow and is torn down only when the host leaves creation entirely.
 *
 * ── Adding the next step ──
 *
 * The filters step continues this journey: same phone, same gallery, treatment
 * applied to the photos already on screen. Add a `STAGES` entry with its
 * geometry and, if it needs different content, a layer — nothing here needs
 * restructuring for it, which is the point of holding the layers as a set
 * rather than as a sequence.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { colours, easing, useMotion } from '@/design';
import {
  canonicalDeviceWidth,
  DeviceFrame,
  DEVICE_ASPECT_RATIO,
} from '@/components/media/device-frame';
import type { CreationDraft } from '@/features/celebrations/draft/types';

/**
 * Where the phone sits, and which part of it the host is looking at.
 *
 * `hidden` is a real stage, not an absence: steps before and after this
 * sequence must be able to take the phone off screen without unmounting it,
 * or returning to the sequence would remount and flash.
 */
export type StageName = 'hidden' | 'cover' | 'capture' | 'gallery';

interface StageGeometry {
  /**
   * Fraction of the phone's own height to shift it by. Negative moves the
   * phone up, which brings a lower part of its screen into the visible band —
   * "the camera pans along the phone", rather than the phone shrinking away.
   */
  translate: number;
  scale: number;
  opacity: number;
  /** Opaque crop above/below the phone, expressed as screen fractions. */
  cropTop: number;
  cropBottom: number;
  /** Which content the phone is showing at this stage. */
  layer: 'cover' | 'capture' | 'gallery';
}

/**
 * The stages, as positions on one continuous move rather than as three
 * separate compositions.
 *
 * `cover` shows the whole phone. `capture` steps in and drops to the lower
 * viewfinder, where the shot counter lives. `gallery` rises to the middle of
 * the phone, where the grid is. Read down the `translate` column and the
 * movement is a single pan with two stops on it.
 */
const STAGES: Record<StageName, StageGeometry> = {
  // `hidden` parks the mounted phone for creation steps outside this visual
  // sequence. The cover step itself uses `cover`; it never renders a second
  // frame that would need a hand-off.
  hidden: { translate: 0, scale: 1, opacity: 0, cropTop: 0, cropBottom: 1, layer: 'cover' },
  cover: { translate: 0, scale: 1, opacity: 1, cropTop: 0, cropBottom: 1, layer: 'cover' },
  // Each layer composes itself within one screen, so these are shifts of a
  // full-height phone, not offsets into a taller one. Values much past ±0.2
  // push a layer's content out of the viewport entirely — the first version
  // of this table did exactly that, and the phone vanished.
  capture: {
    translate: -0.05,
    scale: 1.12,
    opacity: 1,
    cropTop: 0.31,
    cropBottom: 0.62,
    layer: 'capture',
  },
  gallery: {
    translate: -0.14,
    scale: 1.12,
    opacity: 1,
    cropTop: 0.19,
    cropBottom: 0.54,
    layer: 'gallery',
  },
};

interface StageContextValue {
  setStage: (stage: StageName) => void;
  setDraft: (draft: CreationDraft) => void;
  transitionDuration: number;
}

const StageContext = createContext<StageContextValue | null>(null);

/**
 * Point the phone at a stage for as long as this screen is mounted.
 *
 * Deliberately not tied to focus: a step that is animating out has already
 * handed the next stage over, and re-asserting its own on blur would drag the
 * phone backwards mid-transition.
 */
export function useStage(stage: StageName): void {
  const context = useContext(StageContext);

  useEffect(() => {
    context?.setStage(stage);
  }, [context, stage]);
}

/** Keeps the phone showing the host's actual choices, not demo content. */
export function useStageDraft(draft: CreationDraft): void {
  const context = useContext(StageContext);

  useEffect(() => {
    context?.setDraft(draft);
  }, [context, draft]);
}

/** Used by the creation chrome to sequence its UI around the phone move. */
export function usePreviewStage(): StageContextValue | null {
  return useContext(StageContext);
}

export function PreviewStageProvider({
  children,
  renderLayer,
}: {
  children: ReactNode;
  /**
   * Draws a layer's content. Injected rather than imported so this module
   * stays free of the screens it serves — and so a layer can be swapped
   * without touching the geometry that moves it.
   */
  renderLayer: (layer: StageGeometry['layer'], draft: CreationDraft | null) => ReactNode;
}) {
  const [stage, setStage] = useState<StageName>('hidden');
  const [draft, setDraft] = useState<CreationDraft | null>(null);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const motion = useMotion();

  const transitionDuration = motion.duration('emotional');

  const value = useMemo<StageContextValue>(
    () => ({ setStage, setDraft, transitionDuration }),
    [transitionDuration],
  );

  const geometry = STAGES[stage];

  // The frame is sized once from the viewport and reused for every layer.
  const phoneWidth = canonicalDeviceWidth(screenWidth, screenHeight);
  const phoneHeight = phoneWidth * DEVICE_ASPECT_RATIO;
  const phoneTop = screenHeight * 0.2;

  const translate = useSharedValue(STAGES.hidden.translate);
  const scale = useSharedValue(STAGES.hidden.scale);
  const opacity = useSharedValue(STAGES.hidden.opacity);
  const cropTop = useSharedValue(STAGES.hidden.cropTop);
  const cropBottom = useSharedValue(STAGES.hidden.cropBottom);

  const timing = useCallback(
    (): WithTimingConfig => ({
      // One duration for every stage change, so a move the host makes twice
      // never feels like two different animations.
      duration: transitionDuration,
      easing: easing.inOut,
    }),
    [transitionDuration],
  );

  useEffect(() => {
    translate.value = withTiming(geometry.translate, timing());
    scale.value = withTiming(geometry.scale, timing());
    opacity.value = withTiming(geometry.opacity, timing());
    cropTop.value = withTiming(geometry.cropTop, timing());
    cropBottom.value = withTiming(geometry.cropBottom, timing());
  }, [geometry, timing, translate, scale, opacity, cropTop, cropBottom]);

  const phoneStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translate.value * phoneHeight },
      { scale: scale.value },
    ],
  }));

  const topMaskStyle = useAnimatedStyle(() => ({
    height: cropTop.value * screenHeight,
    opacity: cropTop.value > 0 ? 1 : 0,
  }));
  const bottomMaskStyle = useAnimatedStyle(() => ({
    top: cropBottom.value * screenHeight,
    opacity: cropBottom.value < 1 ? 1 : 0,
  }));

  return (
    <StageContext.Provider value={value}>
      <View style={S.root}>
        {/*
          Behind the steps, and inert. The host interacts with the controls a
          step renders; the phone is what those controls are describing, not
          another thing to press.
        */}
        <View style={S.stageLayer} pointerEvents="none">
          <Animated.View
            style={[S.phone, { top: phoneTop, width: phoneWidth, height: phoneHeight }, phoneStyle]}
          >
            <DeviceFrame width={phoneWidth}>
              {(['cover', 'capture', 'gallery'] as const).map((layer) => (
                <StageLayer key={layer} visible={geometry.layer === layer}>
                  {renderLayer(layer, draft)}
                </StageLayer>
              ))}
            </DeviceFrame>
          </Animated.View>
          <Animated.View style={[S.topMask, topMaskStyle]} />
          <Animated.View style={[S.bottomMask, bottomMaskStyle]} />
        </View>

        <View style={S.content}>{children}</View>
      </View>
    </StageContext.Provider>
  );
}

/**
 * One content layer, cross-fading rather than switching.
 *
 * All three stay mounted. Unmounting the outgoing one would drop its images
 * and re-decode them on the way back, which is visible as a flash inside a
 * phone that is meant to be the one thing that never flashes.
 */
function StageLayer({ visible, children }: { visible: boolean; children: ReactNode }) {
  const motion = useMotion();
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      // Shorter than the move, so the new content has arrived by the time the
      // phone settles rather than still resolving after it stops.
      duration: motion.reduceMotion ? 0 : 420,
      easing: easing.inOut,
    });
  }, [visible, opacity, motion.reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },
  stageLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  phone: {
    position: 'absolute',
  },
  topMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colours.background,
  },
  bottomMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colours.background,
  },
  content: { flex: 1 },
});
