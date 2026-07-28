import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type View as RNView,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colours, elevation, layout, pressScale, radii, spacing, useMotion } from '@/design';
import { AppText } from './text';

type Variant = 'primary' | 'secondary' | 'quiet' | 'destructive';
type Size = 'large' | 'medium' | 'small';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Rendered before the label. Keep to a single small icon. */
  leading?: React.ReactNode;
  fullWidth?: boolean;
  /** Fires selection haptics on press. Off for navigation, on for commitment. */
  haptic?: boolean;
  style?: ViewStyle;
  /**
   * Why the button is unavailable. When `disabled` is set this is announced to
   * screen readers and should also be shown visibly next to the control — a
   * disabled Next with no explanation is a dead end.
   */
  disabledReason?: string;
}

const heightForSize: Record<Size, number> = {
  large: 56,
  medium: 48,
  small: layout.minTouchTarget,
};

const paddingForSize: Record<Size, number> = {
  large: spacing.xl,
  medium: spacing.lg,
  small: spacing.base,
};

export const Button = forwardRef<RNView, ButtonProps>(function Button(
  {
    label,
    variant = 'primary',
    size = 'large',
    loading = false,
    leading,
    fullWidth = true,
    haptic = false,
    disabled,
    disabledReason,
    style,
    onPressIn,
    onPressOut,
    onPress,
    ...rest
  },
  ref,
) {
  const motion = useMotion();
  const scale = useSharedValue(1);
  const isInactive = Boolean(disabled) || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const container: ViewStyle = {
    height: heightForSize[size],
    minHeight: layout.minTouchTarget,
    paddingHorizontal: paddingForSize[size],
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: isInactive ? 0.45 : 1,
    ...variantStyle(variant),
  };

  return (
    <Animated.View style={[animatedStyle, fullWidth ? { alignSelf: 'stretch' } : null]}>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ disabled: isInactive, busy: loading }}
        accessibilityHint={isInactive ? disabledReason : undefined}
        disabled={isInactive}
        onPressIn={(event) => {
          scale.value = withTiming(pressScale, { duration: motion.duration('microFast') });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withTiming(1, { duration: motion.duration('micro') });
          onPressOut?.(event);
        }}
        onPress={(event) => {
          if (haptic) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress?.(event);
        }}
        style={[container, style]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? colours.textOnBrand : colours.brandPrimary}
          />
        ) : (
          <>
            {leading ? <View>{leading}</View> : null}
            <AppText variant="button" tone={labelTone(variant)}>
              {label}
            </AppText>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
});

function variantStyle(variant: Variant): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colours.brandPrimary, ...elevation.low };
    case 'secondary':
      return {
        backgroundColor: colours.surface,
        borderWidth: layout.hairline,
        borderColor: colours.borderStrong,
      };
    case 'quiet':
      return { backgroundColor: 'transparent' };
    case 'destructive':
      return {
        backgroundColor: colours.surface,
        borderWidth: layout.hairline,
        borderColor: colours.error,
      };
  }
}

function labelTone(variant: Variant): NonNullable<React.ComponentProps<typeof AppText>['tone']> {
  switch (variant) {
    case 'primary':
      return 'onBrand';
    case 'destructive':
      return 'error';
    default:
      return 'brand';
  }
}
