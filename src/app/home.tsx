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
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { DashboardShaderBackground } from '@/components/ui/dashboard-shader-background';
import { LoadingState } from '@/components/feedback/loading-state';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ClockIcon } from '@/components/ui/icons';
import { SlideToConfirm } from '@/components/forms/slide-to-confirm';
import { useAuth } from '@/features/auth/context';
import { WORDMARK } from '@/features/onboarding/still-intro';
import { resetToUnauthenticatedRoot } from '@/lib/navigation/session-root';
import {
  celebrationKeys,
  listCelebrations,
  restoreCelebrationFromTrash,
  type CelebrationSummary,
} from '@/services/celebrations';
import { listThemes, themeKeys } from '@/services/themes';
import { fetchMyProfile, firstNameFrom, firstNameFromValue, profileKeys } from '@/services/profile';
import { colours, fontFamilies, layout, radii, spacing } from '@/design';
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

function PlusIcon({ size = 22, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M12 5v14M5 12h14" 
        stroke={color} 
        strokeWidth={3} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
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
  if (totalHours < 1) return 'Less than 1 hour left';

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayCopy = days === 1 ? '1 day' : `${days} days`;
  const hourCopy = hours === 1 ? '1 hour' : `${hours} hours`;

  if (days <= 0) return `${hourCopy} left`;
  if (hours <= 0) return `${dayCopy} left`;
  return `${dayCopy} ${hourCopy} left`;
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

  const theme = (themes ?? []).find(
    (item) => item.id === celebration.defaultThemeId || item.slug === celebration.defaultThemeId,
  );
  const accentColor =
    (theme?.design_tokens as Record<string, string> | null)?.accent || colours.textPrimary;

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
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.48)', 'rgba(0,0,0,0.92)']}
        locations={[0.12, 0.58, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.upcomingHeroContent}>
        <AppText
          variant="displayLarge"
          style={[styles.upcomingHeroTitle, { color: accentColor }]}
          numberOfLines={3}
        >
          {celebration.title}
        </AppText>
        <View style={styles.upcomingHeroCountdownRow}>
          <ClockIcon size={14} color="rgba(239, 233, 224, 0.82)" />
          <AppText style={styles.upcomingHeroCountdown} numberOfLines={1} adjustsFontSizeToFit>
            {formatUpcomingTimeLeft(celebration)}
          </AppText>
        </View>
      </View>
    </Pressable>
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
  onPress,
}: {
  title: string;
  value: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const isDanger = tone === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileActionRow, pressed && styles.profileActionRowPressed]}
    >
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
/**
 * The dashboard's bottom navigation.
 *
 * Three slots of equal width: two quiet destinations and, between them, the
 * primary action raised so it breaks the bar's top edge. Equal thirds are what
 * put Join and Profile at the outer thirds rather than jammed against the
 * gutters, and they leave the centre free for the action to sit in without
 * crowding either.
 *
 * Deliberately not a tab bar: nothing here is a tab and there is no selected
 * state to show. It is a hairline, small icons and small labels over the
 * page's own background, with one thing on it that is meant to be pressed.
 */

/** The bar the reader sees, above the safe-area inset. */
const NAV_BAR_HEIGHT = 58;
/** How far the create button rises above that bar. */
const NAV_RAISE = 20;

interface NavItem {
  key: string;
  label: string;
  icon: (props: { size?: number; color?: string }) => React.ReactElement;
  onPress: () => void;
}

function DashboardNav({
  join,
  profile,
  bottomInset,
}: {
  join: NavItem;
  profile: NavItem;
  bottomInset: number;
}) {
  const rowHeight = NAV_RAISE + NAV_BAR_HEIGHT;

  return (
    <View style={[styles.navRoot, { height: rowHeight + bottomInset }]}>
      <View style={[styles.navBar, { top: NAV_RAISE }]} pointerEvents="none" />

      {/* Two slots now that Create has gone back to the header, so each
          centres in its own half rather than leaving a hole between them. */}
      <View style={[styles.navRow, { height: rowHeight }]}>
        {[join, profile].map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={[styles.navSlot, { paddingTop: NAV_RAISE }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <item.icon size={19} color={colours.textSecondary} />
            <AppText variant="caption" style={styles.navLabel}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

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
  const completedEvents = useMemo(
    () => list.filter(isCompletedEvent),
    [list],
  );
  const upcomingHeroWidth = screenWidth - layout.gutter * 2;
  /** How far the carousel travels per card — one dot's worth of scroll. */
  const upcomingCarouselInterval = upcomingHeroWidth + spacing.md;
  const upcomingScrollX = useRef(new Animated.Value(0)).current;
  const completedCardWidth = Math.round((screenWidth - layout.gutter * 2 - spacing.base) / 2);
  const firstName = firstNameFrom(profile);

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
      <DashboardShaderBackground />

      {/* 1. Header Toolbar (Separator border line removed) */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {/*
          A stand-in wordmark until the real asset arrives.

          Set in the display face rather than approximated in the UI sans, and
          reading its text from the same constant the intro's logo is built
          from — the two are the same mark, and a reader moving between them
          should not be able to tell they are drawn by different code, nor
          find them disagreeing about the name after a rename.
        */}
        <AppText style={styles.wordmark}>{WORDMARK}</AppText>

        {/*
          Create, in the corner the header's `space-between` puts it in.
          It sits apart from Join and Profile deliberately — those two are
          ways of getting somewhere, this one makes something, and it is the
          only action on this screen that does.
        */}
        <Pressable
          onPress={() => router.push('/create')}
          style={styles.headerPlusBtn}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Create an event"
        >
          <PlusIcon size={24} color="#0B0B0C" />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContainer, 
          // Clear of the bottom navigation, which floats over this scroll.
          { paddingBottom: insets.bottom + NAV_RAISE + NAV_BAR_HEIGHT + spacing.lg }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <LoadingState
            label="Loading your events"
            detail="Getting your celebrations ready."
          />
        ) : list.length > 0 ? (
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
            ) : null}

            {completedEvents.length > 0 ? (
              <View style={styles.dashboardSection}>
                <AppText variant="titleMedium" style={styles.sectionTitle}>
                  Albums
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
            ) : null}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <AppText variant="heading" tone="secondary" style={styles.emptyText}>
              No events found
            </AppText>
            <AppText variant="bodySmall" tone="secondary" align="center">
              Tap the button below to capture the memories of your first celebration.
            </AppText>
          </View>
        )}
      </ScrollView>

      {/*
        Join and Profile. One home each, so there is no second way to reach
        either — Create is the exception, and it lives in the header.
      */}
      <DashboardNav
        bottomInset={insets.bottom}
        join={{
          key: 'join',
          label: 'Join',
          icon: QrCodeIcon,
          // The scanner-and-paste screen, not a second join implementation.
          onPress: () => router.push('/join'),
        }}
        profile={{
          key: 'profile',
          label: 'Profile',
          icon: UserIcon,
          onPress: () => setProfileModalVisible(true),
        }}
      />


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
    backgroundColor: colours.background,
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
    gap: 12,
  },
  headerPlusBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFE9E0', // warm ivory, makes the create action pop
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  /** The stand-in wordmark, at roughly the ink height the logo asset had. */
  wordmark: {
    fontFamily: fontFamilies.display,
    color: colours.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },

  /**
   * The navigation's full extent, including the space the create button rises
   * into. Transparent: the bar itself is drawn separately, below.
   *
   * The button overlaps the bar's top edge, and doing that with a negative
   * margin would put it outside its parent's bounds — where Android stops
   * delivering touches. Giving the container the extra height instead keeps
   * every tap target inside it.
   */
  navRoot: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  /**
   * The bar: a hairline and the page's own background.
   *
   * No pill, no blur, no elevation — it should read as the floor of the
   * screen rather than as an object floating above the events.
   */
  navBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colours.background,
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
  },

  navRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    paddingHorizontal: layout.gutter,
  },
  /**
   * Join and Profile, centred in the bar rather than hung from its top.
   *
   * `paddingTop` pushes the content box down past the space the create button
   * rises into, so `center` centres them in the bar the reader actually sees —
   * not in the taller container that exists only to hold the button.
   */
  navSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: colours.textSecondary, letterSpacing: 0.3 },

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
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.xs,
  },
  upcomingHeroTitle: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  upcomingHeroCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  upcomingHeroCountdown: {
    flexShrink: 1,
    color: 'rgba(239, 233, 224, 0.82)',
    fontFamily: fontFamilies.textMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.giant,
    gap: spacing.sm,
  },
  emptyText: {
    color: colours.textSecondary,
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
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
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
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
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
