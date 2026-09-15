import type { ImageSourcePropType } from 'react-native';

export const GALLERY_PRESETS: readonly never[] = [];

/** Clip events always resolve real media URLs; no offline album is bundled. */
export function galleryPresetSource(uri: string): ImageSourcePropType {
  return { uri };
}
