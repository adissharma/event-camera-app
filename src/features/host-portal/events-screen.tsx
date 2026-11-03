import { Image, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { StillsLockup } from '@/components/brand/stills-lockup';
import { useDocumentTitle } from '@/components/brand/use-document-title';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { useAuth } from '@/features/auth/context';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { clearSignedUrlCache } from '@/features/media/signed-url-cache';
import { hostPortalKeys, listHostEvents, type HostEventSummary } from '@/services/host-portal';
import { CentredState, Notice, Page, PortalLink, ToolButton } from './ui';

function plural(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

export function eventDateLabel(startsAt: string | null, endsAt: string | null): string | null {
  const value = startsAt ?? endsAt;
  return value ? format(new Date(value), 'd MMMM yyyy') : null;
}

export function PortalAccount() {
  const { user, signOut } = useAuth();
  return (
    <View style={S.account}>
      {user?.email ? (
        <AppText variant="caption" tone="secondary" numberOfLines={1} style={S.accountEmail}>
          {user.email}
        </AppText>
      ) : null}
      <ToolButton
        label="Sign out"
        onPress={() => {
          clearSignedUrlCache();
          void signOut();
        }}
      />
    </View>
  );
}

function EventCard({ event }: { event: HostEventSummary }) {
  const cover = useCoverSource(event.coverStoragePath);
  const date = eventDateLabel(event.startsAt, event.endsAt);
  return (
    <PortalLink href={`/host/${event.id}`} style={S.card} hoverStyle={S.cardHovered}>
      <View style={S.cover}>
        <Image source={cover} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <View style={S.cardBody}>
        <AppText variant="titleMedium" numberOfLines={2}>
          {event.title}
        </AppText>
        {date ? (
          <AppText variant="bodySmall" tone="secondary">
            {date}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="secondary">
          {plural(event.mediaCount, 'item')} · {plural(event.guestCount, 'guest')}
        </AppText>
      </View>
    </PortalLink>
  );
}

export default function HostEventsScreen() {
  useDocumentTitle('Your events — Stills. for hosts');
  const { data: events, isLoading, isError, refetch } = useQuery({
    queryKey: hostPortalKeys.events(),
    queryFn: listHostEvents,
  });

  return (
    <View style={S.root}>
      <View style={S.topBar}>
        <StillsLockup size={22} />
        <PortalAccount />
      </View>

      <Page style={S.page}>
        <AppText variant="displayLarge">Your events</AppText>

        {isLoading ? (
          <CentredState busy />
        ) : isError ? (
          <Notice tone="error">
            We couldn&apos;t load your events. Check your connection and try again.{' '}
            <AppText variant="bodySmall" tone="brand" onPress={() => void refetch()} style={S.retry}>
              Try again
            </AppText>
          </Notice>
        ) : events && events.length > 0 ? (
          <div className="hp-cards">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <CentredState
            title="No events yet"
            body="Events are created in the Stills. app on your iPhone. Once you've made one, it appears here, signed in with this same account."
          />
        )}
      </Page>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderSubtle,
  },
  account: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountEmail: {
    flexShrink: 1,
  },
  page: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
  },
  retry: {
    textDecorationLine: 'underline',
  },
  card: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  cardHovered: {
    borderColor: colours.borderStrong,
  },
  cover: {
    width: '100%',
    aspectRatio: 3 / 2,
    overflow: 'hidden',
    backgroundColor: colours.surfaceMuted,
  },
  cardBody: {
    gap: spacing.xs,
    padding: spacing.base,
  },
});
