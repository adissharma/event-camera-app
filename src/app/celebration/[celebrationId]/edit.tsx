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
  archiveCelebration,
} from '@/services/celebration-detail';
import { celebrationKeys } from '@/services/celebrations';
import { colours, layout, spacing, radii } from '@/design';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';
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

  const { data, isLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
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
      router.push('/create/photo-limit');
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

  const handleDelete = () => {
    Alert.alert(
      'Delete Event?',
      'This will permanently delete this event and all associated photos. This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await archiveCelebration(String(celebrationId));
              await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
              router.replace('/home');
            } catch {
              Alert.alert('Error', 'Failed to delete event. Please try again.');
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

            <Pressable onPress={() => handleEditField('challenges')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Challenges</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>Manage Challenges</AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => handleEditField('guestbook')} style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <AppText variant="labelLarge" style={styles.rowLabel}>Guestbook</AppText>
                <AppText variant="bodySmall" style={styles.rowValue}>Edit message</AppText>
              </View>
              <ChevronRightIcon />
            </Pressable>
          </View>
        </View>

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
              {isDeleting ? 'Deleting...' : 'Delete Event'}
            </AppText>
          </Pressable>
          <AppText variant="caption" tone="secondary" style={styles.deleteNote}>
            Permanently delete this event and all photos. This cannot be undone.
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
