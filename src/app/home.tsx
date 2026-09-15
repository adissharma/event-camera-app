import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Animated,
  Pressable, 
  View, 
  ScrollView, 
  StyleSheet, 
  Modal, 
  Alert, 
  Image, 
  LayoutAnimation,
  Platform,
  UIManager,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  Path,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';

import { LoadingState } from '@/components/feedback/loading-state';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { PersonIcon } from '@/components/ui/icons';
import { SlideToConfirm } from '@/components/forms/slide-to-confirm';
import { useAuth } from '@/features/auth/context';
import { resetToUnauthenticatedRoot } from '@/lib/navigation/session-root';
import {
  celebrationKeys,
  listCelebrations,
  sampleCelebrationSummary,
  restoreCelebrationFromTrash,
  type CelebrationSummary,
} from '@/services/celebrations';
import { listThemes, themeKeys } from '@/services/themes';
import { fetchMyProfile, firstNameFrom, firstNameFromValue, profileKeys } from '@/services/profile';
import {
  colours,
  fontFamilies,
  layout,
  radii,
  spacing,
  MOMENTS_SLIDER_GRADIENT,
} from '@/design';
import { EventCardTile } from '@/features/celebrations/cards/event-card-tile';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { galleryHeroImageHeight } from '@/app/celebration/[celebrationId]/index';
import { Toast } from '@/components/feedback/toast';
import { clearDeletedAccountLocalState, deleteMyAccount } from '@/services/account';

/**
 * How long the "moved to Trash" confirmation stays up.
 *
 * Short deliberately: the action is fully recoverable from the Trash screen,
 * so the toast is a receipt rather than the only chance to undo.
 */
const TRASH_TOAST_VISIBLE_MS = 2500;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COMPLETED_CARD_ROTATIONS = ['-2.75deg', '1.9deg', '-1.4deg', '2.4deg', '-2.1deg'] as const;

// QR Code Icon
function QrCodeIcon({ size = 20, color = colours.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M3 3h6v6H3V3zm12 0h6v6h-6V3zM3 15h6v6H3v-6zm15 0h3v3h-3v-3zm3 3h3v3h-3v-3zm0-3h3v3h-3v-3zm-3 3h-3v3h3v-3zm-3-3h3v3h-3v-3z" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <Path 
        d="M6 6h.01M18 6h.01M6 18h.01M15 15h.01M18 18h.01" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function UserIcon({ size = 20, color = colours.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <Path 
        d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function PlusIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A solid clock face so the countdown reads as an accent, not another line icon. */
function FilledClockIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" fill="#FFFFFF" />
      <Path
        d="M12 6.75v5.5l3.75 2.25"
        stroke="#8D3CE4"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function organicPillPath(width: number, height: number) {
  const middle = height / 2;
  const left = 1;
  const right = width - 1;
  const start = Math.max(middle, 13);
  const end = Math.max(start, width - middle);

  // The top and bottom deliberately swell and dip at different points. It is
  // still compact enough to read as a pill, but has the looser, hand-shaped
  // edge of the live activity progress fill rather than a rounded rectangle.
  return [
    `M ${start} 2.6`,
    `C ${width * 0.23} 0.15 ${width * 0.36} 3.7 ${width * 0.54} 1.25`,
    `C ${width * 0.68} -0.15 ${width * 0.82} 2.8 ${end} 2.05`,
    `C ${right - 1.4} 1.4 ${right + 0.15} ${middle * 0.43} ${right - 0.4} ${middle * 0.71}`,
    `C ${right - 0.8} ${height * 0.86} ${right - 4.4} ${height - 0.35} ${end - 1.2} ${height - 2.25}`,
    `C ${width * 0.73} ${height - 0.4} ${width * 0.57} ${height - 3.2} ${width * 0.4} ${height - 1.15}`,
    `C ${width * 0.28} ${height + 0.05} ${width * 0.17} ${height - 2.4} ${start - 0.6} ${height - 1.55}`,
    `C ${left + 2.1} ${height - 1.05} ${left + 0.05} ${height * 0.72} ${left + 0.85} ${middle * 1.08}`,
    `C ${left + 0.2} ${height * 0.32} ${left + 4.2} 1.25 ${start} 2.6 Z`,
  ].join(' ');
}

function OrganicCountdownPill({ label, gradientId }: { label: string; gradientId: string }) {
  const [bounds, setBounds] = useState<{ width: number; height: number } | null>(null);

  return (
    <View
      style={styles.upcomingHeroCountdownPill}
      pointerEvents="none"
      onLayout={({ nativeEvent: { layout: next } }) => {
        setBounds((current) =>
          current && current.width === next.width && current.height === next.height
            ? current
            : { width: next.width, height: next.height },
        );
      }}
    >
      {bounds ? (
        <Svg
          width={bounds.width}
          height={bounds.height}
          viewBox={`0 0 ${bounds.width} ${bounds.height}`}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0%" y1="50%" x2="100%" y2="50%">
              <Stop offset="0" stopColor={MOMENTS_SLIDER_GRADIENT[0]} />
              <Stop offset="0.36" stopColor={MOMENTS_SLIDER_GRADIENT[1]} />
              <Stop offset="0.7" stopColor={MOMENTS_SLIDER_GRADIENT[2]} />
              <Stop offset="1" stopColor={MOMENTS_SLIDER_GRADIENT[3]} />
            </SvgLinearGradient>
          </Defs>
          <Path d={organicPillPath(bounds.width, bounds.height)} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      <FilledClockIcon size={16} />
      <AppText style={styles.upcomingHeroCountdown} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function ChevronRightIcon({ size = 16, color = colours.textSecondary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M9 6l6 6-6 6" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function getEventEndsAt(celebration: CelebrationSummary): string | null {
  return celebration.primarySession?.ends_at ?? celebration.endsAt;
}

function isCompletedEvent(celebration: CelebrationSummary) {
  const endsAt = getEventEndsAt(celebration);
  return Boolean(endsAt && new Date(endsAt).getTime() < Date.now());
}

function formatUpcomingTimeLeft(celebration: CelebrationSummary) {
  const endsAt = getEventEndsAt(celebration);
  if (!endsAt) return 'No time limit';

  const remainingMs = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Ended';

  const totalHours = Math.floor(remainingMs / (60 * 60 * 1000));
  if (totalHours < 1) return 'Less than 1 hour to go!';

  const days = Math.floor(totalHours / 24);
  const dayCopy = days === 1 ? '1 day' : `${days} days`;

  // The card is an at-a-glance invitation rather than a timer. Keeping the
  // most meaningful unit makes the pill quieter and leaves the cover to lead.
  if (days > 0) return `${dayCopy} to go!`;
  return `${totalHours === 1 ? '1 hour' : `${totalHours} hours`} to go!`;
}

function HomeUpcomingEventCard({
  celebration,
  themes,
  width: cardWidth,
  onPress,
}: {
  celebration: CelebrationSummary;
  themes?: Awaited<ReturnType<typeof listThemes>>;
  width: number;
  onPress: () => void;
}) {
  const coverSource = useCoverSource(celebration.coverStoragePath);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  /**
   * Frame the cover the way the event's own hero frames it.
   *
   * Both surfaces cover-fit and centre, but they were centring inside boxes of
   * different shapes — the hero's is 440×656, the card's 400×500 — so the same
   * photograph was scaled by a different rule in each and the middle of one
   * box was not the middle of the same part of the picture. The card was
   * showing sky where the hero shows the building.
   *
   * The fix is to fit the image to a box of the hero's proportions, scaled to
   * this card's width, and let the card show the middle of it. The card is a
   * little less tight than the hero — it reveals about 84% of the fitted image
   * where the hero shows 75% — but it is the same framing, centred on the same
   * point of the photograph, which is what makes the two read as one cover.
   */
  const cardHeight = Math.round(cardWidth * 1.25);
  const coverHeight = Math.round(galleryHeroImageHeight(screenHeight) * (cardWidth / screenWidth));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${celebration.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.upcomingHeroCard,
        { width: cardWidth, height: cardHeight },
        pressed && styles.cardPressed,
      ]}
    >
      <Image
        source={coverSource}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: coverHeight,
          top: Math.round((cardHeight - coverHeight) / 2),
        }}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.26)', 'rgba(0,0,0,0.88)']}
        locations={[0.18, 0.62, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.upcomingHeroContent}>
        <AppText
          variant="displayLarge"
          style={styles.upcomingHeroTitle}
          numberOfLines={3}
        >
          {celebration.title}
        </AppText>
        <OrganicCountdownPill
          label={formatUpcomingTimeLeft(celebration)}
          gradientId={`upcoming-countdown-${celebration.id}`}
        />
      </View>
    </Pressable>
  );
}

/**
 * Keeps the dashboard's hero footprint for a new host without inventing a
 * second surface. Once an event exists this is replaced by the real carousel
 * card in exactly the same position.
 */
function HomeUpcomingEventsEmptyState({
  width,
  onCreate,
}: {
  width: number;
  onCreate: () => void;
}) {
  return (
    <View style={[styles.upcomingEmptyState, { width, height: Math.round(width * 1.13) }]}>
      <ExpoImage
        source={require('../../assets/images/empty-events-illustration.png')}
        style={styles.upcomingEmptyIllustration}
        contentFit="contain"
        accessibilityLabel="Friends celebrating and capturing an event together"
      />

      <View style={styles.upcomingEmptyCopy}>
        <AppText variant="titleLarge" align="center" style={styles.upcomingEmptyTitle}>
          Make a little magic together
        </AppText>
        <AppText variant="bodySmall" tone="secondary" align="center" style={styles.upcomingEmptyBody}>
          Collect every photo in one place.
        </AppText>
      </View>

      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="Create event"
        style={({ pressed }) => [styles.upcomingEmptyCreateButton, pressed && styles.cardPressed]}
      >
        <View style={styles.upcomingEmptyCreateSurface}>
          <AppText variant="button" style={styles.upcomingEmptyCreateLabel}>Create event</AppText>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Page dots for the upcoming-events carousel.
 *
 * Driven straight off the scroll offset rather than off an index in state, so
 * the active dot moves with the thumb instead of snapping when the gesture
 * ends — and so dragging the carousel does not re-render the cards behind it.
 */
function CarouselDots({
  count,
  scrollX,
  interval,
}: {
  count: number;
  scrollX: Animated.Value;
  interval: number;
}) {
  return (
    <View style={styles.carouselDots} pointerEvents="none">
      {Array.from({ length: count }, (_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.carouselDot,
            {
              opacity: scrollX.interpolate({
                inputRange: [(index - 1) * interval, index * interval, (index + 1) * interval],
                outputRange: [0.24, 1, 0.24],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

function ProfileSettingsRow({
  title,
  value,
  tone = 'default',
  icon: Icon,
  onPress,
}: {
  title: string;
  value: string;
  tone?: 'default' | 'danger';
  /** Optional leading glyph. Only Join has one — it is the only row here
   *  that goes somewhere rather than changing a setting. */
  icon?: (props: { size?: number; color?: string }) => React.ReactElement;
  onPress: () => void;
}) {
  const isDanger = tone === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileActionRow, pressed && styles.profileActionRowPressed]}
    >
      {Icon ? (
        <View style={styles.profileActionIcon}>
          <Icon size={18} color={colours.textSecondary} />
        </View>
      ) : null}
      <View style={styles.profileActionText}>
        <AppText
          variant="labelLarge"
          style={[styles.profileActionLabel, isDanger && styles.profileActionLabelDanger]}
        >
          {title}
        </AppText>
        <AppText
          variant="bodySmall"
          style={[styles.profileActionValue, isDanger && styles.profileActionValueDanger]}
          numberOfLines={1}
        >
          {value}
        </AppText>
      </View>
      <ChevronRightIcon color={isDanger ? colours.error : colours.textSecondary} />
    </Pressable>
  );
}

// Helper to resolve status label (UPCOMING, completed hides label)
export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trashedEventId?: string; openProfile?: string }>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { session, signOut, isSignedIn, isRestoring, isBackendConfigured } = useAuth();
  
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [accountDeletionStep, setAccountDeletionStep] = useState<'idle' | 'warning' | 'confirm'>('idle');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [accountDeletionError, setAccountDeletionError] = useState<string | null>(null);
  const [trashToastEventId, setTrashToastEventId] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The `trashedEventId` this screen has already shown a toast for.
   *
   * The route param outlives the toast — it stays in the URL after the toast
   * is dismissed — so "should I show this?" cannot be answered by comparing
   * against the toast's own state. Doing that re-showed the toast the instant
   * the dismiss timer cleared it, which looked exactly like a toast that never
   * went away. Keyed on the param value so trashing a *different* event still
   * raises a new one.
   */
  const handledTrashParamRef = useRef<string | null>(null);
  const previousEventIdsRef = useRef<string[] | null>(null);

  // Redirect to welcome screen if not authenticated
  useEffect(() => {
    if (isBackendConfigured && !isRestoring && !isSignedIn) {
      resetToUnauthenticatedRoot(router);
    }
  }, [isBackendConfigured, isRestoring, isSignedIn, router]);

  // Queries
  const { data: celebrations, isLoading } = useQuery({
    queryKey: celebrationKeys.list(),
    queryFn: listCelebrations,
    enabled: isBackendConfigured,
  });

  const { data: themes } = useQuery({
    queryKey: themeKeys.list(),
    queryFn: listThemes,
    enabled: isBackendConfigured,
  });

  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
    enabled: isBackendConfigured,
  });

  const list = useMemo(() => celebrations ?? [], [celebrations]);
  const upcomingEvents = useMemo(
    () => list.filter((event) => !isCompletedEvent(event)),
    [list],
  );
  // The example album holds the first slot, ahead of the host's own finished
  // events, which keep their existing order underneath. Reserving a slot
  // rather than sorting means real albums are never reordered by its
  // presence.
  const completedEvents = useMemo(
    () => [sampleCelebrationSummary(), ...list.filter(isCompletedEvent)],
    [list],
  );
  const upcomingHeroWidth = screenWidth - layout.gutter * 2;
  /** How far the carousel travels per card — one dot's worth of scroll. */
  const upcomingCarouselInterval = upcomingHeroWidth + spacing.md;
  const upcomingScrollX = useRef(new Animated.Value(0)).current;
  const completedCardWidth = Math.round((screenWidth - layout.gutter * 2 - spacing.base) / 2);
  const firstName = firstNameFrom(profile);

  // Extracted so the empty state can show it too: a host with no events of
  // their own is exactly the person the example album exists for, and the
  // old "No events found" branch would have hidden it from them.
  const albumsSection = (
    <View style={styles.dashboardSection}>
      <AppText variant="titleMedium" style={styles.sectionTitle}>
        Previous albums
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.completedCarouselContent}
        style={styles.edgeToEdgeCarousel}
      >
        {completedEvents.map((celebration, index) => (
          <View
            key={celebration.id}
            style={[
              styles.completedCardWrap,
              {
                width: completedCardWidth,
                transform: [
                  { rotate: COMPLETED_CARD_ROTATIONS[index % COMPLETED_CARD_ROTATIONS.length] },
                ],
              },
            ]}
          >
            <EventCardTile
              celebration={celebration}
              index={index}
              themes={themes}
              onPress={() => router.push(`/celebration/${celebration.id}`)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );

  useEffect(() => {
    if (params.openProfile !== '1') return;
    setProfileModalVisible(true);
    router.setParams({ openProfile: undefined });
  }, [params.openProfile, router]);

  const restoreMutation = useMutation({
    mutationFn: restoreCelebrationFromTrash,
    onSuccess: async () => {
      setTrashToastEventId(null);
      await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
    },
    onError: () => {
      Alert.alert('Restore failed', 'Could not restore the event. Please try again.');
    },
  });

  useEffect(() => {
    const nextIds = list.map((event) => event.id);
    const previousIds = previousEventIdsRef.current;
    if (previousIds && nextIds.length < previousIds.length) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    previousEventIdsRef.current = nextIds;
  }, [list]);

  useEffect(() => {
    const trashedId = params.trashedEventId;

    if (!trashedId) {
      // Param consumed. Re-arm so trashing the *same* event again later — via
      // Undo, then trash a second time — still raises a toast.
      handledTrashParamRef.current = null;
      return;
    }

    if (handledTrashParamRef.current === trashedId) return;
    handledTrashParamRef.current = trashedId;

    setTrashToastEventId(trashedId);
    // Consume the param, so the toast's own dismissal is the only thing that
    // controls its lifetime.
    router.setParams({ trashedEventId: undefined });

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setTrashToastEventId(null);
    }, TRASH_TOAST_VISIBLE_MS);
  }, [params.trashedEventId, router]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleDeleteAccount = () => {
    setProfileModalVisible(false);
    setAccountDeletionError(null);
    setAccountDeletionStep('warning');
  };

  const cancelAccountDeletion = () => {
    if (isDeletingAccount) return;
    setAccountDeletionError(null);
    setAccountDeletionStep('idle');
  };

  const completeAccountDeletion = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    setAccountDeletionError(null);

    try {
      // The server transaction removes the Auth user and all owned data first.
      // Only then do we clear this device and leave the signed-in experience.
      await deleteMyAccount();
      await clearDeletedAccountLocalState(session?.user.id ?? null);
      // The server already revoked this user's session. `signOut` is only
      // local cleanup now, and its remote request may correctly say the token
      // no longer exists, so it must not turn success into an error state.
      await signOut().catch(() => {});
      setAccountDeletionStep('idle');
      resetToUnauthenticatedRoot(router);
    } catch (error) {
      setAccountDeletionError(
        error instanceof Error
          ? error.message
          : 'We could not delete your account. Your account has not been changed. Please try again.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const userInitials = profile?.display_name
    ? profile.display_name.trim().slice(0, 1).toUpperCase()
    : null;
  const profileName = firstName ?? firstNameFromValue(session?.user.displayName);
  const profileEmail = session?.user?.email ?? 'Host account';

  return (
    <View style={styles.container}>
      {/* 1. Header Toolbar (Separator border line removed) */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ExpoImage
          source={require('../../assets/brand/dashboard-logo.png')}
          style={styles.dashboardLogo}
          contentFit="contain"
          accessible
          accessibilityLabel="Stills"
        />

        {/*
          Profile and Create, in the corner the header's `space-between` puts
          them in. They used to be split between here and a bottom bar; one
          corner holds both now, and the bar is gone.

          Order is deliberate: Create sits furthest right, where a thumb
          reaches first, because it is the only action on this screen that
          makes something. Profile is the way to everything else.
        */}
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setProfileModalVisible(true)}
            style={styles.headerProfileBtn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <PersonIcon size={22} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={() => router.push('/create')}
            style={styles.headerPlusBtn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Create an event"
          >
            <ExpoImage
              source={require('../../assets/brand/dashboard-create-cta.png')}
              style={styles.headerPlusImage}
              contentFit="contain"
            />
            <PlusIcon size={24} />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContainer, 
          // Nothing floats over this scroll any more — the bottom bar is
          // gone and both its controls live in the header.
          { paddingBottom: insets.bottom + spacing.lg }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <LoadingState
            label="Loading your events"
            detail="Getting your celebrations ready."
          />
        ) : (
          <>
            {upcomingEvents.length > 0 ? (
              <View style={styles.dashboardSection}>
                {upcomingEvents.length === 1 ? (
                  <HomeUpcomingEventCard
                    celebration={upcomingEvents[0]}
                    themes={themes}
                    width={upcomingHeroWidth}
                    onPress={() => router.push(`/celebration/${upcomingEvents[0].id}`)}
                  />
                ) : (
                  <>
                    <Animated.ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={upcomingCarouselInterval}
                      snapToAlignment="start"
                      contentContainerStyle={styles.upcomingCarouselContent}
                      style={styles.edgeToEdgeCarousel}
                      scrollEventThrottle={16}
                      onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { x: upcomingScrollX } } }],
                        { useNativeDriver: true },
                      )}
                    >
                      {upcomingEvents.map((celebration) => (
                        <HomeUpcomingEventCard
                          key={celebration.id}
                          celebration={celebration}
                          themes={themes}
                          width={upcomingHeroWidth}
                          onPress={() => router.push(`/celebration/${celebration.id}`)}
                        />
                      ))}
                    </Animated.ScrollView>

                    <CarouselDots
                      count={upcomingEvents.length}
                      scrollX={upcomingScrollX}
                      interval={upcomingCarouselInterval}
                    />
                  </>
                )}
              </View>
            ) : (
              <View style={styles.dashboardSection}>
                <HomeUpcomingEventsEmptyState
                  width={upcomingHeroWidth}
                  onCreate={() => router.push('/create')}
                />
              </View>
            )}

            {albumsSection}
          </>
        )}
      </ScrollView>


      {/* 7. Profile Bottom Sheet Drawer */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={() => setProfileModalVisible(false)} 
          />
          
          <View style={[styles.drawerSheet, styles.profileDrawerSheet]}>
            <View style={styles.drawerHandle} />

            <View style={styles.profileDrawerHeader}>
              <View style={styles.profileAvatarLarge}>
                {userInitials ? (
                  <AppText style={styles.profileAvatarInitial}>{userInitials}</AppText>
                ) : (
                  <UserIcon size={22} color={colours.textPrimary} />
                )}
              </View>
              <View style={styles.profileHeaderText}>
                <AppText variant="bodyLarge" style={styles.profileHeaderTitle}>Profile Settings</AppText>
                <AppText variant="bodySmall" style={styles.profileHeaderSubtitle} numberOfLines={1}>
                  {profileName ? `${profileName} · ${profileEmail}` : profileEmail}
                </AppText>
              </View>
            </View>

            {/*
              Join, rehoused. It left the bottom bar with Profile, and it is
              the one thing in this sheet that is not about the account — so
              it sits above Account settings rather than inside it, where a
              guest arriving to join would have to read past "Change your
              name" to find it.
            */}
            <View style={styles.profileSection}>
              <View style={styles.profileSettingsCard}>
                <ProfileSettingsRow
                  title="Join Event"
                  value="Scan a QR code or paste a link"
                  icon={QrCodeIcon}
                  onPress={() => {
                    setProfileModalVisible(false);
                    // The scanner-and-paste screen, not a second join
                    // implementation.
                    router.push('/join');
                  }}
                />
              </View>
            </View>

            <View style={styles.profileSection}>
              <AppText variant="eyebrow" tone="secondary" style={styles.profileSectionHeader}>
                Account settings
              </AppText>

              <View style={styles.profileSettingsCard}>
                <ProfileSettingsRow
                  title="Change your name"
                  value={profileName ?? 'Set your name'}
                  onPress={() => {
                    setProfileModalVisible(false);
                    router.push('/your-name?returnTo=profile');
                  }}
                />

                <View style={styles.profileSeparator} />

                <ProfileSettingsRow
                  title="Contact support"
                  value="Get help with your account"
                  onPress={() => {
                    Alert.alert('Contact Support', 'Need help? Get in touch with our team at support@eventcamera.app');
                  }}
                />

                <View style={styles.profileSeparator} />

                <ProfileSettingsRow
                  title="Privacy Policy"
                  value="How we handle your data"
                  onPress={() => {
                    // The hosted policy URL will be connected here once it is
                    // published. Keeping the row active makes the destination
                    // discoverable without introducing a dead external link.
                    Alert.alert('Privacy Policy', 'Our privacy policy will be available here soon.');
                  }}
                />

                <View style={styles.profileSeparator} />

                <ProfileSettingsRow
                  title="Trash"
                  value="Restore recently deleted events"
                  onPress={() => {
                    setProfileModalVisible(false);
                    router.push('/trash');
                  }}
                />

                <View style={styles.profileSeparator} />

                <ProfileSettingsRow
                  title="Log out"
                  value={profileEmail}
                  onPress={async () => {
                    await signOut();
                    setProfileModalVisible(false);
                    resetToUnauthenticatedRoot(router);
                  }}
                />
              </View>
            </View>

            <View style={styles.profileSection}>
              <AppText variant="eyebrow" tone="secondary" style={styles.profileSectionHeader}>
                Danger Zone
              </AppText>

              <View style={styles.profileSettingsCard}>
                <ProfileSettingsRow
                  title="Delete account"
                  value="Permanently remove your account"
                  tone="danger"
                  onPress={handleDeleteAccount}
                />
              </View>
            </View>

            <Pressable
              onPress={() => setProfileModalVisible(false)}
              style={styles.profileCloseButton}
            >
              <AppText variant="button" tone="onBrand">Close</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={accountDeletionStep !== 'idle'}
        animationType="fade"
        transparent
        onRequestClose={cancelAccountDeletion}
      >
        <View style={styles.accountDeletionOverlay}>
          <View style={styles.accountDeletionSheet}>
            {accountDeletionStep === 'warning' ? (
              <>
                <View style={styles.accountDeletionCopy}>
                  <AppText variant="displayLarge">Delete your account?</AppText>
                  <AppText variant="bodyLarge" tone="secondary">
                    This will permanently delete your account and any events you’ve created, including the photos, videos and other content associated with them. This cannot be undone.
                  </AppText>
                </View>
                <View style={styles.accountDeletionActions}>
                  <Button label="Continue" variant="destructive" onPress={() => setAccountDeletionStep('confirm')} />
                  <Button label="Cancel" variant="quiet" onPress={cancelAccountDeletion} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.accountDeletionCopy}>
                  <AppText variant="displayLarge">One final step</AppText>
                  <AppText variant="bodyLarge" tone="secondary">
                    Slide the control to permanently delete your account.
                  </AppText>
                </View>
                {accountDeletionError ? (
                  <View style={styles.accountDeletionError} accessibilityLiveRegion="polite">
                    <AppText variant="bodySmall" style={styles.accountDeletionErrorText}>
                      {accountDeletionError}
                    </AppText>
                  </View>
                ) : null}
                <SlideToConfirm
                  label={isDeletingAccount ? 'Deleting account...' : 'Slide to permanently delete account'}
                  disabled={isDeletingAccount}
                  onComplete={completeAccountDeletion}
                />
                <Button label="Cancel" variant="quiet" disabled={isDeletingAccount} onPress={cancelAccountDeletion} />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Toast
        message={
          trashToastEventId ? 'Moved to Trash. Permanently deleted in 7 days.' : null
        }
        action={
          trashToastEventId
            ? {
                label: restoreMutation.isPending ? 'Restoring' : 'Undo',
                disabled: restoreMutation.isPending,
                onPress: () => restoreMutation.mutate(trashToastEventId),
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.sm,
    // Separator line removed from header as requested
    borderBottomWidth: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileActionIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerPlusBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  headerPlusImage: {
    position: 'absolute',
    width: 52,
    height: 52,
  },
  /**
   * Secondary by construction: same footprint as Create, but a faint fill
   * and an outline glyph instead of a solid ivory disc. No border — a ring
   * here would compete with the gradient next to it.
   */
  headerProfileBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    // A solid near-black rather than a white overlay: over the dashboard's
    // shader background a translucent fill picks up whatever is behind it and
    // drifts light. This stays dark wherever it lands.
    backgroundColor: '#141417',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardLogo: { width: 80, height: 32 },


  /** Centred on the screen, so the button sits on the midline regardless of
      how wide the labels either side of it turn out to be. */

  /** The primary action: the header's old button, moved and slightly raised. */

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colours.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  scrollContainer: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
  },
  dashboardSection: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    color: colours.textPrimary,
  },
  edgeToEdgeCarousel: {
    marginHorizontal: -layout.gutter,
    overflow: 'visible',
  },
  upcomingCarouselContent: {
    paddingHorizontal: layout.gutter,
    gap: spacing.md,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colours.textPrimary,
  },
  upcomingHeroCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colours.surface,
    position: 'relative',
  },
  cardPressed: {
    opacity: 0.88,
  },
  upcomingHeroContent: {
    position: 'absolute',
    left: 30,
    right: 24,
    // The display font carries a little descent below its visible glyphs;
    // this tighter inset makes the title read as genuinely card-anchored.
    bottom: 22,
    gap: 6,
  },
  upcomingHeroTitle: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  upcomingHeroCountdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    overflow: 'visible',
  },
  upcomingHeroCountdown: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.textMedium,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0,
  },
  completedCarouselContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.base,
  },
  completedCardWrap: {
    overflow: 'visible',
  },
  upcomingEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  upcomingEmptyIllustration: {
    width: '82%',
    aspectRatio: 1374 / 1145,
  },
  upcomingEmptyCopy: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  upcomingEmptyTitle: {
    color: colours.textPrimary,
  },
  upcomingEmptyBody: {
    maxWidth: 270,
  },
  upcomingEmptyCreateButton: {
    alignSelf: 'stretch',
    marginHorizontal: spacing.xl,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  upcomingEmptyCreateSurface: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  upcomingEmptyCreateLabel: {
    color: '#090909',
  },
  floatingMenuContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingButton: {
    backgroundColor: colours.brandPrimary,
    borderRadius: radii.pill,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 6, 0.85)',
    justifyContent: 'flex-end',
  },
  accountDeletionOverlay: {
    flex: 1,
    backgroundColor: colours.scrim,
    justifyContent: 'center',
    padding: layout.gutter,
  },
  accountDeletionSheet: {
    width: '100%',
    maxWidth: layout.maxReadableWidth,
    alignSelf: 'center',
    backgroundColor: colours.surfaceRaised,
    borderRadius: radii.lg,
    borderColor: colours.borderStrong,
    borderWidth: layout.hairline,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  accountDeletionCopy: {
    gap: spacing.md,
  },
  accountDeletionActions: {
    gap: spacing.sm,
  },
  accountDeletionError: {
    backgroundColor: colours.surfaceMuted,
    borderColor: colours.error,
    borderWidth: layout.hairline,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  accountDeletionErrorText: {
    color: colours.error,
  },
  drawerSheet: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    borderTopWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  profileDrawerSheet: {
    gap: spacing.base,
    paddingBottom: spacing.xxl,
    borderTopWidth: 0,
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  profileDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  profileAvatarLarge: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
  },
  profileAvatarInitial: {
    color: colours.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  profileHeaderText: {
    flex: 1,
    gap: 3,
  },
  profileHeaderTitle: {
    color: colours.textPrimary,
  },
  profileHeaderSubtitle: {
    color: colours.textSecondary,
  },
  profileSection: {
    gap: spacing.xs,
  },
  profileSectionHeader: {
    paddingLeft: spacing.xs,
  },
  profileSettingsCard: {
    // Rows sit directly on the sheet rather than inside outlined cards. The
    // remaining separators provide rhythm without making the panel feel boxed.
    backgroundColor: 'transparent',
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    gap: spacing.md,
  },
  profileActionRowPressed: {
    backgroundColor: colours.surfaceMuted,
  },
  profileActionText: {
    flex: 1,
    gap: 4,
  },
  profileActionLabel: {
    color: colours.textPrimary,
  },
  profileActionLabelDanger: {
    color: colours.error,
  },
  profileActionValue: {
    color: colours.textSecondary,
  },
  profileActionValueDanger: {
    color: colours.error,
    opacity: 0.78,
  },
  profileSeparator: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
    marginHorizontal: spacing.base,
  },
  profileCloseButton: {
    backgroundColor: colours.brandPrimary,
    borderRadius: radii.pill,
    paddingVertical: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  drawerActions: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
  },
  drawerDivider: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
  },
});
