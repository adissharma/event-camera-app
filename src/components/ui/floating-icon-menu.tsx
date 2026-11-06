import { useEffect, type ComponentType } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colours, easing, radii, spacing, useMotion } from '@/design';

export interface FloatingIconMenuProps<Value extends string> {
  options: readonly {
    value: Value;
    /** Read out by VoiceOver: the option itself shows only its icon. */
    label: string;
    icon: ComponentType<{ size?: number; color?: string }>;
  }[];
  value: Value;
  onChange: (value: Value) => void;
}

/** The menu's full height, for screens that keep content clear of it. */
export const FLOATING_ICON_MENU_HEIGHT = 64;

const PADDING = 5;
const OPTION_HEIGHT = FLOATING_ICON_MENU_HEIGHT - PADDING * 2;
const OPTION_WIDTH = 76;
const GAP = spacing.xxs;
const ICON_SIZE = 28;
const ICON_ACTIVE = '#FFFFFF';
const ICON_INACTIVE = 'rgba(255, 255, 255, 0.6)';
/** iOS 26's own material. Anything older gets the flat pill instead. */
const HAS_LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

function MenuOption({
  label,
  icon: Icon,
  selected,
  onPress,
}: {
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  selected: boolean;
  onPress: () => void;
}) {
  const motion = useMotion();
  const durationMs = motion.duration('standard');
  const highlight = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    highlight.value = withTiming(selected ? 1 : 0, {
      duration: durationMs,
      easing: easing.standard,
    });
  }, [durationMs, highlight, selected]);

  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlight.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={S.option}
    >
      <Animated.View style={[S.highlight, highlightStyle]} />
      <Icon size={ICON_SIZE} color={selected ? ICON_ACTIVE : ICON_INACTIVE} />
    </Pressable>
  );
}

/**
 * One Liquid Glass container holding a screen's views as icons. The warping at its
 * edges is the system refracting whatever is behind it, and the options sit inside
 * the glass so that it responds to touch.
 *
 * The active option's highlight fades in where it sits rather than sliding along
 * a track. A sliding segment reads as swipeable tabs, which would be mistaken for
 * the paging on the screens this floats over. The parent positions it.
 */
export function FloatingIconMenu<Value extends string>({
  options,
  value,
  onChange,
}: FloatingIconMenuProps<Value>) {
  const width =
    options.length * OPTION_WIDTH + (options.length - 1) * GAP + PADDING * 2;

  return (
    <GlassView
      glassEffectStyle="clear"
      colorScheme="dark"
      isInteractive
      style={[S.menu, !HAS_LIQUID_GLASS && S.menuFallback, { width }]}
    >
      {options.map((option) => (
        <MenuOption
          key={option.value}
          label={option.label}
          icon={option.icon}
          selected={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </GlassView>
  );
}

const S = StyleSheet.create({
  menu: {
    flexDirection: 'row',
    gap: GAP,
    height: FLOATING_ICON_MENU_HEIGHT,
    padding: PADDING,
    borderRadius: FLOATING_ICON_MENU_HEIGHT / 2,
  },
  menuFallback: {
    backgroundColor: colours.surfaceRaised,
  },
  option: {
    width: OPTION_WIDTH,
    height: OPTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
