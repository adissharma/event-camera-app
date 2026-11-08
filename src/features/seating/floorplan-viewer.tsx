import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

const MAX_SCALE = 6;
const MIN_PINCH_SCALE = 0.8;

type Size = { width: number; height: number };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * The host's floor plan, fitted to the space it is given. Pinching is the only
 * thing that changes its size; dragging with one finger moves it around.
 *
 * Panning is bounded so the plan can never be dragged off screen, and a pinch
 * below its fitted size springs back rather than leaving a postage stamp.
 */
export function FloorplanViewer({
  uri,
  style,
  interactive = true,
}: {
  uri: string | null;
  style?: StyleProp<ViewStyle>;
  /** False for a still preview inside a scrolling screen, where a drag must scroll. */
  interactive?: boolean;
}) {
  const [frame, setFrame] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);

  // Fitted ("contain") size of the plan inside the frame at scale 1.
  const fitted = frame && natural
    ? (() => {
      const ratio = Math.min(frame.width / natural.width, frame.height / natural.height);
      return { width: natural.width * ratio, height: natural.height * ratio };
    })()
    : null;
  const frameWidth = frame?.width ?? 0;
  const frameHeight = frame?.height ?? 0;
  const fittedWidth = fitted?.width ?? 0;
  const fittedHeight = fitted?.height ?? 0;

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Each gesture keeps its own starting point, so neither can disturb the other.
  const pinchStart = useSharedValue({ scale: 1, x: 0, y: 0, focalX: 0, focalY: 0 });
  const panStart = useSharedValue({ x: 0, y: 0 });

  const bounds = (atScale: number) => {
    'worklet';
    return {
      x: Math.max(0, (fittedWidth * atScale - frameWidth) / 2),
      y: Math.max(0, (fittedHeight * atScale - frameHeight) / 2),
    };
  };

  const pinch = Gesture.Pinch()
    .enabled(interactive)
    .onStart((event) => {
      pinchStart.value = {
        scale: scale.value,
        x: x.value,
        y: y.value,
        focalX: event.focalX - frameWidth / 2,
        focalY: event.focalY - frameHeight / 2,
      };
    })
    .onUpdate((event) => {
      // Once a finger lifts, the focal point jumps to the one left behind.
      if (event.numberOfPointers !== 2) return;
      const start = pinchStart.value;
      const next = clamp(start.scale * event.scale, MIN_PINCH_SCALE, MAX_SCALE);
      const ratio = next / start.scale;
      // The point first pinched stays under the fingers as they move and spread.
      scale.value = next;
      x.value = event.focalX - frameWidth / 2 - (start.focalX - start.x) * ratio;
      y.value = event.focalY - frameHeight / 2 - (start.focalY - start.y) * ratio;
    })
    .onEnd(() => {
      const nextScale = Math.max(scale.value, 1);
      const limit = bounds(nextScale);
      if (nextScale !== scale.value) scale.value = withTiming(nextScale);
      x.value = withTiming(clamp(x.value, -limit.x, limit.x));
      y.value = withTiming(clamp(y.value, -limit.y, limit.y));
    });

  // One finger only, and it only ever moves the plan: reaching an edge stops
  // the drag and leaves the zoom exactly as the guest set it.
  const pan = Gesture.Pan()
    .enabled(interactive)
    .maxPointers(1)
    .onStart(() => {
      panStart.value = { x: x.value, y: y.value };
    })
    .onUpdate((event) => {
      const limit = bounds(scale.value);
      x.value = clamp(panStart.value.x + event.translationX, -limit.x, limit.x);
      y.value = clamp(panStart.value.y + event.translationY, -limit.y, limit.y);
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const planStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setFrame((current) => (current?.width === width && current?.height === height ? current : { width, height }));
  }

  return (
    <View
      style={[styles.frame, style]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={interactive ? 'Seating floor plan. Pinch to zoom.' : 'Seating floor plan'}
    >
      <GestureDetector gesture={gesture}>
        <View style={styles.surface} collapsable={false}>
          {uri ? (
            <Animated.View
              style={[
                fitted ? [styles.paper, { width: fitted.width, height: fitted.height }] : StyleSheet.absoluteFill,
                planStyle,
              ]}
            >
              <Image
                // React Native's own Image rather than expo-image: the App Clip
                // leaves expo-image out, and guests reach this from the join screen.
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                onLoad={(event) =>
                  setNatural({ width: event.nativeEvent.source.width, height: event.nativeEvent.source.height })
                }
              />
            </Animated.View>
          ) : null}
          {!natural ? <ActivityIndicator color={colours.textSecondary} style={styles.spinner} /> : null}
        </View>
      </GestureDetector>
    </View>
  );
}

/**
 * The floor plan on its own, full screen. A modal is a separate native root,
 * so it carries its own gesture root for the viewer's pinch and pan.
 */
export function FloorplanModal({
  visible,
  uri,
  caption,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  /** A line under the plan, e.g. the guest's own table, so they know what to look for. */
  caption?: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
          <AppText variant="titleMedium">Floor plan</AppText>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <CloseIcon size={14} />
          </Pressable>
        </View>
        <FloorplanViewer uri={uri} style={styles.modalViewer} />
        <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <AppText variant="bodySmall" tone="secondary" align="center">
            {caption || 'Pinch to zoom and drag to look around.'}
          </AppText>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: colours.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.base,
  },
  modalViewer: {
    flex: 1,
    marginHorizontal: layout.gutter,
  },
  modalFooter: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  pressed: {
    opacity: 0.8,
  },
  frame: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    backgroundColor: colours.surface,
  },
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    position: 'absolute',
  },
  // Plans are drawn for paper, and a PDF page often has no fill of its own:
  // without this its black lines would vanish into the dark frame.
  paper: {
    backgroundColor: '#FFFFFF',
  },
});
