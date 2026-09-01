import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { colours, layout, radii, spacing } from '@/design';
import { AppText } from '@/components/ui/text';

const THUMB_SIZE = 48;

export function SlideToConfirm({
  label,
  disabled = false,
  onComplete,
}: {
  label: string;
  disabled?: boolean;
  onComplete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    disabledRef.current = disabled;
  }, [disabled, onComplete]);

  const maximum = Math.max(0, trackWidth - THUMB_SIZE - spacing.xs * 2);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(0, Math.min(gesture.dx, maximum)));
        },
        onPanResponderRelease: (_, gesture) => {
          const didComplete = maximum > 0 && gesture.dx >= maximum * 0.88;
          if (didComplete) {
            Animated.timing(translateX, {
              toValue: maximum,
              duration: 120,
              useNativeDriver: true,
            }).start(() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onCompleteRef.current();
            });
            return;
          }
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [maximum, translateX],
  );

  function onLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Slide all the way to the right to confirm"
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={onLayout}
    >
      <AppText variant="labelLarge" style={styles.label} pointerEvents="none">
        {label}
      </AppText>
      <Animated.View
        {...responder.panHandlers}
        style={[styles.thumb, { transform: [{ translateX }] }]}
      >
        <AppText variant="heading" style={styles.arrow}>→</AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 64,
    backgroundColor: colours.surfaceMuted,
    borderColor: colours.error,
    borderWidth: layout.hairline,
    borderRadius: radii.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackDisabled: { opacity: 0.55 },
  label: {
    color: colours.textPrimary,
    textAlign: 'center',
    paddingHorizontal: THUMB_SIZE + spacing.base,
  },
  thumb: {
    position: 'absolute',
    left: spacing.xs,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.md,
    backgroundColor: colours.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: colours.background },
});
