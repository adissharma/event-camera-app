import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colours, radii } from '@/design';

export interface ShaderCardBackgroundProps {
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  children?: React.ReactNode;
}

export function ShaderCardBackground({
  style,
  borderRadius = radii.xl,
  children,
}: ShaderCardBackgroundProps) {
  return (
    <View
      style={[
        S.container,
        { borderRadius },
        style,
      ]}
    >
      {/* Layered Gradient Background for Web */}
      <LinearGradient
        colors={['#1E1218', '#381628', '#632822', '#22151B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Radial Warm Glow Overlay */}
      <LinearGradient
        colors={['rgba(245, 175, 80, 0.25)', 'rgba(180, 60, 80, 0.12)', 'rgba(0,0,0,0)']}
        start={{ x: 0.85, y: 0.15 }}
        end={{ x: 0.1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Legibility Scrim */}
      <LinearGradient
        colors={['rgba(11,11,12,0.25)', 'rgba(11,11,12,0.72)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      {children}
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colours.surface,
  },
});
