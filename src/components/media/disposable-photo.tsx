import { useMemo, useState } from 'react';
import {
  Image as RNImage,
  PixelRatio,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Blur,
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  LinearGradient,
  Paint,
  RadialGradient,
  Rect,
  Shader,
  Skia,
  useImage,
  vec,
} from '@shopify/react-native-skia';

import { AppText } from '@/components/ui/text';
import { buildDisposableRecipe } from '@/features/media/disposable-recipe';
import { formatDisposableDateStamp } from '@/features/media/photo-treatment';

const DUST_TEXTURES = [
  require('../../../assets/images/textures/dust-1.png'),
  require('../../../assets/images/textures/dust-2.png'),
];

const SCRATCH_TEXTURES = [
  require('../../../assets/images/textures/scratches-1.png'),
  require('../../../assets/images/textures/scratches-2.png'),
];

/**
 * Procedural film grain.
 *
 * Generated per-pixel in the shader rather than sampled from a texture. A
 * static noise PNG — which is what this replaced — has to be stretched to
 * whatever size the container happens to be, so it resamples into soft
 * blotches, repeats the identical pattern on every photo, and changes
 * apparent grain size between a grid cell and a full-screen viewer. A shader
 * has none of those problems: the noise is evaluated at the device's own
 * pixel grid, at the same physical size everywhere, and `seed` gives every
 * photo its own field.
 *
 * Returns mid-grey-centred noise so it can be composited with an `overlay`
 * blend, where exactly 0.5 is a no-op — deviations lighten and darken by
 * equal measure instead of fogging the image the way an additive layer does.
 */
const GRAIN_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float seed;
uniform float scale;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

half4 main(float2 xy) {
  float n = hash(xy * scale + float2(seed, seed * 1.7));
  return half4(half3(n), 1.0);
}
`)!;

/**
 * Grain granularity, in device pixels. Slightly coarser than one pixel —
 * true 1px noise reads as digital sensor noise, and real film grain clumps.
 */
const GRAIN_SCALE = 0.8;

export interface DisposablePhotoProps {
  source: ImageSourcePropType;
  /**
   * Stable, per-photo identity. Drives the randomiser, so it must not change
   * between renders of the same photo — a signed URL is a poor choice since
   * it is re-issued on expiry; a media item id is ideal.
   */
  seedKey: string;
  dateStampEnabled?: boolean;
  capturedAt?: string | null;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  /**
   * Skip the heavier layers (grain, leak, dust, scratches) on small
   * surfaces where they cannot be seen anyway. Colour and vignette stay.
   */
  compact?: boolean;
}

/** Skia's `useImage` wants a URL string or a bundled asset, not an RN source object. */
function toSkiaSource(source: ImageSourcePropType): string | number | null {
  if (typeof source === 'number') return source;
  if (Array.isArray(source)) return source[0]?.uri ?? null;
  if (source && typeof source === 'object' && 'uri' in source) return source.uri ?? null;
  return null;
}

/**
 * The disposable-camera treatment, composited on a Skia canvas.
 *
 * Layer order matters and mirrors how a real frame is formed: the emulsion's
 * colour response and softness first, then the lens vignette, then light that
 * leaked onto the film, and only then the physical debris — grain in the
 * emulsion, dust and scratches on the surface.
 *
 * Every value that varies comes from `buildDisposableRecipe(seedKey)`, which
 * is deterministic, so a photo looks the same on every render while differing
 * from the photo beside it.
 */
export function DisposablePhoto({
  source,
  seedKey,
  dateStampEnabled = true,
  capturedAt,
  style,
  resizeMode = 'cover',
  compact = false,
}: DisposablePhotoProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const recipe = useMemo(() => buildDisposableRecipe(seedKey), [seedKey]);

  const skiaSource = toSkiaSource(source);
  const image = useImage(skiaSource ?? '');
  // Hooks cannot be called conditionally, so the chosen variant is always
  // loaded and simply left undrawn when the recipe omits that layer.
  const dust = useImage(DUST_TEXTURES[recipe.dust?.variant ?? 0]);
  const scratches = useImage(SCRATCH_TEXTURES[recipe.scratches?.variant ?? 0]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current && current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }

  const ready = image !== null && size !== null && size.width > 0 && size.height > 0;

  const grainUniforms = useMemo(
    () => ({
      resolution: [size?.width ?? 1, size?.height ?? 1],
      seed: recipe.grainSeed,
      scale: PixelRatio.get() * GRAIN_SCALE,
    }),
    [size?.width, size?.height, recipe.grainSeed],
  );

  const leakVectors = useMemo(() => {
    if (!size || !recipe.lightLeak) return null;
    const { width, height } = size;
    // Leaks enter from a corner and fall off toward the middle of the frame.
    const corners = [
      { start: vec(0, 0), end: vec(width * 0.75, height * 0.7) },
      { start: vec(width, 0), end: vec(width * 0.25, height * 0.7) },
      { start: vec(0, height), end: vec(width * 0.75, height * 0.3) },
      { start: vec(width, height), end: vec(width * 0.25, height * 0.3) },
    ];
    return corners[recipe.lightLeak.corner];
  }, [size, recipe.lightLeak]);

  const dateStampSize = size ? Math.max(9, Math.min(22, size.width * 0.055)) : 11;

  return (
    <View style={style} onLayout={handleLayout}>
      {/*
        Always mounted underneath the canvas. Skia's image decode is async, so
        without this the cell would be empty for a frame or two on every
        scroll — and empty-until-loaded is exactly the blank-photo failure
        this whole component replaced. It simply gets covered once ready.
      */}
      <RNImage source={source} style={StyleSheet.absoluteFill} resizeMode={resizeMode} />

      {ready && size && (
        <Canvas style={StyleSheet.absoluteFill}>
          {/* 1. Emulsion: colour response, and a touch of softness. */}
          <Group
            layer={
              <Paint>
                <ColorMatrix matrix={recipe.colorMatrix} />
                <Blur blur={recipe.blurRadius} />
              </Paint>
            }
          >
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fit={resizeMode === 'contain' ? 'contain' : 'cover'}
            />
          </Group>

          {/* 2. Lens vignette — an actual radial falloff. */}
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <RadialGradient
              c={vec(size.width / 2, size.height / 2)}
              r={Math.hypot(size.width, size.height) / 2}
              colors={['rgba(28, 14, 6, 0)', `rgba(28, 14, 6, ${recipe.vignette.opacity})`]}
              positions={[recipe.vignette.innerStop, 1]}
            />
          </Rect>

          {/* 3. Light that leaked onto the film. Only on some frames. */}
          {!compact && recipe.lightLeak && leakVectors && (
            <Rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              blendMode="screen"
            >
              <LinearGradient
                start={leakVectors.start}
                end={leakVectors.end}
                colors={[
                  `rgba(${recipe.lightLeak.colour}, ${recipe.lightLeak.strength})`,
                  `rgba(${recipe.lightLeak.colour}, 0)`,
                ]}
              />
            </Rect>
          )}

          {/* 4. Grain in the emulsion. */}
          {!compact && (
            <Rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              opacity={recipe.grainIntensity}
              blendMode="overlay"
            >
              <Shader source={GRAIN_SHADER} uniforms={grainUniforms} />
            </Rect>
          )}

          {/* 5. Debris on the film surface. */}
          {!compact && recipe.dust && dust && (
            <SkiaImage
              image={dust}
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fit="cover"
              opacity={recipe.dust.opacity}
              blendMode="screen"
            />
          )}
          {!compact && recipe.scratches && scratches && (
            <SkiaImage
              image={scratches}
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fit="cover"
              opacity={recipe.scratches.opacity}
              blendMode="screen"
            />
          )}
        </Canvas>
      )}

      {dateStampEnabled && !compact && (
        <View style={styles.dateStampContainer} pointerEvents="none">
          {/* Scales with the render surface, so it reads the same relative
              size in a grid cell as it does full screen. */}
          <AppText style={[styles.dateStampText, { fontSize: dateStampSize }]}>
            {formatDisposableDateStamp(capturedAt ? new Date(capturedAt) : new Date())}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dateStampContainer: {
    position: 'absolute',
    bottom: '3%',
    right: '4%',
  },
  dateStampText: {
    fontFamily: 'monospace',
    color: '#ff8c2b',
    fontWeight: '700',
    textShadowColor: 'rgba(120, 40, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
