import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useDocumentTitle } from '@/components/brand/use-document-title';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { isBackendConfigured, requireSupabase } from '@/lib/supabase/client';
import { createUniqueChannel } from '@/lib/supabase/realtime';
import { fetchHostGallery, hostPortalKeys } from '@/services/host-portal';
import { eventDateLabel, PortalAccount } from './events-screen';
import { CentredState, PortalLink, useCelebrationId, useHostEvent, useIsDesktop } from './ui';

/** Bursts of uploads refetch once rather than once per photo. */
const GALLERY_REFRESH_DEBOUNCE_MS = 1500;

function useLiveGallery(eventSessionId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isBackendConfigured || !eventSessionId) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const client = requireSupabase();
    const channel = createUniqueChannel(client, `host-portal-media-${eventSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_items',
          filter: `event_session_id=eq.${eventSessionId}`,
        },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: hostPortalKeys.gallery(eventSessionId) });
          }, GALLERY_REFRESH_DEBOUNCE_MS);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [eventSessionId, queryClient]);
}

function NavLink({
  href,
  label,
  count,
  active,
  horizontal,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  horizontal: boolean;
}) {
  return (
    <PortalLink
      href={href}
      selected={active}
      style={[S.navLink, horizontal && S.navLinkHorizontal, active && S.navLinkActive]}
      hoverStyle={active ? undefined : S.navLinkHovered}
    >
      <AppText variant="labelLarge" tone={active ? 'onBrand' : 'primary'}>
        {label}
      </AppText>
      {count !== undefined ? (
        <AppText variant="caption" tone={active ? 'onBrand' : 'secondary'}>
          {count.toLocaleString()}
        </AppText>
      ) : null}
    </PortalLink>
  );
}

/**
 * The frame around one event's pages: a sidebar on a desktop, tabs on a phone.
 *
 * Holding the event, gallery and realtime subscription here, above the pages,
 * means moving between them never drops the live connection or refetches.
 */
export default function HostEventLayout() {
  const celebrationId = useCelebrationId();
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const { data: event, isLoading, isError, refetch } = useHostEvent(celebrationId);
  const eventSessionId = event?.session?.id ?? null;

  useDocumentTitle(`${event?.celebration.title ?? 'Your event'} — Stills. for hosts`);
  useLiveGallery(eventSessionId);

  const { data: gallery } = useQuery({
    queryKey: hostPortalKeys.gallery(eventSessionId ?? 'none'),
    queryFn: () => fetchHostGallery(String(eventSessionId)),
    enabled: Boolean(eventSessionId),
  });

  const backToEvents = (
    <PortalLink href="/host" style={S.back}>
      <ChevronLeftIcon size={16} color={colours.textSecondary} />
      <AppText variant="label" tone="secondary">
        All events
      </AppText>
    </PortalLink>
  );

  if (isLoading) return <CentredState busy />;

  if (isError) {
    return (
      <CentredState
        title="We couldn't load this event"
        body="Check your connection and try again."
        action={
          <Pressable onPress={() => void refetch()} accessibilityRole="button">
            <AppText variant="label" style={S.retry}>
              Try again
            </AppText>
          </Pressable>
        }
      />
    );
  }

  if (!event) {
    return (
      <CentredState
        title="This event isn't available"
        body="It may have been deleted, or it may belong to a different account."
        action={backToEvents}
      />
    );
  }

  const base = `/host/${celebrationId}`;
  const links = (
    <>
      <NavLink href={base} label="Photos" count={gallery?.length} active={pathname === base} horizontal={!isDesktop} />
      <NavLink href={`${base}/guests`} label="Guests" active={pathname === `${base}/guests`} horizontal={!isDesktop} />
      <NavLink
        href={`${base}/seating`}
        label="Seating"
        active={pathname === `${base}/seating`}
        horizontal={!isDesktop}
      />
      <NavLink
        href={`${base}/guestbook`}
        label="Guestbook"
        active={pathname === `${base}/guestbook`}
        horizontal={!isDesktop}
      />
    </>
  );

  const date = eventDateLabel(event.celebration.starts_at, event.celebration.ends_at);

  if (!isDesktop) {
    return (
      <View style={S.root}>
        <View style={S.phoneHeader}>
          <View style={S.phoneHeaderRow}>
            {backToEvents}
            <PortalAccount />
          </View>
          <AppText variant="titleMedium" numberOfLines={1}>
            {event.celebration.title}
          </AppText>
        </View>
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tabs}>
            {links}
          </ScrollView>
        </View>
        <View style={S.content}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View style={S.desktop}>
      <View style={S.sidebar}>
        {backToEvents}
        <View style={S.eventName}>
          <AppText variant="titleMedium">{event.celebration.title}</AppText>
          {date ? (
            <AppText variant="bodySmall" tone="secondary">
              {date}
            </AppText>
          ) : null}
        </View>
        <View style={S.nav}>{links}</View>
        <View style={S.sidebarFooter}>
          <PortalAccount />
        </View>
      </View>
      <View style={S.content}>
        <Slot />
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  desktop: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 272,
    gap: spacing.xl,
    padding: spacing.lg,
    borderRightWidth: layout.hairline,
    borderRightColor: colours.borderSubtle,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eventName: {
    gap: spacing.xs,
  },
  nav: {
    gap: spacing.xs,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  navLinkHorizontal: {
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  navLinkHovered: {
    backgroundColor: colours.surfaceRaised,
  },
  navLinkActive: {
    backgroundColor: colours.brandPrimary,
  },
  sidebarFooter: {
    marginTop: 'auto',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  phoneHeader: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  phoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tabs: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderSubtle,
  },
  retry: {
    color: colours.accentWarm,
  },
});
