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
  // Not an arbitrary off-screen park: this is where the theme carousel's
  // selected phone sits, so the cross-fade on Next lands one phone exactly
  // where the other was, at the same size, rather than reading as one leaving
  // and another arriving.
  hidden: { translate: 0, scale: 1, opacity: 0, layer: 'cover' },
  cover: { translate: 0, scale: 1, opacity: 1, layer: 'cover' },
  // Each layer composes itself within one screen, so these are shifts of a
  // full-height phone, not offsets into a taller one. Values much past ±0.2
  // push a layer's content out of the viewport entirely — the first version
  // of this table did exactly that, and the phone vanished.
  capture: { translate: -0.06, scale: 1.12, opacity: 1, layer: 'capture' },
  gallery: { translate: -0.14, scale: 1.12, opacity: 1, layer: 'gallery' },
};

interface StageContextValue {
  setStage: (stage: StageName) => void;
  setDraft: (draft: CreationDraft) => void;
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
  const { height: screenHeight } = useWindowDimensions();
  const motion = useMotion();

  const value = useMemo<StageContextValue>(
    () => ({ setStage, setDraft }),
    [],
  );

  const geometry = STAGES[stage];

  // One screen tall. Each layer is a composition that fills it and places its
  // own focus — the viewfinder low, the gallery grid high — so the stage moves
  // the phone rather than scrolling a taller image behind a window.
  const phoneHeight = screenHeight;

  const translate = useSharedValue(STAGES.hidden.translate);
  const scale = useSharedValue(STAGES.hidden.scale);
  const opacity = useSharedValue(STAGES.hidden.opacity);

  const timing = useCallback(
    (): WithTimingConfig => ({
      // One duration for every stage change, so a move the host makes twice
      // never feels like two different animations.
      duration: motion.reduceMotion ? 0 : 620,
      easing: easing.inOut,
    }),
    [motion.reduceMotion],
  );

  useEffect(() => {
    translate.value = withTiming(geometry.translate, timing());
    scale.value = withTiming(geometry.scale, timing());
    opacity.value = withTiming(geometry.opacity, timing());
  }, [geometry, timing, translate, scale, opacity]);

  const phoneStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translate.value * phoneHeight },
      { scale: scale.value },
    ],
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
          <Animated.View style={[S.phone, { height: phoneHeight }, phoneStyle]}>
            {(['cover', 'capture', 'gallery'] as const).map((layer) => (
              <StageLayer key={layer} visible={geometry.layer === layer}>
                {renderLayer(layer, draft)}
              </StageLayer>
            ))}
          </Animated.View>
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
    width: '100%',
    // Anchored at the top so `translateY` alone decides which part of the
    // phone is in view; centring it would make every stage's offset depend on
    // the window height as well as its own intent.
    position: 'absolute',
    top: 0,
  },
  content: { flex: 1 },
});
