/**
 * What the persistent phone is showing at each stage.
 *
 * Kept apart from `preview-stage`, which owns only the movement. A layer can
 * be rewritten — or the filters step can add one — without touching the
 * geometry, and the geometry cannot accidentally depend on what a layer
 * happens to render.
 */

import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText } from '@/components/ui/text';
import { colours, radii, spacing } from '@/design';
import { GuestCoverPreview, parseCoverTheme } from './guest-cover-preview';
import { CaptureLimitPreview } from './capture-limit-preview';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { SAMPLE_PHOTOS, sampleAssetUri } from '@/features/celebrations/sample-event';
import type { CreationDraft } from '@/features/celebrations/draft/types';

/**
 * The gallery, as the host will actually see it.
 *
 * The photographs are the sample album's — real wedding photography already
 * in the project, and the same frames the example album shows. A grid of grey
 * placeholders here would be describing the product rather than showing it,
 * which is the whole thing this sequence is trying to stop doing.
 *
 * Only the first row and a half is ever visible: the phone is cropped at this
 * stage, and the point is "this is where the moments land", not a full
 * gallery. Rendering more would cost image decodes nobody sees.
 */
const GALLERY_PHOTOS = SAMPLE_PHOTOS.slice(0, 6);

export function GalleryLayer({ draft }: { draft: CreationDraft | null }) {
  const title = draft?.title?.trim() || 'Your event';

  return (
    <View style={S.gallery}>
      <View style={S.galleryHeader}>
        <AppText variant="titleMedium" style={S.galleryTitle} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {GALLERY_PHOTOS.length} moments
        </AppText>
      </View>

      <View style={S.grid}>
        {GALLERY_PHOTOS.map((photo) => (
          <View key={photo.id} style={S.tile}>
            <Image
              source={{ uri: sampleAssetUri(photo.source) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </View>
        ))}
      </View>

      {/*
        The crop, drawn rather than clipped: a hard edge would read as the
        phone ending, and this stage is meant to read as the phone continuing
        past what is on screen.
      */}
      <LinearGradient
        colors={['rgba(11,11,12,0)', colours.background]}
        style={S.bottomFade}
        pointerEvents="none"
      />
    </View>
  );
}

export function CoverLayer({ draft }: { draft: CreationDraft | null }) {
  if (!draft) return null;
  return (
    <View style={S.fill}>
      <GuestCoverPreview draft={draft} theme={parseCoverTheme(draft.themeSlug)} />
    </View>
  );
}

export function CaptureLayer({ draft }: { draft: CreationDraft | null }) {
  // Hook order is fixed regardless of `draft`, so the null case returns after
  // it rather than before.
  const coverSource = useCoverSource(draft?.coverLocalUri ?? draft?.coverStoragePath ?? null);
  if (!draft) return null;

  return (
    <View style={S.captureWrap}>
      <CaptureLimitPreview limit={draft.shotLimitPerGuest} coverSource={coverSource} />
    </View>
  );
}

const TILE_GAP = 3;

const S = StyleSheet.create({
  fill: { flex: 1 },
  gallery: { flex: 1, paddingTop: spacing.xl },
  galleryHeader: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  galleryTitle: { color: colours.textPrimary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    paddingHorizontal: spacing.base,
  },
  tile: {
    // Three up, matching the event gallery's own grid so this reads as the
    // product rather than as an illustration of it.
    width: `${(100 - 2 * 2) / 3}%`,
    aspectRatio: 0.78,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  captureWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
