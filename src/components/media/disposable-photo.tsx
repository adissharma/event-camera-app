import { useEffect, useMemo, useRef, useState } from 'react';
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
  RuntimeShader,
  Shader,
  Skia,
  useImage,
  vec,
} from '@shopify/react-native-skia';

import { AppText } from '@/components/ui/text';
import { buildDisposableRecipe, contrast, compose, exposure, saturation, threshold, warmth } from '@/features/media/disposable-recipe';
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
 * Film response shader.
 *
 * The static colour matrix gets us the broad tonal shape cheaply; this shader
 * adds the analogue character the matrix can't express:
 *
 * - cooler shadows / warmer highlights rather than a global wash
 * - slightly lifted blacks
 * - luma-aware grain that shows more in mids and shadows than clipped whites
 */
const ANALOG_SHADER = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float shadowCool;
uniform float highlightWarmth;
uniform float fade;
uniform float saturationAmount;
uniform float contrastAmount;
uniform float grainIntensity;
uniform float grainScale;
uniform float seed;

half luminance(half3 c) {
  return dot(c, half3(0.2126, 0.7152, 0.0722));
}

half rand(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

half grain(float2 p, float scale, float seed) {
  half g1 = rand(p * scale + float2(seed * 0.73, seed * 1.17));
  half g2 = rand(p * scale * 1.93 + float2(seed * 1.91, seed * 0.41));
  return mix(g1, g2, 0.42);
}

half3 adjustSaturation(half3 c, float amount) {
  half l = luminance(c);
  return mix(half3(l), c, half(amount));
}

half3 adjustContrast(half3 c, float amount) {
  return (c - 0.5) * half(amount) + 0.5;
}

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  half3 color = clamp(src.rgb, 0.0, 1.0);
  half l = luminance(color);

  half shadowMask = 1.0 - smoothstep(0.18, 0.62, l);
  half highlightMask = smoothstep(0.54, 0.94, l);
  half midMask = 1.0 - abs(l * 2.0 - 1.0);

  color = adjustSaturation(color, saturationAmount);
  color = adjustContrast(color, contrastAmount);

  color.r += half(highlightWarmth) * highlightMask;
  color.g += half(highlightWarmth) * 0.42 * highlightMask;
  color.b -= half(highlightWarmth) * 0.55 * highlightMask;

  color.r -= half(shadowCool) * 0.18 * shadowMask;
  color.g += half(shadowCool) * 0.04 * shadowMask;
  color.b += half(shadowCool) * shadowMask;

  half3 fadedBlack = half3(fade * 1.15, fade * 1.08, fade);
  color = mix(color, max(color, fadedBlack), min(0.9, fade * 6.0) * shadowMask);

  half grainValue = grain(xy, grainScale, seed) - 0.5;
  half grainAmount = half(grainIntensity) * (0.72 + shadowMask * 0.35 + midMask * 0.18);
  color += grainValue * grainAmount;

  return half4(clamp(color, 0.0, 1.0), src.a);
}
`)!;

/**
 * Grain granularity, in device pixels. Slightly coarser than one pixel —
 * true 1px noise reads as digital sensor noise, and real film grain clumps.
 */
const GRAIN_SCALE = 0.9;

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
  /** Called once the layered render is ready to be captured/exported. */
  onReady?: () => void;
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
  onReady,
}: DisposablePhotoProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const readyRef = useRef(false);

  const recipe = useMemo(() => buildDisposableRecipe(seedKey), [seedKey]);

  const skiaSource = toSkiaSource(source);
  const image = useImage(skiaSource ?? '');
  // Hooks cannot be called conditionally, so the chosen variant is always
  // loaded and simply left undrawn when the recipe omits that layer.
  const dust = useImage(DUST_TEXTURES[recipe.dust?.variant ?? 0]);
  const scratches = useImage(SCRATCH_TEXTURES[recipe.scratches?.variant ?? 0]);

  useEffect(() => {
    readyRef.current = false;
  }, [skiaSource, seedKey, compact]);

  useEffect(() => {
    const layersReady = Boolean(image) && (compact || (Boolean(dust) && Boolean(scratches)));
    if (!readyRef.current && layersReady && size) {
      readyRef.current = true;
      onReady?.();
    }
  }, [compact, dust, image, onReady, scratches, size]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    readyRef.current = false;
    setSize((current) =>
      current && current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }

  const ready = image !== null && size !== null && size.width > 0 && size.height > 0;

  const analogUniforms = useMemo(
    () => ({
      shadowCool: recipe.shadowCool,
      highlightWarmth: recipe.highlightWarmth,
      fade: recipe.fade,
      saturationAmount: recipe.saturation,
      contrastAmount: recipe.contrast,
      grainIntensity: compact ? recipe.grainIntensity * 0.35 : recipe.grainIntensity,
      grainScale: PixelRatio.get() * GRAIN_SCALE * recipe.grainScale,
      seed: recipe.grainSeed,
    }),
    [
      compact,
      recipe.contrast,
      recipe.fade,
      recipe.grainIntensity,
      recipe.grainScale,
      recipe.grainSeed,
      recipe.highlightWarmth,
      recipe.saturation,
      recipe.shadowCool,
    ],
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

  const edgeBurnVectors = useMemo(() => {
    if (!size || !recipe.edgeBurn) return null;
    const { width, height } = size;
    return recipe.edgeBurn.side === 'left'
      ? {
          start: vec(0, height * 0.5),
          end: vec(width * recipe.edgeBurn.width, height * 0.5),
        }
      : {
          start: vec(width, height * 0.5),
          end: vec(width * (1 - recipe.edgeBurn.width), height * 0.5),
        };
  }, [size, recipe.edgeBurn]);

  const halationMatrix = useMemo(
    () =>
      [
        threshold(0.62),
        exposure(1.18),
        warmth(0.18),
        saturation(0.88),
        contrast(1.28),
      ].reduce(compose),
    [],
  );

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
          {/* 1. Emulsion: base tone curve, split-toning and grain. */}
          <Group
            layer={
              <Paint>
                <RuntimeShader source={ANALOG_SHADER} uniforms={analogUniforms}>
                  <ColorMatrix matrix={recipe.colorMatrix} />
                </RuntimeShader>
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

          {/* 2. Very slight optical softness. */}
          <Group
            opacity={0.18}
            blendMode="screen"
            layer={
              <Paint>
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

          {/* 3. Highlight bloom / halation. */}
          {!compact && (
            <Group
              opacity={recipe.halation.opacity}
              blendMode="screen"
              layer={
                <Paint>
                  <Blur blur={recipe.halation.blurRadius} />
                  <ColorMatrix matrix={halationMatrix} />
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
          )}

          {/* 4. Lens vignette — an actual radial falloff. */}
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <RadialGradient
              c={vec(size.width / 2, size.height / 2)}
              r={Math.hypot(size.width, size.height) / 2}
              colors={[
                `rgba(${recipe.vignette.colour}, 0)`,
                `rgba(${recipe.vignette.colour}, ${recipe.vignette.opacity})`,
              ]}
              positions={[recipe.vignette.innerStop, 1]}
            />
          </Rect>

          {/* 5. Gate/edge burn. */}
          {!compact && recipe.edgeBurn && edgeBurnVectors && (
            <Rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              blendMode="multiply"
            >
              <LinearGradient
                start={edgeBurnVectors.start}
                end={edgeBurnVectors.end}
                colors={[
                  `rgba(${recipe.edgeBurn.colour}, ${recipe.edgeBurn.opacity})`,
                  'rgba(0, 0, 0, 0)',
                ]}
              />
            </Rect>
          )}

          {/* 6. Light that leaked onto the film. Only on some frames. */}
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

          {/* 7. A second, coarser grain pass to break up the digital regularity. */}
          {!compact && (
            <Rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              opacity={recipe.grainIntensity * 0.4}
              blendMode="softLight"
            >
              <Shader
                source={GRAIN_SHADER}
                uniforms={{
                  resolution: [size.width, size.height],
                  seed: recipe.grainSeed * 1.7,
                  scale: PixelRatio.get() * recipe.grainScale * 0.42,
                }}
              />
            </Rect>
          )}

          {/* 8. Debris on the film surface. */}
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
