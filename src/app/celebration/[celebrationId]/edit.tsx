import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { OptionCard } from '@/components/forms/option-card';
import { ToggleRow } from '@/components/forms/toggle-row';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import {
  celebrationDetailKeys,
  fetchCelebrationDetail,
  updateEventSettings,
  type EventSettingsPatch,
} from '@/services/celebration-detail';
import { celebrationKeys } from '@/services/celebrations';
import { PHOTO_LIMIT_OPTIONS } from '@/config/app-config';
import { colours, layout, spacing } from '@/design';
import { copy, t } from '@/i18n';
import type { GalleryVisibility } from '@/types/database';

/**
 * Editing a published event.
 *
 * Only the fields the host actually touched are sent. Sending the whole object
 * back would clobber any change made on another device between load and save —
 * a real risk here, since a couple frequently manage one event from two phones.
 */
export default function EditEventScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  // The patch holds ONLY what the host has touched. Nothing is seeded from the
  // server into local state, which avoids syncing via an effect (cascading
  // renders) and makes change detection exact — an untouched field is simply
  // absent rather than compared for equality against a stale copy.
  const [patch, setPatch] = useState<EventSettingsPatch>({});
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!data?.primarySession) throw new Error('This event has no session to update');
      await updateEventSettings(data.celebration.id, data.primarySession.id, patch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebrationId)),
      });
      await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
      router.back();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  if (isLoading || !data?.primarySession) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  const session = data.primarySession;
  const currentLimit =
    patch.shotLimitPerGuest !== undefined
      ? patch.shotLimitPerGuest
      : session.shot_limit_per_guest;
  const currentVisibility =
    patch.galleryVisibility ?? (session.gallery_visibility as GalleryVisibility);

  const title = patch.title ?? data.celebration.title;
  const hasChanges = Object.keys(patch).length > 0;

  return (
    <Screen
      stickyAction={
        <View style={{ gap: spacing.sm }}>
          {error ? (
            <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
          <Button
            label={copy.common.save}
            loading={save.isPending}
            disabled={!hasChanges}
            disabledReason="Change something first"
            haptic
            onPress={() => save.mutate()}
          />
          <Button label={copy.common.cancel} variant="quiet" onPress={() => router.back()} />
        </View>
      }
    >
      <View style={{ gap: spacing.xl }}>
        <AppText variant="displayLarge">{copy.dashboard.editEvent}</AppText>

        <TextField
          label={copy.create.nameLabel}
          value={title}
          onChangeText={(next) => setPatch((p) => ({ ...p, title: next }))}
          maxLength={200}
        />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary">
            Photos per guest
          </AppText>
          {PHOTO_LIMIT_OPTIONS.map((option) => (
            <OptionCard
              key={String(option)}
              label={
                option === null
                  ? copy.create.photoLimitUnlimited
                  : t(copy.create.photoLimitCount, { count: option })
              }
              selected={currentLimit === option}
              onPress={() => setPatch((p) => ({ ...p, shotLimitPerGuest: option }))}
            />
          ))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary">
            Who sees photos
          </AppText>
          {(
            [
              ['all_guests', copy.create.privacyAllGuests],
              ['own_only', copy.create.privacyOwnOnly],
              ['hosts_only', copy.create.privacyHostsOnly],
            ] as const
          ).map(([value, label]) => (
            <OptionCard
              key={value}
              label={label}
              selected={currentVisibility === value}
              onPress={() => setPatch((p) => ({ ...p, galleryVisibility: value }))}
            />
          ))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <ToggleRow
            label={copy.create.guestDownloads}
            value={patch.guestDownloadsEnabled ?? session.guest_downloads_enabled}
            onValueChange={(guestDownloadsEnabled) =>
              setPatch((p) => ({ ...p, guestDownloadsEnabled }))
            }
          />
          <ToggleRow
            label={copy.create.hostApproval}
            value={patch.moderationEnabled ?? session.moderation_enabled}
            onValueChange={(moderationEnabled) => setPatch((p) => ({ ...p, moderationEnabled }))}
          />
        </View>

        <AppText
          variant="caption"
          tone="secondary"
          style={{ borderTopWidth: layout.hairline, borderTopColor: colours.borderSubtle, paddingTop: spacing.base }}
        >
          Changes apply immediately, including to guests already in the event.
          Photo treatments are non-destructive — your originals are never altered.
        </AppText>
      </View>
    </Screen>
  );
}
