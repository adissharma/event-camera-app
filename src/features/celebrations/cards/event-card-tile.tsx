import { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText } from '@/components/ui/text';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { colours, fontFamilies, radii, spacing } from '@/design';
import { LOCALE_CONFIG } from '@/config/app-config';
import type { CelebrationSummary } from '@/services/celebrations';
import type { ThemeRow } from '@/types/database';

/**
 * The event tile, as it appears on the dashboard grid.
 *
 * Extracted from `home.tsx` so Trash renders the *same* card rather than a
 * lookalike: a deleted event is still the host's event, and showing it in a
 * different shape made Trash read as a bolted-on section. Anything
 * Trash-specific belongs around this card, never inside it.
 *
 * Sized for a two-column grid — 4:5, matching gallery media tiles.
 */
export function getEventStatusLabel(celebration: CelebrationSummary) {
  const endsAt = celebration.primarySession?.ends_at ?? celebration.endsAt;
  if (endsAt && new Date(endsAt).getTime() < Date.now()) {
    return null; // Completed ones hide the status label above the title
  }
  return 'UPCOMING'; // Both upcoming and live events show "Upcoming"
}

export interface EventCardTileProps {
  celebration: CelebrationSummary;
  /** Drives the staggered entry. Pass the index within its column. */
  index?: number;
  themes?: ThemeRow[];
  onPress?: () => void;
  /**
   * Replaces the status eyebrow above the title. Trash uses it for the
   * deletion countdown, which is the one thing that differs about a deleted
   * event — everything else stays identical to the dashboard.
   */
  eyebrowOverride?: string | null;
}

export function EventCardTile({
  celebration,
  index = 0,
  themes,
  onPress,
  eyebrowOverride,
}: EventCardTileProps) {
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  /**
   * Card height, from the live viewport rather than a module-scope
   * `Dimensions.get('window')`. That call is evaluated once at import and
   * never again, so a card imported before the window settled kept a stale
   * width for the rest of the session — which rendered these at the wrong
   * proportion after a viewport change.
   */
  const { width } = useWindowDimensions();
  const cardHeight = Math.round(((width - 40 - 16) / 2) * (5 / 4));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 120, // Staggered entry
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  // The host's own cover, resolved via useCoverSource (falls back to FALLBACK_COVER)
  const coverSource = useCoverSource(celebration.coverStoragePath);

  // Resolve theme design tokens
  const theme = (themes ?? []).find(
    (t: ThemeRow) => t.id === celebration.defaultThemeId || t.slug === celebration.defaultThemeId,
  );
  const accentColor =
    (theme?.design_tokens as Record<string, string> | null)?.accent || colours.textPrimary;

  const statusLabel = eyebrowOverride !== undefined ? eyebrowOverride : getEventStatusLabel(celebration);
  const isCompleted = !getEventStatusLabel(celebration);

  const formattedDate = celebration.endsAt
    ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(celebration.endsAt))
    : null;

  let dateSubtext = 'No closing time';
  if (isCompleted) {
    dateSubtext = formattedDate ?? 'Completed';
  } else {
    dateSubtext = formattedDate ? `Closes ${formattedDate}` : 'Upcoming';
  }

  const card = (
    <>
      <Image
        source={coverSource}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
      />

      {/* Cinematic readability scrim: transparent at top, rapid dark fade in bottom of card */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.60)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.4, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '60%',
          zIndex: 1,
        }}
      />

      <View style={[S.cardContent, { zIndex: 2 }]}>
        <View style={S.cardLeft}>
          {statusLabel ? (
            <AppText variant="eyebrow" tone="secondary" style={S.cardStatus}>
              {statusLabel}
            </AppText>
          ) : null}
          <AppText
            variant="titleMedium"
            style={[S.cardTitle, { color: accentColor }]}
            numberOfLines={3}
          >
            {celebration.title}
          </AppText>
          {dateSubtext ? (
            <AppText variant="caption" tone="secondary" style={S.cardDate}>
              {dateSubtext}
            </AppText>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
      {onPress ? (
        <Pressable style={[S.eventCard, { height: cardHeight }]} onPress={onPress}>
          {card}
        </Pressable>
      ) : (
        // Trash cards are not navigable — the event no longer has a gallery to
        // open — so the tile renders as a plain view rather than a dead button.
        <View style={[S.eventCard, { height: cardHeight }]}>{card}</View>
      )}
    </Animated.View>
  );
}

const S = StyleSheet.create({
  eventCard: {
    width: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colours.surface,
    position: 'relative',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardStatus: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  cardTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
  },
  cardDate: {
    marginTop: 4,
    fontSize: 12,
  },
});
