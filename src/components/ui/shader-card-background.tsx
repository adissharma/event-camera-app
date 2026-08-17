import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { colours, radii } from '@/design';

const CARD_SHADER_SRC = `
uniform float2 resolution;
uniform float time;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

half4 main(float2 xy) {
  float2 uv = xy / resolution;
  
  // Organic animated flow
  float t = time * 0.32;
  float n1 = noise(uv * 2.6 + float2(t * 0.12, -t * 0.08));
  float n2 = noise(uv * 4.2 - float2(-t * 0.08, t * 0.16));
  float n = mix(n1, n2, 0.5);

  // Warm glowing palette:
  // Deep obsidian base -> Rich velvet wine -> Warm terracotta amber -> Radiant champagne gold
  half3 cBase = half3(0.09, 0.08, 0.11);
  half3 cWine = half3(0.32, 0.11, 0.22);
  half3 cAmber = half3(0.82, 0.38, 0.16);
  half3 cGold = half3(0.96, 0.76, 0.44);

  // Diagonal sweep with organic turbulence
  float diag = (uv.x * 0.65 + uv.y * 0.35) + (n - 0.5) * 0.36;
  diag = clamp(diag, 0.0, 1.0);

  half3 col = cBase;
  if (diag < 0.35) {
    col = mix(cBase, cWine, diag / 0.35);
  } else if (diag < 0.72) {
    col = mix(cWine, cAmber, (diag - 0.35) / 0.37);
  } else {
    col = mix(cAmber, cGold, (diag - 0.72) / 0.28);
  }

  // Soft corner luminous glow in top-right
  float dGlow = length(uv - float2(0.88, 0.15));
  float cornerGlow = max(0.0, 1.0 - dGlow * 1.35);
  col += cGold * half(cornerGlow * cornerGlow * 0.4);

  // Fine analogue grain
  float g = (hash(xy + float2(t * 5.0, t * 8.0)) - 0.5) * 0.032;
  col += half3(g);

  return half4(col, 1.0);
}
`;

const CARD_SHADER = Skia.RuntimeEffect.Make(CARD_SHADER_SRC);

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
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const time = useSharedValue(0);

  useEffect(() => {
    time.value = withRepeat(
      withTiming(100, { duration: 35000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [time]);

  const width = size?.width ?? 0;
  const height = size?.height ?? 0;

  const uniforms = useDerivedValue(() => {
    return {
      resolution: [width || 300, height || 150],
      time: time.value,
    };
  }, [width, height]);

  function handleLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0 && (!size || size.width !== w || size.height !== h)) {
      setSize({ width: w, height: h });
    }
  }

  return (
    <View
      onLayout={handleLayout}
      style={[
        S.container,
        { borderRadius },
        style,
      ]}
    >
      {/* Native Skia Shader Background */}
      {CARD_SHADER && size && size.width > 0 && size.height > 0 ? (
        <Canvas style={[StyleSheet.absoluteFill, { borderRadius }]}>
          <Fill>
            <Shader source={CARD_SHADER} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : (
        <LinearGradient
          colors={['#161215', '#2E1220', '#542022', '#1C1518']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Darkening / Legibility Scrim */}
      <LinearGradient
        colors={['rgba(11,11,12,0.3)', 'rgba(11,11,12,0.72)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Card Content */}
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
