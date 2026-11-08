import {
  Image,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface DisposablePhotoProps {
  source: ImageSourcePropType;
  seedKey: string;
  dateStampEnabled?: boolean;
  capturedAt?: string | null;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  compact?: boolean;
}

/**
 * Web sibling of `disposable-photo.tsx`, which builds its whole look on a
 * `@shopify/react-native-skia` canvas — grain shader, radial vignette, light
 * leak and dust layers. On native, Skia is linked at build time; on web it
 * needs its own async WASM bootstrap (`LoadSkiaWeb()` plus the CanvasKit
 * binary) that this app does not set up. Without that, `Skia` is `undefined`
 * at import time, and the default file calls `Skia.RuntimeEffect.Make(...)`
 * at MODULE SCOPE — so merely importing it, on any web page, throws before
 * anything renders. `.web.tsx` is how Metro/Expo keep that import out of the
 * web bundle graph entirely, same fix as `treated-photo.web.tsx`.
 *
 * No web guest surface renders a treated photo today (the guest gallery uses
 * a bare `Image`), so this only needs to exist for host-side previews reached
 * from web — hence a plain, untreated image rather than a reimplementation of
 * the look. If the disposable look is ever wanted in a web browser, build
 * proper Skia-web support: this file is a safety net, not a substitute.
 */
export function DisposablePhoto({ source, style, resizeMode = 'cover' }: DisposablePhotoProps) {
  // Sized explicitly, not only pinned to the edges: react-native-web gives an
  // Image with no width or height the photo's intrinsic size, so in the 92pt
  // treatment swatch it drew at full resolution and showed only a dark corner.
  return (
    <View style={[style, S.clip]}>
      <Image source={source} style={[StyleSheet.absoluteFill, S.fill]} resizeMode={resizeMode} />
    </View>
  );
}

const S = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
