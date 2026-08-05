import {
  Image,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ColorMatrix, type Matrix as NativeMatrix } from 'react-native-color-matrix-image-filters';

import { DisposablePhoto } from '@/components/media/disposable-photo';
import type { PhotoTreatment } from '@/types/database';
import { TREATMENT_VISUALS, normalisePhotoTreatment } from '@/features/media/photo-treatment';

export interface TreatedPhotoProps {
  source: ImageSourcePropType;
  /** The event session's chosen look. `null`/`undefined` renders as `original`. */
  treatment: PhotoTreatment | null | undefined;
  /**
   * Stable per-photo identity, used to seed the disposable treatment's
   * randomisation. A media item id is ideal; a signed URL is not, since it
   * is re-issued on expiry and would reshuffle the look.
   */
  seedKey?: string;
  /** Whether the disposable date stamp should be drawn. Only meaningful for `disposable`. */
  dateStampEnabled?: boolean;
  /** What the date stamp reads. Falls back to the moment of render if omitted. */
  capturedAt?: string | null;
  /** Sizing/positioning for the whole treated box — what you'd otherwise pass to `Image`. */
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  blurRadius?: number;
  /**
   * Small render surfaces (crops, chips) skip the finer disposable layers —
   * grain, leaks and debris are invisible at that size and not worth the
   * cost. Colour and vignette still apply.
   */
  compact?: boolean;
}

/**
 * Renders a captured photo with the event's chosen `photo_treatment`
 * applied. This is the one place that draws the look — every real-photo
 * render site (gallery grid, full-size viewer) should go through it rather
 * than a bare `Image`, so a treatment never silently fails to appear
 * somewhere a host or guest is looking.
 *
 * Two rendering paths, because the treatments differ in kind:
 *
 * - `original` and `black_and_white` are a plain image, optionally through
 *   one static colour matrix. Cheap, and no reason to involve a canvas.
 * - `disposable` is a layered composite — randomised colour, softening,
 *   radial vignette, shader grain, light leak, dust and scratches — and is
 *   drawn on a Skia canvas by `DisposablePhoto`.
 *
 * Nothing is baked into the image's pixels either way, so this stays
 * non-destructive: the file behind `source` is always the untouched
 * original, and a future bulk-download can offer "original" or "with
 * filter" by serving that file or rasterising the same recipe offscreen.
 */
export function TreatedPhoto({
  source,
  treatment,
  seedKey,
  dateStampEnabled = true,
  capturedAt,
  style,
  resizeMode = 'cover',
  blurRadius,
  compact = false,
}: TreatedPhotoProps) {
  const resolved = normalisePhotoTreatment(treatment);
  const visual = TREATMENT_VISUALS[resolved];

  // A locked photo is deliberately unreadable, so the treatment underneath it
  // cannot be seen. Skip the canvas entirely rather than spend a shader and
  // five composited layers on pixels about to be blurred into mush.
  const locked = typeof blurRadius === 'number' && blurRadius > 0;

  if (resolved === 'disposable' && !locked) {
    return (
      <DisposablePhoto
        source={source}
        seedKey={seedKey ?? capturedAt ?? 'disposable'}
        dateStampEnabled={dateStampEnabled}
        capturedAt={capturedAt}
        style={style}
        resizeMode={resizeMode}
        compact={compact}
      />
    );
  }

  const photo = (
    <Image
      source={source}
      style={StyleSheet.absoluteFill}
      resizeMode={resizeMode}
      blurRadius={blurRadius}
    />
  );

  return (
    <View style={style}>
      {visual.colorMatrix ? (
        // `photo-treatment.ts`'s `Matrix` is a plain `number[]` — shared with
        // the web sibling, which has no reason to know this package's fixed
        // 20-tuple type. Only this native call site needs it.
        <ColorMatrix
          matrix={visual.colorMatrix as unknown as NativeMatrix}
          style={StyleSheet.absoluteFill}
        >
          {photo}
        </ColorMatrix>
      ) : (
        photo
      )}
    </View>
  );
}
