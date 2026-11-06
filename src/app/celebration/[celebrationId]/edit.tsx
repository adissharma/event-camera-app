import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Pressable, ScrollView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { topTierName } from '@/features/payments/plan-catalogue';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { decodeRevealMode } from '@/features/celebrations/draft/types';
import type { RevealMode } from '@/types/database';
import {
  celebrationDetailKeys,
  fetchCelebrationDetail,
} from '@/services/celebration-detail';
import {
  celebrationKeys,
  moveCelebrationToTrash,
  type CelebrationSummary,
} from '@/services/celebrations';
import { listThemes, themeKeys } from '@/services/themes';
import { LinearGradient } from 'expo-linear-gradient';

import { colours, fontFamilies, layout, spacing, radii, REVEAL_TRACK_GRADIENT } from '@/design';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';
import { useEventEntitlements } from '@/features/entitlements/use-event-entitlements';
import {
  upgradesForFeature,
  type FeatureKey,
} from '@/features/entitlements/event-entitlements';
import { UpgradeSheet } from '@/features/entitlements/upgrade-sheet';
import { GuestLimitSheet } from '@/features/entitlements/guest-limit-sheet';
import { effectiveGuestLimit } from '@/features/entitlements/guest-limit';
import { eventGuestLimitKeys, fetchEventGuestLimit } from '@/services/event-guest-limit';
import Svg, { Path } from 'react-native-svg';

function ChevronRightIcon({ size = 16, color = '#6B7280' }) {
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

/** What a row's feature or allowance would take: tapping the row opens the upgrade. */
function UpgradePill() {
  return (
    <LinearGradient
      colors={[REVEAL_TRACK_GRADIENT[1], REVEAL_TRACK_GRADIENT[2]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.upgradeChip}
    >
      <AppText variant="bodySmall" style={styles.upgradeChipText}>Upgrade</AppText>
    </LinearGradient>
  );
}

export default function EditEventScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { update } = useCreationDraft();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (shouldBlockHostRouteOnWeb(Platform.OS)) {
      router.replace(`/celebration/${celebrationId}`);
    }
  }, [router, celebrationId]);

  // Needed to turn the stored `default_theme_id` back into the slug the
  // cover step selects by. Cached under the shared themes key, so this is a
  // read from the same list the picker already loaded rather than a fetch.
  const { data: allThemes = [] } = useQuery({
    queryKey: themeKeys.list(),
    queryFn: listThemes,
  });

  const { data, isLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  // Above the loading return, with every other hook: hooks must run in the
  // same order on every render, and the early return below would skip these
  // on the first pass and run them on the second.
  const entitlements = useEventEntitlements(String(celebrationId));
  const [upgradeRequest, setUpgradeRequest] = useState<{
    feature: FeatureKey;
    title: string;
    onUnlocked?: () => void;
  } | null>(null);
  const [guestLimitOpen, setGuestLimitOpen] = useState(false);
  const eventSessionId = data?.primarySession?.id;
  const { data: hostGuestLimit = null } = useQuery({
    queryKey: eventGuestLimitKeys.forSession(eventSessionId ?? ''),
    queryFn: () => fetchEventGuestLimit(eventSessionId!),
    enabled: Boolean(eventSessionId),
    // A database without this column yet costs the host's number, not the screen.
    retry: false,
  });

  if (isLoading || !data?.primarySession) {
    return (
      <Screen scrollable={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  const { celebration, primarySession } = data;
  const guestLimit = effectiveGuestLimit(entitlements.plan, hostGuestLimit);
  const canUpgradeGuests = Boolean(entitlements.plan) && entitlements.plan?.guestLimit !== 'unlimited';


  const handleEditField = (field: 'name' | 'closing' | 'cover' | 'photo-limit' | 'reveal' | 'treatment' | 'challenges' | 'guestbook') => {
    // `reveal_mode` is the guests' reveal. The host's own is `host_reveal_mode`,
    // which sessions from before hosts had one do not carry: those seed both
    // steps from the guests' time, as they always did.
    const sessionEndsAt = primarySession.ends_at ?? celebration.ends_at;
    const { choice: revealChoice, customRevealAt } = decodeRevealMode(
      primarySession.reveal_mode,
      primarySession.reveal_at,
      sessionEndsAt,
    );
    const guestRevealChoice =
      primarySession.gallery_visibility === 'hosts_only' ? 'never' : revealChoice;
    const hostSession = primarySession as typeof primarySession & {
      host_reveal_mode?: RevealMode | null;
      host_reveal_at?: string | null;
    };
    const hostReveal = hostSession.host_reveal_mode
      ? decodeRevealMode(hostSession.host_reveal_mode, hostSession.host_reveal_at ?? null, sessionEndsAt)
      : { choice: revealChoice, customRevealAt };
    // The guest step asks how long after the host, so it is seeded with the gap.
    const guestDelayHours =
      hostSession.host_reveal_at && primarySession.reveal_at
        ? Math.max(
            0,
            Math.round(
              (Date.parse(primarySession.reveal_at) - Date.parse(hostSession.host_reveal_at)) /
                3_600_000,
            ),
          )
        : 0;

    // Seed draft with ALL current settings of this celebration
    update({
      title: celebration.title,
      celebrationType: celebration.celebration_type || 'wedding',
      endsAt: primarySession.ends_at ?? celebration.ends_at,
      timezone: celebration.timezone,
      // `default_theme_id` is an id; everything downstream — the carousel's
      // selection and `resolveCoverTemplate` — keys off the slug. Seeding the
      // raw id matched no theme, so reopening settings always showed the
      // first template as selected no matter what the host had saved.
      themeSlug:
        allThemes.find((theme) => theme.id === celebration.default_theme_id)?.slug ??
        celebration.default_theme_id,
      coverStoragePath: celebration.cover_storage_path,
      coverLocalUri: celebration.cover_storage_path, // fallback
      shotLimitPerGuest: primarySession.shot_limit_per_guest,
      captureMode: primarySession.capture_mode || 'camera_and_library',
      cameraRollUploadsEnabled: (primarySession.capture_mode ?? 'camera_and_library') !== 'camera_only',
      galleryVisibility: primarySession.gallery_visibility,
      guestDownloadsEnabled: primarySession.guest_downloads_enabled,
      hostRevealChoice: hostReveal.choice,
      hostCustomRevealAt: hostReveal.customRevealAt,
      guestRevealChoice,
      guestRevealDelayHours: guestDelayHours,
      guestCustomRevealAt: guestRevealChoice === 'never' ? null : customRevealAt,
      photoTreatment: primarySession.photo_treatment || 'original',
      editCelebrationId: celebration.id, // Mark that we are editing this event!
      editSessionId: primarySession.id,
    });

    // Navigate to the edit section without losing the Manage Event screen
    // beneath it. Using push here preserves the stack so the swipe-back
    // gesture animates back to Manage Event instead of falling through to the
    // gallery.
    if (field === 'name') {
      router.push('/create/name');
    } else if (field === 'closing') {
      router.push('/create/closing');
    } else if (field === 'cover') {
      router.push('/create/cover');
    } else if (field === 'photo-limit') {
      // The event id travels with it so the step knows it is editing a
      // published event rather than building a draft. The distinction decides
      // whether Unlimited is gated: during creation the host picks freely and
      // the paywall prices the result, but here the package is already bought
      // and a setting they cannot have must not silently apply.
      router.push({ pathname: '/create/photo-limit', params: { celebrationId: String(celebrationId) } });
    } else if (field === 'reveal') {
      router.push('/create/reveal');
    } else if (field === 'treatment') {
      router.push('/create/treatment');
    } else if (field === 'challenges') {
      router.push(`/celebration/${celebrationId}/challenges` as never);
    } else if (field === 'guestbook') {
      router.push(`/celebration/${celebrationId}/guestbook-settings` as never);
    }
  };

  /**
   * A Manage Event row the host can see but has not paid for.
   *
   * Intercepted rather than hidden, and rather than disabled: the host is the
   * only person who can unlock it, so the row's job is to be found. What the
   * tap opens is the way to have it, and on success it continues into the
   * thing they were opening.
   */
  const openGated = (feature: FeatureKey, title: string, open: () => void) => {
    if (entitlements.has(feature)) {
      open();
      return;
    }
    setUpgradeRequest({ feature, title, onUnlocked: open });
  };

  const handleDelete = () => {
    Alert.alert(
      'Move event to Trash?',
      'This event will be permanently deleted in 7 days. You can restore it from Trash before then.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await moveCelebrationToTrash(String(celebrationId));
              // The event is intentionally hidden from normal detail queries
              // as soon as it enters Trash. Remove this screen's stale detail
              // cache before invalidating the dashboard list so React Query
              // does not refetch a row that is no longer readable.
              queryClient.removeQueries({
                queryKey: celebrationDetailKeys.detail(String(celebrationId)),
              });
              queryClient.setQueryData<CelebrationSummary[]>(
                celebrationKeys.list(),
                (current) => current?.filter((item) => item.id !== String(celebrationId)) ?? current,
              );
              await queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
              router.replace({
                pathname: '/home',
                params: { trashedEventId: String(celebrationId) },
              });
            } catch {
              Alert.alert('Error', 'Failed to move event to Trash. Please try again.');
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const effectiveEndsAt = primarySession.ends_at ?? celebration.ends_at;

  const formattedEndDate = effectiveEndsAt
    ? new Date(effectiveEndsAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not set';

  const limitText = primarySession.shot_limit_per_guest === null
    ? 'Unlimited'
    : `${primarySession.shot_limit_per_guest} photos`;

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <AppText style={styles.backText}>Close</AppText>
        </Pressable>
        <AppText variant="bodyLarge" style={styles.headerTitle}>Manage Event</AppText>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <AppText variant="eyebrow" tone="secondary" style={styles.sectionHeader}>
            Event settings
          </AppText>
          
          <View style={styles.card}>
            <Pressable onPress={() => handleEditField('name')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Event Name</AppText>
                <AppText variant="bodySmall" style={styles.rowValue} numberOfLines={1}>{celebration.title}</AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => handleEditField('closing')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>End Date and Time</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>{formattedEndDate}</AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => handleEditField('cover')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Cover Photo</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>Edit Cover</AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <View style={styles.separator} />

            {/*
              Number of Guests. What the package allows, as the host has narrowed
              it. Below the top package, the upgrade is called out on the row
              itself, because this is where a host goes when they need more room.
            */}
            <Pressable
              onPress={() => {
                if (!entitlements.isLoading) setGuestLimitOpen(true);
              }}
              style={styles.row}
            >
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Number of Guests</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>
                  {/*
                    An unresolved package reads as unknown, not as zero. The
                    entitlement layer answers 0 so that gating fails closed,
                    which is right for deciding what to unlock and wrong for
                    telling a host what they bought — "Up to 0 guests" is a
                    statement about their event, and it is not a true one.
                  */}
                  {entitlements.isLoading || !entitlements.plan
                    ? '—'
                    : guestLimit === 'unlimited'
                      ? `No limit · ${entitlements.plan.displayName}`
                      : canUpgradeGuests
                        ? `${data.metrics.guestsJoined} of ${guestLimit} joined · ${entitlements.plan.displayName}`
                        : `Up to ${guestLimit} · ${entitlements.plan.displayName}`}
                </AppText>
              </View>
              {canUpgradeGuests ? (
                <UpgradePill />
              ) : (
                <ChevronRightIcon />
              )}
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => handleEditField('photo-limit')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Guest Photo Limit</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>{limitText}</AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => router.push(`/celebration/${celebrationId}/seating` as never)} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Seating Plan</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>Guest seats and floor plan</AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

          </View>
        </View>

        <View style={[styles.section, styles.photoSettingsSection]}>
          <AppText variant="eyebrow" tone="secondary" style={styles.sectionHeader}>
            Photo settings
          </AppText>

          <View style={styles.card}>
            <Pressable onPress={() => handleEditField('reveal')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Reveal Delay</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>
                  {primarySession.reveal_mode === 'instant' ? 'Instant' : 'Delayed'}
                </AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => handleEditField('treatment')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Photo Filter</AppText>
                <AppText variant="bodySmall" style={[styles.rowValue, { textTransform: 'capitalize' }]}>
                  {primarySession.photo_treatment || 'original'}
                </AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <View style={styles.separator} />

            <Pressable
              onPress={() =>
                openGated('challenges', 'Unlock Challenges', () => handleEditField('challenges'))
              }
              style={styles.row}
            >
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Challenges</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>
                  {entitlements.has('challenges') ? 'Manage Challenges' : topTierName()}
                </AppText>
              </View>
              {entitlements.has('challenges') ? <ChevronRightIcon /> : <UpgradePill />}
            </Pressable>

            <View style={styles.separator} />

            <Pressable
              onPress={() =>
                openGated('guestbook', 'Unlock Guestbook', () => handleEditField('guestbook'))
              }
              style={styles.row}
            >
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Guestbook</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>
                  {entitlements.has('guestbook') ? 'Edit message' : topTierName()}
                </AppText>
              </View>
              {entitlements.has('guestbook') ? <ChevronRightIcon /> : <UpgradePill />}
            </Pressable>
          </View>
        </View>

        {upgradeRequest ? (
          <UpgradeSheet
            visible
            celebrationId={String(celebrationId)}
            currentPlan={entitlements.plan}
            options={upgradesForFeature(entitlements.plan, upgradeRequest.feature)}
            feature={upgradeRequest.feature}
            title={upgradeRequest.title}
            onClose={() => setUpgradeRequest(null)}
            onUpgraded={() => {
              const resume = upgradeRequest.onUnlocked;
              setUpgradeRequest(null);
              resume?.();
            }}
          />
        ) : null}

        {guestLimitOpen ? (
          <GuestLimitSheet
            celebrationId={String(celebrationId)}
            eventSessionId={primarySession.id}
            plan={entitlements.plan}
            guestsJoined={data.metrics.guestsJoined}
            onClose={() => setGuestLimitOpen(false)}
          />
        ) : null}

        <AppText variant="caption" tone="secondary" style={styles.footerNote}>
          Changes made within setup screens will apply instantly to this celebration.
        </AppText>

        <View style={styles.dangerSection}>
          <AppText variant="eyebrow" tone="secondary" style={styles.sectionHeader}>
            Danger Zone
          </AppText>
          <Pressable
            style={[styles.deleteButton, isDeleting && { opacity: 0.5 }]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            <AppText style={styles.deleteButtonText}>
              {isDeleting ? 'Moving...' : 'Delete Event'}
            </AppText>
          </Pressable>
          <AppText variant="caption" tone="secondary" style={styles.deleteNote}>
            Move this event to Trash. It can be restored for 7 days.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  upgradeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  upgradeChipText: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.textSemiBold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.xs,
    width: 50,
  },
  backText: {
    fontSize: 14,
    color: colours.textPrimary,
  },
  headerTitle: {
    color: colours.textPrimary,
  },
  container: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.xs,
  },
  photoSettingsSection: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    paddingLeft: spacing.xs,
  },
  card: {
    // Match the flatter profile menu: settings are organised by quiet row
    // separators rather than boxed into an outlined card.
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  rowLabelContainer: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    color: colours.textPrimary,
  },
  rowValue: {
    color: colours.textSecondary,
  },
  separator: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
    marginHorizontal: spacing.base,
  },
  footerNote: {
    marginTop: spacing.xl,
    textAlign: 'center',
    paddingHorizontal: spacing.base,
  },
  dangerSection: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
  },
  deleteNote: {
    textAlign: 'center',
    paddingHorizontal: spacing.base,
  },
});
