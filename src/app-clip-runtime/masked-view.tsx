import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * Expo Router's header package imports MaskedView even when every Clip header
 * is disabled. Keep that dormant path render-safe without linking its native
 * view manager into the Clip.
 */
export default function AppClipMaskedView({
  children,
  maskElement: _maskElement,
  ...props
}: ViewProps & { children?: ReactNode; maskElement?: ReactNode }) {
  return <View {...props}>{children}</View>;
}
