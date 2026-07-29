import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { DeviceFrame } from '@/components/media/device-frame';
import { VisualPlaceholder } from '@/components/media/visual-placeholder';
import { celebrationDetailKeys, fetchCelebrationDetail } from '@/services/celebration-detail';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

type PreviewStage = 'cover' | 'camera' | 'developing' | 'gallery';

const STAGES: { value: PreviewStage; label: string }[] = [
  { value: 'cover', label: 'Join' },
  { value: 'camera', label: 'Camera' },
  { value: 'developing', label: 'Developing' },
  { value: 'gallery', label: 'Gallery' },
];

/**
 * Guest preview.
 *
 * Entirely non-production: it reads the event's real settings but creates no
 * guest session and no media rows. The brief is explicit that preview actions
 * must not produce records, and it matters practically too — a host exploring
 * their own event should not appear in their own contributor count.
 */
export default function GuestPreviewScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const [stage, setStage] = useState<PreviewStage>('cover');

  const { data } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const session = data?.primarySession;
  const title = data?.celebration.title ?? 'Your event';
  const limit = session?.shot_limit_per_guest ?? null;

  const revealLabel = session
    ? session.reveal_mode === 'instant'
      ? 'Photos appear straight away'
      : session.reveal_mode === 'manual'
        ? 'The host will release the photos'
        : session.reveal_at
          ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
              weekday: 'long', hour: '2-digit', minute: '2-digit',
              timeZone: session.timezone,
            }).format(new Date(session.reveal_at))
          : 'Soon'
    : 'Soon';

  return (
    <Screen
      stickyAction={
        <Button label="Back to dashboard" variant="secondary" onPress={() => router.back()} />
      }
    >
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" tone="secondary">
            Preview
          </AppText>
          <AppText variant="displayLarge">What your guests see</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Nothing here is recorded — this preview creates no guest and no photos.
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {STAGES.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant={stage === option.value ? 'primary' : 'secondary'}
              size="small"
              fullWidth={false}
              onPress={() => setStage(option.value)}
            />
          ))}
        </View>

        <DeviceFrame width={200}>
          <View style={{ flex: 1 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <VisualPlaceholder
                assetKey={stage === 'gallery' ? 'onboarding_candid' : 'create_event_cover'}
                fill
                radius="none"
                style={{ borderWidth: 0 }}
              />
            </View>

            <View style={{ flex: 1, justifyContent: 'flex-end', padding: spacing.md, gap: spacing.sm }}>
              {stage === 'cover' ? (
                <>
                  <AppText variant="titleMedium" style={{ fontSize: 16, lineHeight: 20 }} numberOfLines={2}>
                    {title}
                  </AppText>
                  <PreviewAction label="Start taking photos" />
                </>
              ) : null}

              {stage === 'camera' ? (
                <>
                  {/* The remaining-shot counter. Tabular figures so it does not
                      shift horizontally as it counts down. */}
                  <AppText variant="numeric" tone="secondary" style={{ fontSize: 10 }}>
                    {limit === null ? 'Unlimited photos' : `${limit} photos left`}
                  </AppText>
                  <PreviewAction label="Shutter" />
                </>
              ) : null}

              {stage === 'developing' ? (
                <>
                  <AppText variant="eyebrow" tone="secondary" style={{ fontSize: 8 }}>
                    {copy.create.revealDeveloping}
                  </AppText>
                  <AppText variant="caption" style={{ fontSize: 10 }} numberOfLines={2}>
                    {revealLabel}
                  </AppText>
                </>
              ) : null}

              {stage === 'gallery' ? (
                <>
                  <AppText variant="eyebrow" tone="secondary" style={{ fontSize: 8 }}>
                    {data?.metrics.photos ?? 0} photos
                  </AppText>
                  <PreviewAction
                    label={session?.guest_downloads_enabled ? 'Save to my phone' : 'View only'}
                  />
                </>
              ) : null}
            </View>
          </View>
        </DeviceFrame>

        <View
          style={{
            padding: spacing.base,
            borderRadius: radii.lg,
            borderWidth: layout.hairline,
            borderColor: colours.borderSubtle,
            backgroundColor: colours.surface,
            gap: spacing.xxs,
          }}
        >
          <AppText variant="eyebrow" tone="secondary">
            Not yet built
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            The real guest experience is a mobile web app, arriving in the next phase.
            This is a configuration-driven mock-up of it.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

function PreviewAction({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: colours.brandPrimary,
        alignItems: 'center',
      }}
    >
      <AppText variant="caption" tone="onBrand" style={{ fontSize: 9 }}>
        {label}
      </AppText>
    </View>
  );
}
