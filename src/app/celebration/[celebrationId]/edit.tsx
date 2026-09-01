import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Pressable, ScrollView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { decodeRevealMode } from '@/features/celebrations/draft/types';
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
import { colours, layout, spacing, radii } from '@/design';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';
import { useEventEntitlements } from '@/features/entitlements/use-event-entitlements';
import {
  upgradesForFeature,
  upgradesForGuestLimit,
  type FeatureKey,
} from '@/features/entitlements/event-entitlements';
import { UpgradeSheet } from '@/features/entitlements/upgrade-sheet';
import { LockIcon } from '@/components/ui/icons';
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
  /**
   * The guest-allowance sheet.
   *
   * Separate from `upgradeRequest` because it is not asking for a *feature* —
   * it is asking for a bigger number, and more than one tier can satisfy that.
   * Which ones is `upgradesForGuestLimit`'s answer, not this screen's.
   */
  const [guestLimitOpen, setGuestLimitOpen] = useState(false);

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


  const handleEditField = (field: 'name' | 'closing' | 'cover' | 'photo-limit' | 'reveal' | 'treatment' | 'challenges' | 'guestbook') => {
    // The database has one reveal setting for the whole session — nothing
    // distinguishes a host's view from a guest's (see reveal/state.ts). Both
    // tiers of the reveal step's UI are seeded from that single value, so
    // reopening settings shows "Same time as me" rather than a stale split
    // left over from a previous draft.
    const { choice: revealChoice, customRevealAt } = decodeRevealMode(
      primarySession.reveal_mode,
      primarySession.reveal_at,
      celebration.ends_at,
    );
    const guestRevealChoice =
      primarySession.gallery_visibility === 'hosts_only' ? 'never' : revealChoice;

    // Seed draft with ALL current settings of this celebration
    update({
      title: celebration.title,
      celebrationType: celebration.celebration_type || 'wedding',
      endsAt: celebration.ends_at,
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
      hostRevealChoice: revealChoice,
      hostCustomRevealAt: customRevealAt,
      guestRevealChoice,
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

  const formattedEndDate = celebration.ends_at
    ? new Date(celebration.ends_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
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
                <AppText variant="labelLarge" style={styles.rowLabel}>End Date</AppText>
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
              Number of Guests. Read-only about the package rather than a
              picker: the allowance is not a setting the host types, it is
              what they bought — so the row reports it and offers the tiers
              that would raise it.
            */}
            <Pressable onPress={() => setGuestLimitOpen(true)} style={styles.row}>
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
                    : entitlements.guestLimit === 'unlimited'
                      ? `Unlimited · ${entitlements.plan.displayName}`
                      : `Up to ${entitlements.guestLimit} · ${entitlements.plan.displayName}`}
                </AppText>
              </View>
              <ChevronRightIcon />
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
                  {entitlements.has('challenges') ? 'Manage Challenges' : 'Stories+'}
                </AppText>
              </View>
              {entitlements.has('challenges') ? <ChevronRightIcon /> : <LockIcon size={14} color={colours.textSecondary} />}
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
                  {entitlements.has('guestbook') ? 'Edit message' : 'Stories+'}
                </AppText>
              </View>
              {entitlements.has('guestbook') ? <ChevronRightIcon /> : <LockIcon size={14} color={colours.textSecondary} />}
            </Pressable>
          </View>
        </View>

        {upgradeRequest ? (
          <UpgradeSheet
            visible
            celebrationId={String(celebrationId)}
            currentPlan={entitlements.plan}
            options={upgradesForFeature(entitlements.plan, upgradeRequest.feature)}
            title={upgradeRequest.title}
            onClose={() => setUpgradeRequest(null)}
            onUpgraded={() => {
              const resume = upgradeRequest.onUnlocked;
              setUpgradeRequest(null);
              resume?.();
            }}
          />
        ) : null}

        {/*
          Raising the allowance. Every tier above the current one qualifies,
          because any of them is more room — so unlike a feature lock this
          legitimately offers a choice, and the host picks how far to go.
        */}
        {guestLimitOpen ? (
          <UpgradeSheet
            visible
            celebrationId={String(celebrationId)}
            currentPlan={entitlements.plan}
            options={upgradesForGuestLimit(entitlements.plan, 'unlimited').length > 0
              ? upgradesForGuestLimit(entitlements.plan, (entitlements.guestLimit === 'unlimited'
                  ? 'unlimited'
                  : entitlements.guestLimit + 1))
              : []}
            title="More guests"
            onClose={() => setGuestLimitOpen(false)}
            onUpgraded={() => setGuestLimitOpen(false)}
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
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderSubtle,
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
  sectionHeader: {
    paddingLeft: spacing.xs,
  },
  card: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
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
