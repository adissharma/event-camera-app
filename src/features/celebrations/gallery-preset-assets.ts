import type { ImageSourcePropType } from 'react-native';

import {
  CREATION_GALLERY_PREVIEW_IMAGES,
  CREATION_GALLERY_PREVIEW_MONO_IMAGES,
} from './creation/gallery-preview-assets';

export interface GalleryPresetAsset {
  id: string;
  source: ImageSourcePropType;
  monochromeSource: ImageSourcePropType;
}

/** Offline and host-creation preview media; real events use signed URLs. */
export const GALLERY_PRESETS: readonly GalleryPresetAsset[] = [
  {
    id: 'preset_1',
    source: CREATION_GALLERY_PREVIEW_IMAGES[0],
    monochromeSource: CREATION_GALLERY_PREVIEW_MONO_IMAGES[0],
  },
  {
    id: 'preset_2',
    source: CREATION_GALLERY_PREVIEW_IMAGES[1],
    monochromeSource: CREATION_GALLERY_PREVIEW_MONO_IMAGES[1],
  },
  {
    id: 'preset_3',
    source: require('../../../assets/sample-event/01.jpg'),
    monochromeSource: require('../../../assets/sample-event/mono/01.jpg'),
  },
  {
    id: 'preset_4',
    source: require('../../../assets/sample-event/02.jpg'),
    monochromeSource: require('../../../assets/sample-event/mono/02.jpg'),
  },
];

export function galleryPresetSource(uri: string): ImageSourcePropType {
  return GALLERY_PRESETS.find((preset) => preset.id === uri)?.source ?? { uri };
}
