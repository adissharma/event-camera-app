import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { fetchHostGuestbook } from '@/services/guestbook';
import { hostPortalKeys } from '@/services/host-portal';
import { CentredState, Page, ToolButton, useCelebrationId, useSignedUrls } from './ui';

/** Messages to the host: the audio and video guests left, private to the host. */
export default function HostGuestbookScreen() {
  const celebrationId = useCelebrationId();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: hostPortalKeys.guestbook(celebrationId),
    queryFn: () => fetchHostGuestbook(celebrationId),
  });

  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const paths = useMemo(() => messages.map((message) => message.storagePath), [messages]);
  const urls = useSignedUrls(paths);

  return (
    <Page>
      <View style={S.heading}>
        <AppText variant="titleLarge">Guestbook</AppText>
        <AppText variant="bodySmall" tone="secondary">
          The messages guests leave for you. Only you can see these.
        </AppText>
      </View>

      {isLoading ? (
        <CentredState busy />
      ) : isError ? (
        <CentredState
          title="We couldn't load the guestbook"
          body="Check your connection and try again."
          action={<ToolButton label="Try again" onPress={() => void refetch()} />}
        />
      ) : messages.length === 0 ? (
        <CentredState title="No messages yet" body="Messages from your guests appear here." />
      ) : (
        <View style={S.list}>
          {messages.map((message) => {
            const url = urls.get(message.storagePath);
            return (
              <View key={message.id} style={S.message}>
                <View style={S.messageHeader}>
                  <AppText variant="labelLarge" numberOfLines={1} style={S.name}>
                    {message.displayName ?? 'Guest'}
                  </AppText>
                  {message.capturedAt ? (
                    <AppText variant="caption" tone="secondary">
                      {format(new Date(message.capturedAt), "d MMM yyyy 'at' HH:mm")}
                    </AppText>
                  ) : null}
                </View>
                {url ? (
                  message.mediaType === 'video' ? (
                    <video src={url} controls preload="metadata" playsInline style={VIDEO_STYLE} />
                  ) : (
                    <audio src={url} controls preload="metadata" style={AUDIO_STYLE} />
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Page>
  );
}

const VIDEO_STYLE = { display: 'block', width: '100%', maxHeight: 420, borderRadius: radii.md } as const;
const AUDIO_STYLE = { display: 'block', width: '100%', colorScheme: 'dark' } as const;

const S = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
  list: {
    width: '100%',
    maxWidth: 720,
    gap: spacing.md,
  },
  message: {
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.lg,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    flexShrink: 1,
  },
});
