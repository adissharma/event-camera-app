import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/design';

const DASHBOARD_SHADER = Skia.RuntimeEffect.Make(`
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
  float t = time * 0.08;

  float large = noise(uv * 1.08 + float2(t * 0.42, -t * 0.3));
  float broad = noise(uv * 2.15 + float2(t, -t * 0.7));
  float detail = noise(uv * 5.4 - float2(t * 0.55, t * 0.35));
  float vertical = noise(float2(uv.x * 1.35, uv.y * 2.8) + float2(-t * 0.3, t * 0.2));
  float texture = large * 0.48 + broad * 0.27 + detail * 0.14 + vertical * 0.11;
  texture = smoothstep(0.24, 0.78, texture);

  // Let the texture enter from beyond the top-right edge, with a softly
  // shifting boundary that avoids reading as a fixed spotlight.
  float boundaryNoise = noise(uv * 3.0 + float2(t * 0.24, -t * 0.18));
  float2 focusDelta = (uv - float2(0.98, 0.14)) * float2(0.85, 2.25);
  float focusDistance = length(focusDelta);
  float focus = 1.0 - smoothstep(
    0.3 + boundaryNoise * 0.08,
    0.72 + boundaryNoise * 0.1,
    focusDistance
  );
  focus *= smoothstep(0.3, 0.72, uv.x);

  half3 black = half3(0.001, 0.002, 0.003);
  half3 charcoal = half3(0.076, 0.08, 0.086);
  half3 col = mix(black, charcoal, half(focus * (0.04 + texture * 0.88)));

  // Keep animated grain inside the same top-right region.
  float grain = hash(xy * 0.72 + float2(time * 1.7, -time * 1.1)) - 0.5;
  float coarseGrain = hash(xy * 0.31 - float2(time * 0.55, time * 0.4)) - 0.5;
  col += half3((grain * 0.026 + coarseGrain * 0.014) * focus);

  return half4(clamp(col, 0.0, 1.0), 1.0);
}
`);

export function DashboardShaderBackground() {
  const motion = useMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const time = useSharedValue(0);

  useEffect(() => {
    if (motion.reduceMotion) {
      cancelAnimation(time);
      time.value = 0;
      return;
    }

    time.value = withRepeat(
      withTiming(100, { duration: 50_000, easing: Easing.linear }),
      -1,
      false,
    );

    return () => cancelAnimation(time);
  }, [motion.reduceMotion, time]);

  const uniforms = useDerivedValue(() => ({
    resolution: [size.width || 1, size.height || 1],
    time: time.value,
  }), [size.height, size.width]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ width, height });
  }

  return (
    <View pointerEvents="none" onLayout={handleLayout} style={StyleSheet.absoluteFill}>
      {DASHBOARD_SHADER && size.width > 0 && size.height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={DASHBOARD_SHADER} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : null}
    </View>
  );
}
