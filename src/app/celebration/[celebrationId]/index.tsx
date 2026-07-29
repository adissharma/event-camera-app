import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { VisualPlaceholder } from '@/components/media/visual-placeholder';
import {
  archiveCelebration,
  celebrationDetailKeys,
  fetchCelebrationDetail,
  type CelebrationDetail,
} from '@/services/celebration-detail';
import { celebrationKeys } from '@/services/celebrations';
import { FEATURE_FLAGS } from '@/config/feature-flags';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

export default function CelebrationDashboard() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const archive = useMutation({
    mutationFn: () => archiveCelebration(String(celebrationId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
      router.replace('/home');
    },
  });

  if (isLoading) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <AppText variant="displayLarge">{copy.common.somethingWentWrong}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {(error as Error)?.message}
          </AppText>
          <Button label={copy.common.retry} variant="secondary" onPress={() => void refetch()} />
          <Button label="Back to home" variant="quiet" onPress={() => router.replace('/home')} />
        </View>
      </Screen>
    );
  }

  return <Dashboard detail={data} onArchive={() => archive.mutate()} archiving={archive.isPending} />;
}

function Dashboard({
  detail,
  onArchive,
  archiving,
}: {
  detail: CelebrationDetail;
  onArchive: () => void;
  archiving: boolean;
}) {
  const router = useRouter();
  const { celebration, sessions, primarySession, metrics } = detail;

  const formatDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
          timeZone: primarySession?.timezone ?? LOCALE_CONFIG.fallbackTimezone,
        }).format(new Date(iso))
      : null;

  const status =
    celebration.status === 'draft'
      ? copy.home.draft
      : primarySession?.status === 'closed'
        ? copy.home.closed
        : primarySession?.status === 'revealed'
          ? copy.home.revealed
          : copy.home.live;

  return (
    <Screen
      stickyAction={
        <Button
          label={copy.dashboard.editEvent}
          onPress={() => router.push(`/celebration/${celebration.id}/edit` as never)}
        />
      }
    >
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0} style={{ gap: spacing.base }}>
          <VisualPlaceholder assetKey="dashboard_fallback" aspectRatio={16 / 9} />
          <View style={{ gap: spacing.xs }}>
            <AppText variant="eyebrow" tone="secondary">
              {status}
            </AppText>
            <AppText variant="displayLarge" numberOfLines={3}>
              {celebration.title}
            </AppText>
            {formatDate(primarySession?.ends_at ?? null) ? (
              <AppText variant="numeric" tone="secondary">
                Closes {formatDate(primarySession?.ends_at ?? null)}
              </AppText>
            ) : null}
          </View>
        </Reveal>

        {/* Honest metrics, counted from real rows. Never estimated. */}
        <Reveal index={1} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Metric label={copy.dashboard.visits} value={metrics.guestsJoined} />
          <Metric label={copy.dashboard.contributors} value={metrics.contributors} />
          <Metric label={copy.dashboard.photos} value={metrics.photos} />
        </Reveal>

        {metrics.photos === 0 ? (
          <AppText variant="bodySmall" tone="secondary">
            No photos yet. They will appear here as your guests start shooting.
          </AppText>
        ) : null}

        <Reveal index={2} style={{ gap: spacing.sm }}>
          <Button
            label={copy.dashboard.shareQr}
            variant="secondary"
            onPress={() => {
              // The plaintext token is unrecoverable after creation, so the
              // dashboard can only share the public event page. Re-issuing a
              // link is the documented recovery path.
              void Share.share({
                message: `${celebration.title} — ${LOCALE_CONFIG.locale}`,
              }).catch(() => {});
            }}
          />
          <Button
            label={copy.dashboard.previewGuestView}
            variant="quiet"
            onPress={() => router.push(`/celebration/${celebration.id}/preview` as never)}
          />
        </Reveal>

        {primarySession ? (
          <Reveal index={3} style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="secondary">
              Settings
            </AppText>
            <SettingRow label="Photos per guest" value={
              primarySession.shot_limit_per_guest === null
                ? 'Unlimited'
                : String(primarySession.shot_limit_per_guest)
            } />
            <SettingRow
              label="Photos appear"
              value={
                primarySession.reveal_mode === 'instant'
                  ? 'During the event'
                  : primarySession.reveal_mode === 'manual'
                    ? 'When you choose'
                    : formatDate(primarySession.reveal_at) ?? 'Scheduled'
              }
            />
            <SettingRow
              label="Who sees photos"
              value={
                primarySession.gallery_visibility === 'all_guests'
                  ? 'Everyone'
                  : primarySession.gallery_visibility === 'own_only'
                    ? 'Own photos only'
                    : 'Only you'
              }
            />
            <SettingRow
              label="Look"
              value={primarySession.photo_treatment.replace(/_/g, ' ')}
            />
            <SettingRow
              label="Host approval"
              value={primarySession.moderation_enabled ? 'On' : 'Off'}
            />
          </Reveal>
        ) : null}

        {/* Functions. The schema supports many; the interface exposes one until
            multiEventCreation ships. The disabled action is labelled honestly
            rather than hidden, so the capability is discoverable. */}
        <Reveal index={4} style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary">
            {copy.dashboard.functions}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          >
            {sessions.map((session) => (
              <View
                key={session.id}
                style={{
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: colours.surface,
                  borderWidth: layout.hairline,
                  borderColor: colours.borderSubtle,
                  minWidth: 140,
                  gap: spacing.xxs,
                }}
              >
                <AppText variant="labelLarge">{session.name}</AppText>
                <AppText variant="caption" tone="secondary">
                  {session.status}
                </AppText>
              </View>
            ))}
          </ScrollView>
          <Button
            label={copy.dashboard.addFunction}
            variant="secondary"
            size="small"
            fullWidth={false}
            disabled={!FEATURE_FLAGS.multiEventCreation}
            disabledReason={copy.dashboard.addFunctionComingLater}
            onPress={() => {}}
          />
          {!FEATURE_FLAGS.multiEventCreation ? (
            <AppText variant="caption" tone="secondary">
              {copy.dashboard.addFunctionComingLater}
            </AppText>
          ) : null}
        </Reveal>

        <Reveal index={5} style={{ paddingTop: spacing.base }}>
          <Button
            label={copy.dashboard.archive}
            variant="destructive"
            loading={archiving}
            onPress={onArchive}
          />
          <AppText variant="caption" tone="secondary" style={{ paddingTop: spacing.sm }}>
            Archiving hides the event and stops new photos. Nothing is deleted.
          </AppText>
        </Reveal>
      </View>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.base,
        borderRadius: radii.lg,
        backgroundColor: colours.surface,
        borderWidth: layout.hairline,
        borderColor: colours.borderSubtle,
        gap: spacing.xxs,
      }}
    >
      <AppText variant="numericLarge">{value}</AppText>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.base,
        paddingVertical: spacing.md,
        borderTopWidth: layout.hairline,
        borderTopColor: colours.borderSubtle,
      }}
    >
      <AppText variant="bodySmall" tone="secondary" style={{ width: 140 }}>
        {label}
      </AppText>
      <AppText variant="labelLarge" style={{ flex: 1 }} numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}
