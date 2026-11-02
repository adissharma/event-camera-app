import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;

type Size = { width: number; height: number };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * The host's floor plan, fitted to the space it is given, with pinch to
 * zoom around the fingers, drag to pan, and double-tap to zoom in or back out.
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
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const bounds = (atScale: number) => {
    'worklet';
    return {
      x: Math.max(0, (fittedWidth * atScale - frameWidth) / 2),
      y: Math.max(0, (fittedHeight * atScale - frameHeight) / 2),
    };
  };

  const settle = () => {
    'worklet';
    const nextScale = clamp(scale.value, 1, MAX_SCALE);
    const limit = bounds(nextScale);
    scale.value = withTiming(nextScale);
    x.value = withTiming(clamp(x.value, -limit.x, limit.x));
    y.value = withTiming(clamp(y.value, -limit.y, limit.y));
    savedScale.value = nextScale;
    savedX.value = clamp(x.value, -limit.x, limit.x);
    savedY.value = clamp(y.value, -limit.y, limit.y);
  };

  const pinch = Gesture.Pinch()
    .enabled(interactive)
    .onStart(() => {
      savedScale.value = scale.value;
      savedX.value = x.value;
      savedY.value = y.value;
    })
    .onUpdate((event) => {
      const next = clamp(savedScale.value * event.scale, 0.8, MAX_SCALE);
      const ratio = next / savedScale.value;
      // Keep the point between the fingers fixed while the plan grows.
      const focalX = event.focalX - frameWidth / 2;
      const focalY = event.focalY - frameHeight / 2;
      scale.value = next;
      x.value = focalX - (focalX - savedX.value) * ratio;
      y.value = focalY - (focalY - savedY.value) * ratio;
    })
    .onEnd(settle);

  const pan = Gesture.Pan()
    .enabled(interactive)
    .averageTouches(true)
    .onStart(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    })
    .onUpdate((event) => {
      const limit = bounds(scale.value);
      x.value = clamp(savedX.value + event.translationX, -limit.x, limit.x);
      y.value = clamp(savedY.value + event.translationY, -limit.y, limit.y);
    })
    .onEnd(settle);

  const doubleTap = Gesture.Tap()
    .enabled(interactive)
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1.05) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedScale.value = 1;
        savedX.value = 0;
        savedY.value = 0;
        return;
      }
      const limit = bounds(DOUBLE_TAP_SCALE);
      const nextX = clamp(-(event.x - frameWidth / 2) * (DOUBLE_TAP_SCALE - 1), -limit.x, limit.x);
      const nextY = clamp(-(event.y - frameHeight / 2) * (DOUBLE_TAP_SCALE - 1), -limit.y, limit.y);
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      x.value = withTiming(nextX);
      y.value = withTiming(nextY);
      savedScale.value = DOUBLE_TAP_SCALE;
      savedX.value = nextX;
      savedY.value = nextY;
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

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
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={150}
                onLoad={(event) => setNatural({ width: event.source.width, height: event.source.height })}
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
            {caption || 'Pinch to zoom. Double-tap to zoom in or out.'}
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
