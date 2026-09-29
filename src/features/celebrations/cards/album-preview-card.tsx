import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, fontFamilies, radii, spacing } from '@/design';
import { fetchAlbumPreview } from '@/services/album-previews';
import type { CelebrationSummary } from '@/services/celebrations';

const PHOTO_TILTS = ['-5deg', '3deg', '-3deg', '4deg'] as const;

function sourceKey(source: number | { uri: string }): string {
  return typeof source === 'number' ? String(source) : source.uri;
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
  const [loadedSources, setLoadedSources] = useState<Set<string>>(() => new Set());
  const { data, isError } = useQuery({
    queryKey: ['celebrations', 'album-preview', celebration.id, 2],
    queryFn: () => fetchAlbumPreview(celebration.id, celebration.primarySession?.id ?? null),
    staleTime: 5 * 60_000,
  });

  const photos = (data?.photos ?? []).filter((source) => !failedSources.has(sourceKey(source)));
  const hasMore = photos.length === 4
    && (data?.remainingCount ?? 0) > 0
    && photos.every((source) => loadedSources.has(sourceKey(source)));
  const slotCount = photos.length;
  const photoWidth = Math.min(112, (width + Math.max(0, slotCount - 1) * 9) / Math.max(4, slotCount));
  const endsAt = celebration.primarySession?.ends_at ?? celebration.endsAt;
  const endDate = endsAt
    ? new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(endsAt))
    : null;

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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.base }}>
        <AppText
          variant="titleMedium"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ color: colours.textPrimary, fontSize: 20, lineHeight: 24, maxWidth: width * 0.58, flexShrink: 1 }}
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

      <View style={{ height: slotCount > 0 || (!data && !isError) ? 158 : 40, flexDirection: 'row', alignItems: 'center' }}>
        {photos.map((source, index) => (
          <View
            key={sourceKey(source)}
            style={{
              width: photoWidth,
              height: 146,
              marginLeft: index === 0 ? 0 : -9,
              borderRadius: radii.lg,
              overflow: 'hidden',
              backgroundColor: colours.surfaceRaised,
              transform: [{ rotate: PHOTO_TILTS[index] }],
              zIndex: index,
            }}
          >
            <Image
              source={source}
              contentFit="cover"
              blurRadius={index === 3 && hasMore ? 28 : 0}
              style={{ width: '100%', height: '100%' }}
              onLoad={() => {
                const key = sourceKey(source);
                setLoadedSources((current) => current.has(key) ? current : new Set(current).add(key));
              }}
              onError={() => {
                const key = sourceKey(source);
                setFailedSources((current) => current.has(key) ? current : new Set(current).add(key));
              }}
            />
            {index === 3 && hasMore ? (
              <View style={{ position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.18)' }}>
                <AppText variant="titleMedium" style={{ color: colours.textPrimary }}>
                  +{data?.remainingCount}
                </AppText>
              </View>
            ) : null}
          </View>
        ))}
        {(data || isError) && slotCount === 0 ? (
          <AppText variant="bodySmall" tone="secondary">
            {isError ? 'Photos unavailable' : 'No photos'}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
