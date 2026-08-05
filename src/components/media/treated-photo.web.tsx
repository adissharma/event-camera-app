import {
  Image,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { DisposablePhoto } from '@/components/media/disposable-photo';
import type { PhotoTreatment } from '@/types/database';
import { TREATMENT_VISUALS, normalisePhotoTreatment } from '@/features/media/photo-treatment';

export interface TreatedPhotoProps {
  source: ImageSourcePropType;
  treatment: PhotoTreatment | null | undefined;
  seedKey?: string;
  dateStampEnabled?: boolean;
  capturedAt?: string | null;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  blurRadius?: number;
  compact?: boolean;
}

/**
 * Web sibling of `treated-photo.tsx`. Metro/Expo resolve this file instead of
 * the default on a web build, which is the point of it existing: the default
 * imports `react-native-color-matrix-image-filters`, a native-only package
 * (it imports `codegenNativeComponent`, which throws Metro's web bundler the
 * moment the module is *reachable*, whether or not it's actually rendered).
 * A runtime `Platform.OS` check inside the shared file cannot prevent that —
 * Metro resolves static imports at bundle time. Splitting the file is the
 * only fix; see the incident this traces back to for the full story.
 *
 * `black_and_white`'s look is reproduced with a CSS `filter`, built from the
 * exact matrix `photo-treatment.ts` defines, rather than the native
 * component. `react-native-web` passes an unrecognised style key straight
 * through to the underlying DOM node, so this is a real filter, not an
 * approximation — same as the native path, just a different renderer.
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

  // `filter` is a react-native-web-only style extension that passes straight
  // through to the DOM node; RN's own style types don't know about it, hence
  // the cast rather than a fragile `@ts-expect-error` on a multi-line array.
  const imageStyle = [
    StyleSheet.absoluteFill,
    visual.colorMatrix ? { filter: 'grayscale(1)' } : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
  ] as any;

  return (
    <View style={style}>
      <Image source={source} style={imageStyle} resizeMode={resizeMode} blurRadius={blurRadius} />
    </View>
  );
}
