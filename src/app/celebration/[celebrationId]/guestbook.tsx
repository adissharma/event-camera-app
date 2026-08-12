import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';

const nativeAudioModule = Platform.OS === 'web' ? null : (() => {
  try {
    return require('expo-audio');
  } catch {
    return null;
  }
})();

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import {
  celebrationDetailKeys,
  fetchCelebrationDetail,
} from '@/services/celebration-detail';
import {
  fetchGuestGuestbook,
  fetchHostGuestbook,
  type GuestbookMessageRecord,
} from '@/services/guestbook';
import { requireSupabase } from '@/lib/supabase/client';
import { deleteGuestPhoto } from '@/services/guest-media-upload';

function BackChevron({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PlayIcon({ size = 18, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6.5v11l9-5.5-9-5.5Z" fill={color} />
    </Svg>
  );
}

function PauseIcon({ size = 16, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={7} y={6} width={3.5} height={12} rx={1.2} fill={color} />
      <Rect x={13.5} y={6} width={3.5} height={12} rx={1.2} fill={color} />
    </Svg>
  );
}

type ResolvedMessage = GuestbookMessageRecord & {
  signedUrl: string;
};

function formatDuration(durationMs: number | null) {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function AudioMessageCard({
  message,
  canDelete,
  onDelete,
}: {
  message: ResolvedMessage;
  canDelete: boolean;
  onDelete: () => void;
}) {
  if (Platform.OS === 'web') {
    return <WebAudioMessageCard message={message} canDelete={canDelete} onDelete={onDelete} />;
  }

  const { useAudioPlayer, useAudioPlayerStatus } = nativeAudioModule ?? {};
  if (!useAudioPlayer || !useAudioPlayerStatus) {
    return null;
  }

  const player = useAudioPlayer(message.signedUrl, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  useEffect(() => {
    player.replace(message.signedUrl);
  }, [message.signedUrl, player]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    void player.seekTo(0);
    player.pause();
  }, [player, status.didJustFinish]);

  const durationLabel = formatDuration(
    message.durationMs ?? (typeof status.duration === 'number' ? status.duration * 1000 : null),
  );

  return (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <View>
          <AppText variant="labelLarge" style={styles.messageTitle}>
            {message.displayName || 'Guest'}
          </AppText>
          <AppText variant="caption" tone="secondary">
            Audio message
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary">
          {durationLabel}
        </AppText>
      </View>

      <View style={styles.audioRow}>
        <Pressable
          onPress={() => {
            if (isPlaying) {
              player.pause();
              return;
            }
            if (status.didJustFinish || status.currentTime >= status.duration) {
              void player.seekTo(0);
            }
            player.play();
          }}
          style={styles.audioPlayBtn}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause audio message' : 'Play audio message'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </Pressable>

        <View style={styles.audioMeta}>
          <View style={styles.audioTrack}>
            <View
              style={[
                styles.audioTrackFill,
                {
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0,
                    ),
                  )}%`,
                },
              ]}
            />
          </View>
          <AppText variant="caption" tone="secondary">
            Private to the host
          </AppText>
        </View>
      </View>

      {canDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteLink} accessibilityRole="button">
          <AppText variant="caption" tone="secondary" style={styles.deleteLinkText}>
            Delete message
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function WebAudioMessageCard({
  message,
  canDelete,
  onDelete,
}: {
  message: ResolvedMessage;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio(message.signedUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [message.signedUrl]);

  return (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <View>
          <AppText variant="labelLarge" style={styles.messageTitle}>{message.displayName || 'Guest'}</AppText>
          <AppText variant="caption" tone="secondary">Audio message</AppText>
        </View>
        <AppText variant="caption" tone="secondary">{formatDuration(message.durationMs)}</AppText>
      </View>
      <View style={styles.audioRow}>
        <Pressable
          onPress={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (isPlaying) audio.pause();
            else void audio.play();
            setIsPlaying(!isPlaying);
          }}
          style={styles.audioPlayBtn}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause audio message' : 'Play audio message'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </Pressable>
        <View style={styles.audioMeta}>
          <AppText variant="caption" tone="secondary">Private to the host</AppText>
        </View>
      </View>
      {canDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteLink} accessibilityRole="button">
          <AppText variant="caption" tone="secondary" style={styles.deleteLinkText}>Delete message</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function VideoMessageCard({
  message,
  canDelete,
  onDelete,
}: {
  message: ResolvedMessage;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const player = useVideoPlayer({ uri: message.signedUrl }, (instance) => {
    instance.loop = false;
    instance.pause();
  });

  return (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <View>
          <AppText variant="labelLarge" style={styles.messageTitle}>
            {message.displayName || 'Guest'}
          </AppText>
          <AppText variant="caption" tone="secondary">
            Video message
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary">
          {formatDuration(message.durationMs)}
        </AppText>
      </View>

      <View style={styles.videoWrap}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
        />
      </View>

      {canDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteLink} accessibilityRole="button">
          <AppText variant="caption" tone="secondary" style={styles.deleteLinkText}>
            Delete message
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function GuestbookScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [resolvedMessages, setResolvedMessages] = useState<ResolvedMessage[]>([]);
  const [isSigningUrls, setIsSigningUrls] = useState(false);

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const viewerRole = detail?.viewerRole ?? 'guest';
  const isHost = viewerRole === 'host';

  const hostQuery = useQuery({
    queryKey: ['guestbook', 'host', String(celebrationId)],
    queryFn: () => fetchHostGuestbook(String(celebrationId)),
    enabled: Boolean(celebrationId) && isHost,
  });

  const guestQuery = useQuery({
    queryKey: ['guestbook', 'guest', String(celebrationId)],
    queryFn: () => fetchGuestGuestbook(String(celebrationId)),
    enabled: Boolean(celebrationId) && !isHost,
  });

  const payload = isHost ? hostQuery.data : guestQuery.data;

  useEffect(() => {
    const messages = payload?.messages ?? [];
    if (messages.length === 0) {
      setResolvedMessages([]);
      return;
    }

    let cancelled = false;
    setIsSigningUrls(true);
    (async () => {
      try {
        const client = requireSupabase();
        const { data, error } = await client.storage
          .from('event-media')
          .createSignedUrls(messages.map((item) => item.storagePath), 3600);

        if (cancelled) return;
        if (error || !data) {
          console.error('[guestbook] failed to sign guestbook URLs', error);
          setResolvedMessages([]);
          return;
        }

        const urlByPath = new Map(data.map((item) => [item.path, item.signedUrl]));
        setResolvedMessages(
          messages
            .map((item) => {
              const signedUrl = urlByPath.get(item.storagePath);
              return signedUrl ? { ...item, signedUrl } : null;
            })
            .filter((item): item is ResolvedMessage => item !== null),
        );
      } finally {
        if (!cancelled) setIsSigningUrls(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payload?.messages]);

  const guestMeta = !isHost ? guestQuery.data : null;

  const isLoading =
    isDetailLoading ||
    (isHost ? hostQuery.isLoading : guestQuery.isLoading) ||
    isSigningUrls;

  const heroSubtitle = isHost
    ? 'Private audio and video messages from your guests.'
    : 'Your message is private and can only be seen by the host.';

  const openRecorder = () => router.push({
    pathname: '/celebration/[celebrationId]/camera',
    params: { celebrationId: String(celebrationId), captureTarget: 'guestbook' },
  } as never);

  const messageHeading = isHost
    ? `${resolvedMessages.length} message${resolvedMessages.length === 1 ? '' : 's'}`
    : resolvedMessages.length === 1
      ? 'Your message'
      : 'Your messages';

  async function handleDeleteMessage(message: GuestbookMessageRecord) {
    if (!guestMeta?.guestToken || !message.id) return;

    Alert.alert('Delete message?', 'This will remove your Guestbook message.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGuestPhoto({
              mediaItemId: message.id,
              guestToken: guestMeta.guestToken,
            });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['guestbook', 'guest', String(celebrationId)] }),
              queryClient.invalidateQueries({ queryKey: ['guestbook', 'host', String(celebrationId)] }),
              queryClient.invalidateQueries({ queryKey: celebrationDetailKeys.detail(String(celebrationId)) }),
            ]);
          } catch (error) {
            console.error('[guestbook] failed to delete guestbook message', error);
            Alert.alert('Error', 'Could not delete this message.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#C13584', '#8B5CF6', '#F77737', '#FCAF45']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.identityBorder}
        pointerEvents="none"
      />
      <View style={styles.innerRoot}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <BackChevron />
        </Pressable>
      </View>

      {isLoading && !payload ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <View style={styles.heroIconRing}>
              <AppText style={styles.heroIcon}>{payload?.guestbook.icon || '💌'}</AppText>
            </View>
            <AppText variant="displaySmall" style={styles.heroTitle}>
              Guestbook
            </AppText>
            <AppText variant="bodyMedium" tone="secondary" style={styles.heroMessage}>
              {payload?.guestbook.instructions || 'Leave a message for the host.'}
            </AppText>
            <AppText variant="bodyMedium" style={styles.heroPrivacy}>
              {heroSubtitle}
            </AppText>
          </View>

          <View style={styles.section}>
            <AppText variant="eyebrow" tone="secondary" style={styles.sectionLabel}>
              {messageHeading}
            </AppText>

            {resolvedMessages.length === 0 ? (
              <View style={styles.emptyCard}>
                <AppText variant="bodySmall" tone="secondary" align="center">
                  {isHost
                    ? 'No one has left a Guestbook message yet.'
                    : 'You haven’t left a Guestbook message yet.'}
                </AppText>
              </View>
            ) : (
              <View style={styles.messageList}>
                {resolvedMessages.map((message) =>
                  message.mediaType === 'audio' ? (
                    <AudioMessageCard
                      key={message.id}
                      message={message}
                      canDelete={!isHost}
                      onDelete={() => void handleDeleteMessage(message)}
                    />
                  ) : (
                    <VideoMessageCard
                      key={message.id}
                      message={message}
                      canDelete={!isHost}
                      onDelete={() => void handleDeleteMessage(message)}
                    />
                  ),
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}
      {!isHost ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.base }]}>
          <Pressable
            onPress={openRecorder}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.86, transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Leave a message"
          >
            <AppText style={styles.ctaText}>💌 Leave a message</AppText>
          </Pressable>
        </View>
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  identityBorder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  innerRoot: {
    flex: 1,
    margin: 2,
    backgroundColor: '#0B0B0C',
  },
  header: {
    paddingHorizontal: layout.gutter,
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.xl,
  },
  hero: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  heroIconRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    borderColor: 'rgba(247, 119, 55, 0.72)',
    backgroundColor: 'rgba(193, 53, 132, 0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroIcon: {
    fontSize: 34,
  },
  heroTitle: {
    color: colours.textPrimary,
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 40,
    lineHeight: 46,
    textAlign: 'center',
  },
  heroMessage: {
    maxWidth: 520,
    textAlign: 'center',
    lineHeight: 24,
  },
  heroPrivacy: {
    marginTop: spacing.xs,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 340,
  },
  sectionLabel: {
    alignSelf: 'center',
  },
  section: {
    gap: spacing.md,
  },
  emptyCard: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  messageList: {
    gap: spacing.md,
  },
  messageCard: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    padding: spacing.base,
    gap: spacing.base,
  },
  bottomBar: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
  },
  cta: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#000000',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  messageTitle: {
    color: colours.textPrimary,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  audioPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colours.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioMeta: {
    flex: 1,
    gap: spacing.sm,
  },
  audioTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colours.borderSubtle,
    overflow: 'hidden',
  },
  audioTrackFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colours.brandPrimary,
  },
  videoWrap: {
    width: '100%',
    aspectRatio: 9 / 13,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  deleteLink: {
    alignSelf: 'flex-start',
  },
  deleteLinkText: {
    textDecorationLine: 'underline',
  },
});
