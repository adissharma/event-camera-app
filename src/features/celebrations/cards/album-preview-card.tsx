import { canHostSeePhotos } from '@/features/celebrations/reveal/state';
import { serverNow } from '@/services/server-time';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Pressable, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, fontFamilies, radii, spacing } from '@/design';
import { fetchAlbumPreview } from '@/services/album-previews';
import type { CelebrationSummary } from '@/services/celebrations';

/** The gap between photos in the mosaic. */
const MOSAIC_GAP = 6;

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
        blurRadius={isLocked ? 45 : moreCount > 0 ? 28 : 0}
        style={{ width: '100%', height: '100%' }}
        onError={() => onError(source)}
      />
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.base }}>
        <AppText
          variant="titleMedium"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            color: colours.textPrimary,
            fontSize: 20,
            lineHeight: 24,
            maxWidth: width * 0.62,
            flexShrink: 1,
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
              maxWidth: width * 0.38,
              textAlign: 'right',
              paddingTop: spacing.xs,
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
