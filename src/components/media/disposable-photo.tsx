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
import { Canvas, Image as SkiaImage, Picture, type SkImage } from '@shopify/react-native-skia';

import {
  getDisposableRender,
  loadSourceImage,
  peekAnyRenderFor,
  peekSourceImage,
} from '@/features/media/disposable-cache';
import { formatDisposableDateStamp } from '@/features/media/disposable-date-stamp';
import { recordDisposablePicture } from '@/features/media/disposable-paint';
import { buildDisposableRecipe } from '@/features/media/disposable-recipe';
import { decideRenderSize, resizeTransformScale } from '@/features/media/disposable-resize';

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
   * Skip the layers that cannot be seen on a small surface — dust, scratches,
   * light leaks. Tone, colour, grain and vignette still apply, so a grid cell
   * still previews the look.
   */
  compact?: boolean;
  /** Called once the render is complete enough to be captured/exported. */
  onReady?: () => void;
}

/** Skia wants a URL string or a bundled asset, not an RN source object. */
function toSkiaSource(source: ImageSourcePropType): string | number | null {
  if (typeof source === 'number') return source;
  if (Array.isArray(source)) return source[0]?.uri ?? null;
  if (source && typeof source === 'object' && 'uri' in source) return source.uri ?? null;
  return null;
}

/**
 * The decoded source image, shared with every other surface showing the same
 * photo.
 *
 * Replaces react-native-skia's `useImage`, which caches nothing: under it, a
 * grid cell and the full-screen viewer of the same photo each fetch and decode
 * the original independently, and the viewer's decode lands in the middle of
 * the open animation. On a cache hit this returns the image from the very
 * first render — synchronously, before any effect runs — so the first frame
 * the user sees is already filtered.
 */
function useSharedSourceImage(source: string | number | null): SkImage | null {
  // The decoded image is stored *with the source it came from*, and handed
  // back only when the two still agree.
  //
  // Without that pairing there is a window, one render long, where the props
  // describe the new photo but this state still holds the old one's image:
  // state updates in an effect, and effects run after the render that
  // scheduled them. Swiping to the next photo therefore rendered the previous
  // photo's pixels under the *new* photo's cache key — so the viewer showed
  // one photo sharp with a different one behind it, and, worse, the wrong
  // image was then cached against that key and kept coming back. The grid hit
  // the same thing whenever a recycled cell was handed a different photo.
  const [loaded, setLoaded] = useState<{ source: string | number; image: SkImage } | null>(() => {
    if (typeof source !== 'string') return null;
    const resident = peekSourceImage(source);
    return resident ? { source, image: resident } : null;
  });

  useEffect(() => {
    if (source === null) {
      setLoaded(null);
      return undefined;
    }

    const resident = typeof source === 'string' ? peekSourceImage(source) : null;
    if (resident) {
      setLoaded({ source, image: resident });
      return undefined;
    }

    let cancelled = false;
    void loadSourceImage(source).then((image) => {
      if (!cancelled && image) setLoaded({ source, image });
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  // A mismatch means the photo changed and its image has not arrived yet.
  // Returning null keeps the rest of the component from rendering anything at
  // all for that beat, which the untreated `<Image>` underneath already covers.
  return loaded && loaded.source === source ? loaded.image : null;
}

/**
 * How long a burst of layout changes must go quiet before it counts as
 * "settled" and earns a re-render. Comfortably longer than one animation frame
 * (so a continuously-animating resize never lands one) and short enough that a
 * genuine one-off resize — rotating the device, say — still feels immediate.
 */
const RESIZE_SETTLE_MS = 120;

/**
 * The disposable-camera treatment, drawn on a Skia canvas.
 *
 * All of the look lives in one shader, built into one paint by
 * `buildDisposablePaint` — the same call the full-resolution exporter makes.
 * This component holds no filter logic of its own, which is the point: there
 * is nothing here that can drift from what gets saved to the camera roll.
 *
 * What it does hold is the machinery that keeps that work off the navigation
 * path. Two things made opening a disposable photo lag where `original` and
 * `black_and_white` did not:
 *
 * 1. The source image was decoded from scratch on every mount, so tapping a
 *    thumbnail re-decoded the full-resolution original *during* the open
 *    animation. `useSharedSourceImage` shares one decode across every surface.
 * 2. Drawing a `<Picture>` re-runs the shader over every pixel each time the
 *    canvas redraws, and the hero transition animates the container's width
 *    and height, so that was every frame. The filtered result is now
 *    rasterised once into an image and the animation blits that instead —
 *    the same thing an unfiltered photo does.
 *
 * Everything that varies between photos comes from
 * `buildDisposableRecipe(seedKey)`, which is deterministic — a photo looks the
 * same on every render while differing from the photo beside it.
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
  // Two sizes, deliberately not one.
  //
  // `liveSize` tracks the container on every layout event, including every
  // frame of an animated resize. `renderSize` is what the filter is actually
  // rendered at, and only follows `liveSize` once layout has stopped changing
  // for a beat — so a whole open or close transition produces one render
  // rather than one per frame. The gap between them is covered by drawing the
  // rendered image at `liveSize`, which is a texture blit and costs nothing.
  const [liveSize, setLiveSize] = useState<{ width: number; height: number } | null>(null);
  const [renderSize, setRenderSize] = useState<{ width: number; height: number } | null>(null);
  const resizeSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);

  useEffect(
    () => () => {
      if (resizeSettleTimer.current) clearTimeout(resizeSettleTimer.current);
    },
    [],
  );

  const recipe = useMemo(() => buildDisposableRecipe(seedKey), [seedKey]);
  const skiaSource = toSkiaSource(source);
  const image = useSharedSourceImage(skiaSource);

  // The imprint is drawn into the canvas alongside the filter rather than laid
  // over it as a `<Text>`. A text node stacked on top of a photo is exactly
  // what a date back does *not* look like.
  const stamp = useMemo(
    () =>
      dateStampEnabled && !compact
        ? formatDisposableDateStamp(capturedAt ? new Date(capturedAt) : new Date())
        : undefined,
    [capturedAt, compact, dateStampEnabled],
  );

  const devicePixelRatio = PixelRatio.get();
  const fit = resizeMode === 'contain' ? 'contain' : 'cover';

  // The filtered photo, flattened to an image. Cached across mounts, so
  // closing a photo and reopening it costs nothing, and so the grid cell's
  // render is not thrown away when the viewer opens.
  //
  // `stand-in` is what keeps the open animation free of shader work. On a
  // first view at this size there is nothing cached to draw, and rendering one
  // would land squarely in the transition — so a render of the *same photo at
  // another size*, which the grid cell already produced, is drawn scaled
  // instead. It is correctly filtered, just softer, and it is replaced by the
  // exact-size render as soon as that exists.
  const rendered = useMemo(() => {
    if (!image || !renderSize || renderSize.width <= 0 || renderSize.height <= 0) return null;
    return getDisposableRender({
      image,
      recipe,
      seedKey,
      width: renderSize.width,
      height: renderSize.height,
      devicePixelRatio,
      fit,
      compact,
      dateStamp: stamp,
    });
  }, [compact, devicePixelRatio, fit, image, recipe, renderSize, seedKey, stamp]);

  // Only consulted while `rendered` is still null, so it costs a cache lookup
  // and nothing else once the real render lands.
  const standIn = useMemo(() => {
    if (rendered || !renderSize || renderSize.height <= 0) return null;
    // Under `contain` the render is shaped like the photo, not like the box it
    // sits in, so that is the shape a stand-in has to match.
    const targetAspect =
      fit === 'contain' && image
        ? image.width() / image.height()
        : renderSize.width / renderSize.height;
    return peekAnyRenderFor(seedKey, targetAspect);
  }, [fit, image, rendered, renderSize, seedKey]);
  const shown = rendered ?? standIn;

  // Fallback for when no offscreen GPU surface is available. Replays the
  // shader on every canvas redraw, which is the behaviour this component used
  // to have everywhere — slower, but correct, and never a silently unfiltered
  // photo.
  const picture = useMemo(() => {
    if (shown || !image || !renderSize || renderSize.width <= 0 || renderSize.height <= 0) {
      return null;
    }
    return recordDisposablePicture(image, recipe, {
      width: renderSize.width,
      height: renderSize.height,
      devicePixelRatio,
      fit,
      compact,
      dateStamp: stamp ? { text: stamp } : undefined,
    });
  }, [compact, devicePixelRatio, fit, image, recipe, shown, renderSize, stamp]);

  const scale = resizeTransformScale(renderSize, liveSize);
  const pictureTransform = useMemo(
    () => (scale ? [{ scaleX: scale.scaleX }, { scaleY: scale.scaleY }] : undefined),
    [scale],
  );

  useEffect(() => {
    readyRef.current = false;
  }, [skiaSource, seedKey, compact]);

  useEffect(() => {
    if (!readyRef.current && (rendered || picture)) {
      // Deliberately `rendered`, not `shown`: a scaled stand-in is not what an
      // export should capture.
      readyRef.current = true;
      onReady?.();
    }
  }, [onReady, picture, rendered]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    const incoming = { width, height };

    setLiveSize((current) =>
      current && current.width === width && current.height === height ? current : incoming,
    );

    setRenderSize((current) => {
      const decision = decideRenderSize(current, incoming);
      switch (decision.kind) {
        case 'unchanged':
          return current;
        case 'immediate':
          return decision.size;
        case 'debounce':
          // Restarting this timer on every layout event is what makes a
          // continuous resize animation fire it exactly once, after the last
          // frame — not once per frame.
          if (resizeSettleTimer.current) clearTimeout(resizeSettleTimer.current);
          resizeSettleTimer.current = setTimeout(() => {
            resizeSettleTimer.current = null;
            setRenderSize(decision.size);
          }, RESIZE_SETTLE_MS);
          return current;
      }
    });
  }

  return (
    <View style={style} onLayout={handleLayout}>
      {/*
        Always mounted underneath the canvas. Decoding is async even on a cache
        hit for a photo never seen before, so without this the cell would be
        empty for a frame or two on every scroll — and empty-until-loaded is
        exactly the blank-photo failure this whole component replaced. It
        simply gets covered once ready.
      */}
      <RNImage source={source} style={StyleSheet.absoluteFill} resizeMode={resizeMode} />

      {shown && liveSize ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {/*
            Under `cover` the render was produced at the container's own shape,
            so `fill` simply stretches it onto the box — including while that
            box is mid-animation at a different size, which is what makes the
            transition a blit rather than a re-render.

            Under `contain` the render is shaped like the photo instead (the
            surface is sized to it, so no filter layer has an empty margin to
            bleed into), so it has to be fitted here rather than stretched.
          */}
          <SkiaImage
            image={shown}
            x={0}
            y={0}
            width={liveSize.width}
            height={liveSize.height}
            fit={fit === 'contain' ? 'contain' : 'fill'}
          />
        </Canvas>
      ) : picture ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} transform={pictureTransform} />
        </Canvas>
      ) : null}
    </View>
  );
}
