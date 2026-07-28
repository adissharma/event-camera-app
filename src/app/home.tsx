import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useAuth } from '@/features/auth/context';
import { celebrationKeys, listCelebrations, type CelebrationSummary } from '@/services/celebrations';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';
import { LOCALE_CONFIG } from '@/config/app-config';

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut, isBackendConfigured } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: celebrationKeys.list(),
    queryFn: listCelebrations,
    enabled: isBackendConfigured,
  });

  const celebrations = data ?? [];
  const hasEvents = celebrations.length > 0;

  return (
    <Screen
      stickyAction={
        hasEvents ? (
          <Button label={copy.home.createFirst} haptic onPress={() => router.push('/create')} />
        ) : undefined
      }
    >
      <View style={{ gap: spacing.xl }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <AppText variant="eyebrow" tone="secondary">
            {copy.home.yourEvents}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={signOut}
            hitSlop={12}
          >
            <AppText variant="caption" tone="secondary">
              {session?.user.email ?? 'Sign out'}
            </AppText>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: spacing.giant, alignItems: 'center' }}>
            <ActivityIndicator color={colours.textSecondary} />
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />
        ) : hasEvents ? (
          <View style={{ gap: spacing.base }}>
            {celebrations.map((celebration, index) => (
              <Reveal key={celebration.id} index={index} step={45}>
                <EventCard
                  celebration={celebration}
                  onPress={() => router.push(`/celebration/${celebration.id}`)}
                />
              </Reveal>
            ))}
          </View>
        ) : (
          <EmptyState onCreate={() => router.push('/create')} />
        )}
      </View>
    </Screen>
  );
}

/** Strong statement, one action. Not a dashboard with nothing in it. */
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Reveal index={1} style={{ gap: spacing.xl, paddingTop: spacing.xxl }}>
      <AppText variant="displayLarge">{copy.home.emptyStatement}</AppText>
      <AppText variant="bodyLarge" tone="secondary">
        {copy.welcome.supporting}
      </AppText>
      <Button label={copy.home.createFirst} haptic onPress={onCreate} />
    </Reveal>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <View
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.lg,
        borderWidth: layout.hairline,
        borderColor: colours.borderStrong,
      }}
    >
      <AppText variant="labelLarge" tone="error">
        {copy.common.somethingWentWrong}
      </AppText>
      {/* Shown because this is a developer-facing failure during setup; guest
          errors elsewhere never surface a raw message. */}
      {message ? (
        <AppText variant="bodySmall" tone="secondary">
          {message}
        </AppText>
      ) : null}
      <Button label={copy.common.retry} variant="secondary" onPress={onRetry} />
    </View>
  );
}

function EventCard({
  celebration,
  onPress,
}: {
  celebration: CelebrationSummary;
  onPress: () => void;
}) {
  const statusLabel =
    celebration.status === 'draft'
      ? copy.home.draft
      : celebration.primarySession?.status === 'closed'
        ? copy.home.closed
        : celebration.primarySession?.status === 'revealed'
          ? copy.home.revealed
          : copy.home.live;

  const date = celebration.endsAt
    ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(celebration.endsAt))
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${celebration.title}, ${statusLabel}`}
      onPress={onPress}
      style={{
        borderRadius: radii.xl,
        overflow: 'hidden',
        backgroundColor: colours.surface,
        borderWidth: layout.hairline,
        borderColor: colours.borderSubtle,
        padding: spacing.lg,
        gap: spacing.sm,
        minHeight: layout.minTouchTarget,
      }}
    >
      <AppText variant="eyebrow" tone="secondary">
        {statusLabel}
      </AppText>
      <AppText variant="titleLarge" numberOfLines={2}>
        {celebration.title}
      </AppText>
      {date ? (
        <AppText variant="numeric" tone="secondary">
          {date}
        </AppText>
      ) : null}
    </Pressable>
  );
}
