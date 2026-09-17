import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * Expo Router checks Liquid Glass availability during module initialisation.
 * The App Clip omits ExpoGlassEffect from its native target, so use a safe
 * ordinary-view fallback instead of calling the missing native module.
 */
export function isLiquidGlassAvailable(): false {
  return false;
}

export function isGlassEffectAPIAvailable(): false {
  return false;
}

export function GlassView({ children, ...props }: ViewProps & { children?: ReactNode }) {
  return <View {...props}>{children}</View>;
}

export function GlassContainer({ children, ...props }: ViewProps & { children?: ReactNode }) {
  return <View {...props}>{children}</View>;
}

export default GlassView;
