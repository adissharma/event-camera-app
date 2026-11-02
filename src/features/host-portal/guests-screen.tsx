import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { AppText } from '@/components/ui/text';
import { BRAND_CONFIG } from '@/config/brand';
import { colours, layout, radii, spacing } from '@/design';
import { QrCard } from '@/features/sharing/qr-card';
import { celebrationDetailKeys, fetchJoinedGuests } from '@/services/celebration-detail';
import { fetchHostGallery, hostPortalKeys } from '@/services/host-portal';
import { saveBlob } from './downloads';
import { galleryContributors, safeFileSegment } from './gallery';
import { CentredState, Notice, Page, ToolButton, useCelebrationId, useHostEvent, useIsDesktop } from './ui';

/** Large enough to print on a table card without going soft. */
const QR_EXPORT_PIXELS = 1600;

async function svgToPng(svg: SVGSVGElement): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(QR_EXPORT_PIXELS));
  clone.setAttribute('height', String(QR_EXPORT_PIXELS));
  const source = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
  );
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = QR_EXPORT_PIXELS;
    canvas.height = QR_EXPORT_PIXELS;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas context.');
    // A quiet zone of white around the code, which is what a scanner looks for.
    const margin = QR_EXPORT_PIXELS * 0.06;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, QR_EXPORT_PIXELS, QR_EXPORT_PIXELS);
    context.drawImage(image, margin, margin, QR_EXPORT_PIXELS - margin * 2, QR_EXPORT_PIXELS - margin * 2);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the PNG.'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}

function InviteCard({ eventCode, eventTitle }: { eventCode: string; eventTitle: string }) {
  const url = `${BRAND_CONFIG.guestDomain}/j/${eventCode}`;
  const qrRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ tone: 'success', text: 'Link copied.' });
    } catch {
      setMessage({ tone: 'error', text: 'Your browser blocked copying. Select the link and copy it by hand.' });
    }
  }

  async function downloadQr() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    try {
      saveBlob(await svgToPng(svg), `${safeFileSegment(eventTitle)} QR code.png`);
    } catch (error) {
      console.error('[host-portal] could not export the QR code', error);
      setMessage({ tone: 'error', text: 'We couldn’t create the image. Try again.' });
    }
  }

  return (
    <View style={S.card}>
      <View style={S.inviteQr}>
        <div ref={qrRef}>
          <QrCard value={url} eventName={eventTitle} size={168} />
        </div>
      </View>
      <View style={S.inviteBody}>
        <AppText variant="eyebrow" tone="secondary">
          Invite your guests
        </AppText>
        <AppText variant="heading" selectable>
          {url}
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          Guests join from their phone by scanning the code or opening the link. They don&apos;t need an account.
        </AppText>
        <View style={S.inviteActions}>
          <ToolButton label="Copy link" onPress={() => void copyLink()} />
          <ToolButton label="Download QR code" onPress={() => void downloadQr()} />
        </View>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
      </View>
    </View>
  );
}

export default function HostGuestsScreen() {
  const celebrationId = useCelebrationId();
  const isDesktop = useIsDesktop();
  const { data: event } = useHostEvent(celebrationId);
  const eventSessionId = event?.session?.id ?? null;

  const { data: guests, isLoading, isError, refetch } = useQuery({
    queryKey: celebrationDetailKeys.joinedGuests(eventSessionId ?? 'none'),
    queryFn: () => fetchJoinedGuests(String(eventSessionId)),
    enabled: Boolean(eventSessionId),
    refetchInterval: 15_000,
  });
  const { data: gallery } = useQuery({
    queryKey: hostPortalKeys.gallery(eventSessionId ?? 'none'),
    queryFn: () => fetchHostGallery(String(eventSessionId)),
    enabled: Boolean(eventSessionId),
  });

  const countByGuest = useMemo(
    () => new Map(galleryContributors(gallery ?? []).map((entry) => [entry.key, entry.count])),
    [gallery],
  );

  if (!event) return <CentredState busy />;

  return (
    <Page>
      <AppText variant="titleLarge">Guests</AppText>

      {event.celebration.event_code ? (
        <InviteCard eventCode={event.celebration.event_code} eventTitle={event.celebration.title} />
      ) : null}

      <View style={S.section}>
        <AppText variant="eyebrow" tone="secondary">
          Joined{guests && guests.length > 0 ? ` · ${guests.length.toLocaleString()}` : ''}
        </AppText>
        <View style={S.table}>
          {isLoading ? (
            <CentredState busy />
          ) : isError ? (
            <CentredState
              title="We couldn't load your guests"
              action={<ToolButton label="Try again" onPress={() => void refetch()} />}
            />
          ) : !guests || guests.length === 0 ? (
            <CentredState title="No one has joined yet" body="Guests appear here as soon as they join." />
          ) : (
            guests.map((guest, index) => {
              const count = countByGuest.get(guest.id) ?? 0;
              return (
                <View key={guest.id} style={[S.row, index > 0 && S.rowDivider]}>
                  <View style={S.rowName}>
                    <AppText variant="labelLarge" numberOfLines={1}>
                      {guest.displayName}
                    </AppText>
                    {!isDesktop ? (
                      <AppText variant="caption" tone="secondary">
                        Joined {format(new Date(guest.createdAt), 'd MMM, HH:mm')}
                      </AppText>
                    ) : null}
                  </View>
                  {isDesktop ? (
                    <AppText variant="bodySmall" tone="secondary" style={S.rowJoined}>
                      Joined {format(new Date(guest.createdAt), 'd MMM, HH:mm')}
                    </AppText>
                  ) : null}
                  <AppText variant="numeric" tone="secondary" style={S.rowCount}>
                    {count.toLocaleString()} {count === 1 ? 'item' : 'items'}
                  </AppText>
                </View>
              );
            })
          )}
        </View>
      </View>
    </Page>
  );
}

const S = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  inviteQr: {
    width: 192,
  },
  inviteBody: {
    flex: 1,
    flexBasis: 280,
    gap: spacing.sm,
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  table: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  rowJoined: {
    width: 180,
  },
  rowCount: {
    width: 90,
    textAlign: 'right',
  },
});
