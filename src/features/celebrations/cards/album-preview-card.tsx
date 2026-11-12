import { canHostSeePhotos } from '@/features/celebrations/reveal/state';
import { serverNow } from '@/services/server-time';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, fontFamilies, radii, spacing } from '@/design';
import { fetchAlbumPreview } from '@/services/album-previews';
import type { CelebrationSummary } from '@/services/celebrations';
import { isSampleCelebrationId } from '@/features/celebrations/sample-event';

const SAMPLE_PILL: ViewStyle = {
  position: 'absolute',
  top: spacing.sm,
  left: spacing.sm,
  zIndex: 1,
  paddingHorizontal: spacing.base,
  paddingVertical: spacing.sm,
  borderRadius: radii.pill,
};
/** The pill's own fill, where there is no Liquid Glass to draw it. */
const SAMPLE_PILL_FILL: ViewStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.28)',
};
const SAMPLE_PILL_TEXT = {
  color: '#FFFFFF',
  fontFamily: fontFamilies.textSemiBold,
  fontSize: 12,
  lineHeight: 16,
  // There is no wash on the glass, so the type carries its own contrast on a bright photo.
  textShadowColor: 'rgba(0, 0, 0, 0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

/** The gap between photos in the mosaic. */
const MOSAIC_GAP = 6;

/**
 * iOS 26's own material, on the tile carrying the "+N". Everywhere else that tile
 * blurs its photo instead, which also covers mobile web (see AGENTS.md).
 */
const HAS_LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
/** Light enough that the photo still warps at the rim, dark enough to hold the type on it. */
const COUNT_GLASS_WASH = 'rgba(11, 11, 12, 0.35)';

type AlbumPhoto = number | { uri: string };

function sourceKey(source: AlbumPhoto): string {
  return typeof source === 'number' ? String(source) : source.uri;
}

function MosaicPhoto({
  source,
  style,
  moreCount = 0,
  isLocked = false,
  onError,
}: {
  source: AlbumPhoto;
  style: ViewStyle;
  moreCount?: number;
  /** Before the host's own reveal: shows there are photos without showing them. */
  isLocked?: boolean;
  onError: (source: AlbumPhoto) => void;
}) {
  return (
    <View
      style={[
        { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colours.surfaceMuted },
        style,
      ]}
    >
      <Image
        source={source}
        contentFit="cover"
        // Locked stays blurred under the glass too: clear glass would show the photo.
        blurRadius={isLocked ? 45 : moreCount > 0 && !HAS_LIQUID_GLASS ? 28 : 0}
        style={{ width: '100%', height: '100%' }}
        onError={() => onError(source)}
      />
      {moreCount > 0 && HAS_LIQUID_GLASS ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GlassView
            glassEffectStyle="clear"
            colorScheme="dark"
            style={[StyleSheet.absoluteFill, { borderRadius: radii.lg }]}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: COUNT_GLASS_WASH }]} />
        </View>
      ) : null}
      {moreCount > 0 ? (
        <View
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="button"
            style={{
              color: colours.textPrimary,
              fontFamily: fontFamilies.textSemiBold,
              fontSize: 18,
              lineHeight: 24,
            }}
          >
            +{moreCount}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function AlbumPreviewCard({
  celebration,
  width,
  onPress,
}: {
  celebration: CelebrationSummary;
  width: number;
  onPress: () => void;
}) {
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());
  const { data, isError } = useQuery({
    queryKey: ['celebrations', 'album-preview', celebration.id, 2],
    queryFn: () => fetchAlbumPreview(celebration.id, celebration.primarySession?.id ?? null),
    staleTime: 5 * 60_000,
  });

  const markFailed = (source: AlbumPhoto) => {
    const key = sourceKey(source);
    setFailedSources((current) => current.has(key) ? current : new Set(current).add(key));
  };

  const photos = (data?.photos ?? []).filter((source) => !failedSources.has(sourceKey(source)));
  // The mosaic shows three, so anything past that is counted on the last of them.
  const shown = photos.slice(0, 3);
  const hiddenCount = (data?.remainingCount ?? 0) + photos.length - shown.length;
  const mainSize = (width - MOSAIC_GAP / 2) / 1.5;
  const sideSize = (mainSize - MOSAIC_GAP) / 2;
  const endsAt = celebration.primarySession?.ends_at ?? celebration.endsAt;
  const endDate = endsAt ? formatAlbumDate(new Date(endsAt)) : null;
  const isLocked = !canHostSeePhotos({
    now: serverNow(),
    hostRevealMode: celebration.primarySession?.host_reveal_mode,
    hostRevealAt: celebration.primarySession?.host_reveal_at,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${celebration.title} album`}
      onPress={onPress}
      style={{
        width,
        gap: spacing.md,
      }}
    >
      {shown.length > 0 ? (
        <View style={{ height: mainSize, flexDirection: 'row', gap: MOSAIC_GAP }}>
          {/* The example album sits among the host's own, so it says what it is. */}
          {isSampleCelebrationId(celebration.id) ? (
            <View pointerEvents="none" style={[SAMPLE_PILL, !HAS_LIQUID_GLASS && SAMPLE_PILL_FILL]}>
              {HAS_LIQUID_GLASS ? (
                <>
                  <GlassView
                    glassEffectStyle="clear"
                    colorScheme="dark"
                    style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]}
                  />
                </>
              ) : null}
              <AppText variant="bodySmall" style={SAMPLE_PILL_TEXT}>
                Sample
              </AppText>
            </View>
          ) : null}
          <MosaicPhoto
            source={shown[0]}
            style={{ flex: 1 }}
            isLocked={isLocked}
            onError={markFailed}
          />
          {shown.length > 1 ? (
            <View style={{ width: shown.length > 2 ? sideSize : mainSize / 2, gap: MOSAIC_GAP }}>
              <MosaicPhoto
                source={shown[1]}
                style={{ flex: 1 }}
                isLocked={isLocked}
                onError={markFailed}
              />
              {shown.length > 2 ? (
                <MosaicPhoto
                  source={shown[2]}
                  style={{ flex: 1 }}
                  moreCount={hiddenCount}
                  isLocked={isLocked}
                  onError={markFailed}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ height: data || isError ? 40 : mainSize, justifyContent: 'center' }}>
          {data || isError ? (
            <AppText variant="bodySmall" tone="secondary">
              {isError ? 'Photos unavailable' : 'No photos'}
            </AppText>
          ) : null}
        </View>
      )}
      <View style={{ gap: spacing.xs }}>
        <AppText
          variant="titleMedium"
          numberOfLines={2}
          ellipsizeMode="tail"
          style={{
            color: colours.textPrimary,
            fontSize: 20,
            lineHeight: 24,
          }}
        >
          {celebration.title}
        </AppText>
        {endDate ? (
          <AppText
            variant="bodySmall"
            tone="secondary"
            numberOfLines={1}
            style={{
              fontFamily: fontFamilies.textMediumItalic,
              fontSize: 12,
              lineHeight: 17,
            }}
          >
            {endDate}
          </AppText>
        ) : null}
      </View>

    </Pressable>
  );
}

/** "Sep 29th", with the year only once the album is from an earlier year. */
function formatAlbumDate(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const tens = day % 100;
  const suffix = tens >= 11 && tens <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
  const label = `${month} ${day}${suffix}`;
  return date.getFullYear() === new Date().getFullYear()
    ? label
    : `${label}, ${date.getFullYear()}`;
}
