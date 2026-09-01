import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/text';
import { colours, elevation, layout, radii, spacing, useMotion } from '@/design';

/**
 * A transient confirmation, anchored above the safe area.
 *
 * Uses the app's raised-surface treatment — the same dark card + hairline the
 * sheets and cards use — rather than an inverted light slab. The first version
 * of this set its background to `colours.textPrimary` (ivory) and its label to
 * pure white, which is a contrast ratio of roughly 1.05:1: not merely
 * off-theme but effectively unreadable.
 *
 * Rendered by the screen that owns the action, so the message can carry an
 * undo that acts on that screen's own state.
 */
export interface ToastProps {
  /** Null hides it. Changing the message restarts the entry animation. */
  message: string | null;
  action?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
}

export function Toast({ message, action }: ToastProps) {
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const progress = useRef(new Animated.Value(0)).current;

  /**
   * Kept mounted until the exit animation finishes.
   *
   * Unmounting the moment `message` goes null cut the fade-out off before its
   * first frame, so the toast vanished rather than leaving.
   */
  const [rendered, setRendered] = useState(Boolean(message));

  /**
   * The last non-null message, so the copy does not blank out mid-fade while
   * the caller has already cleared it.
   */
  const shownMessage = useRef(message);
  if (message) shownMessage.current = message;

  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const exitMs = motion.duration('standardFast');

    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    if (message) setRendered(true);

    Animated.timing(progress, {
      toValue: message ? 1 : 0,
      duration: exitMs,
      useNativeDriver: true,
    }).start();

    // Unmount on a timer rather than the animation's completion callback:
    // under react-native-web that callback does not reliably fire, which left
    // the toast mounted at zero opacity — invisible, but still an absolutely
    // positioned node sitting over the bottom of the screen.
    if (!message) {
      unmountTimerRef.current = setTimeout(() => setRendered(false), exitMs);
    }

    return () => {
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, [message, progress, motion]);

  if (!rendered) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        S.toast,
        { bottom: insets.bottom + spacing.lg },
        {
          opacity: progress,
          transform: [
            {
              // Rises into place. Collapses to no travel under reduce-motion,
              // where the fade alone still reports that something arrived.
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [motion.translate(12), 0],
              }),
            },
          ],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <AppText variant="bodySmall" style={S.text}>
        {shownMessage.current}
      </AppText>

      {action && message ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          disabled={action.disabled}
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => [pressed && S.actionPressed, action.disabled && S.actionDisabled]}
        >
          <AppText variant="label" tone="brand">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const S = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    minHeight: 54,
    borderRadius: radii.lg,
    backgroundColor: colours.surfaceRaised,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...elevation.medium,
  },
  text: {
    flex: 1,
    color: colours.textPrimary,
    lineHeight: 18,
  },
  actionPressed: { opacity: 0.7 },
  actionDisabled: { opacity: 0.45 },
});
