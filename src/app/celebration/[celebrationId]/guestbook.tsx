/**
 * The Guestbook — a private, challenge-shaped place for video messages.
 *
 * Presentation is deliberately the challenge story viewer, so the Guestbook
 * reads as one more thing to do at the event rather than a separate feature.
 * The only visual departure is the backdrop: a challenge blurs a photo from
 * the event, and the Guestbook has no cover of its own, so it uses flat black.
 *
 * Privacy is enforced in the database, not here. `get_guest_guestbook` returns
 * only the calling guest's own submissions and `get_host_guestbook` is gated on
 * `can_manage_celebration`, so a guest has no route to another guest's message
 * even with a hand-made request. The UI below simply renders whatever its RPC
 * was willing to return.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';

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
import {
  StoryViewer,
  formatStoryTimestamp,
  type StorySlideItem,
} from '@/features/celebrations/story-viewer';

const nativeAudioModule = Platform.OS === 'web' ? null : (() => {
  try {
    return require('expo-audio');
  } catch {
    return null;
  }
})();

function PlayIcon({ size = 26, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6.5v11l9-5.5-9-5.5Z" fill={color} />
    </Svg>
  );
}

function PauseIcon({ size = 24, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={7} y={6} width={3.5} height={12} rx={1.2} fill={color} />
      <Rect x={13.5} y={6} width={3.5} height={12} rx={1.2} fill={color} />
    </Svg>
  );
}

function GuestbookHeroIcon({ size = 32, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 7h6M9 11h6M9 15h4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

type ResolvedMessage = GuestbookMessageRecord & { signedUrl: string };

function formatDuration(durationMs: number | null) {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * A full-bleed slide for a legacy audio message.
 *
 * Audio is no longer recordable — the Guestbook takes video now — but messages
 * left before that change still have to play, so hosts do not silently lose
 * them. There is nothing to show, so the slide is the black backdrop with a
 * single play control on it.
 */
function AudioStorySlide({ message, onEnd }: { message: ResolvedMessage; onEnd: () => void }) {
  const useAudioPlayer = nativeAudioModule?.useAudioPlayer;
  const useAudioPlayerStatus = nativeAudioModule?.useAudioPlayerStatus;

  if (Platform.OS === 'web' || !useAudioPlayer || !useAudioPlayerStatus) {
    return <WebAudioStorySlide message={message} onEnd={onEnd} />;
  }
  return (
    <NativeAudioStorySlide
      message={message}
      onEnd={onEnd}
      useAudioPlayer={useAudioPlayer}
      useAudioPlayerStatus={useAudioPlayerStatus}
    />
  );
}

function AudioSlideChrome({
  isPlaying,
  onToggle,
  durationLabel,
}: {
  isPlaying: boolean;
  onToggle: () => void;
  durationLabel: string;
}) {
  return (
    <View style={styles.audioSlide}>
      <Pressable
        onPress={onToggle}
        style={styles.audioPlayBtn}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio message' : 'Play audio message'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </Pressable>
      <AppText style={styles.audioSlideLabel}>Audio message</AppText>
      <AppText style={styles.audioSlideDuration}>{durationLabel}</AppText>
    </View>
  );
}

function NativeAudioStorySlide({
  message,
  onEnd,
  useAudioPlayer,
  useAudioPlayerStatus,
}: {
  message: ResolvedMessage;
  onEnd: () => void;
  useAudioPlayer: any;
  useAudioPlayerStatus: any;
}) {
  const player = useAudioPlayer(message.signedUrl, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.play();
  }, [player]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    void player.seekTo(0);
    player.pause();
    onEnd();
  }, [player, status.didJustFinish, onEnd]);

  return (
    <AudioSlideChrome
      isPlaying={Boolean(status.playing)}
      onToggle={() => {
        if (status.playing) {
          player.pause();
          return;
        }
        if (status.didJustFinish || status.currentTime >= status.duration) {
          void player.seekTo(0);
        }
        player.play();
      }}
      durationLabel={formatDuration(
        message.durationMs ??
          (typeof status.duration === 'number' ? status.duration * 1000 : null),
      )}
    />
  );
}

function WebAudioStorySlide({ message, onEnd }: { message: ResolvedMessage; onEnd: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const element = new Audio(message.signedUrl);
    setAudio(element);
    element.onended = () => {
      setIsPlaying(false);
      onEnd();
    };
    // Browsers block unprompted audio playback; a rejected attempt just leaves
    // the slide paused with its play button showing, which is the fallback.
    void element.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));

    return () => {
      element.pause();
      element.src = '';
      setAudio(null);
    };
  }, [message.signedUrl, onEnd]);

  return (
    <AudioSlideChrome
      isPlaying={isPlaying}
      onToggle={() => {
        if (!audio) return;
        if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
          return;
        }
        void audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }}
      durationLabel={formatDuration(message.durationMs)}
    />
  );
}

export default function GuestbookScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [resolvedMessages, setResolvedMessages] = useState<ResolvedMessage[]>([]);
  const [isSigningUrls, setIsSigningUrls] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const isHost = (detail?.viewerRole ?? 'guest') === 'host';

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
  const guestMeta = !isHost ? guestQuery.data : null;

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

  // A deletion can drop the slide that was showing, so never let the index
  // outrun the list — slide 0 is the intro, so the last valid index is length.
  useEffect(() => {
    setActiveSlideIndex((current) => Math.min(current, resolvedMessages.length));
  }, [resolvedMessages.length]);

  const isLoading =
    isDetailLoading || (isHost ? hostQuery.isLoading : guestQuery.isLoading) || isSigningUrls;

  const slides: StorySlideItem[] = resolvedMessages.map((message) => ({
    id: message.id,
    submissionId: message.id,
    uri: message.signedUrl,
    takenBy: message.displayName || 'Guest',
    postedAt: message.capturedAt,
    mediaType: message.mediaType === 'audio' ? 'audio' : 'video',
  }));

  const activeMessage =
    activeSlideIndex > 0 ? resolvedMessages[activeSlideIndex - 1] ?? null : null;

  // Guests only ever receive their own messages, and hosts do not author them,
  // so the delete affordance belongs to the guest side alone.
  const canDeleteActive = !isHost && Boolean(activeMessage);

  const description =
    payload?.guestbook.instructions?.trim() || 'Leave a message for the host.';

  const footnote = isHost
    ? resolvedMessages.length === 0
      ? 'No one has left a message yet. Messages here are private to you.'
      : `${resolvedMessages.length} private message${resolvedMessages.length === 1 ? '' : 's'}, visible only to you.`
    : 'Your message is private and only visible to the host.';

  function openRecorder() {
    router.push({
      pathname: '/celebration/[celebrationId]/camera',
      params: { celebrationId: String(celebrationId), captureTarget: 'guestbook' },
    } as never);
  }

  async function confirmDeleteActiveMessage() {
    setMenuVisible(false);
    if (!activeMessage || !guestMeta?.guestToken) return;

    try {
      await deleteGuestPhoto({
        mediaItemId: activeMessage.id,
        guestToken: guestMeta.guestToken,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['guestbook', 'guest', String(celebrationId)] }),
        queryClient.invalidateQueries({ queryKey: ['guestbook', 'host', String(celebrationId)] }),
        queryClient.invalidateQueries({
          queryKey: celebrationDetailKeys.detail(String(celebrationId)),
        }),
      ]);
    } catch (error) {
      console.error('[guestbook] failed to delete guestbook message', error);
      Alert.alert('Error', 'Could not delete this message.');
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#C13584', '#8B5CF6', '#F77737', '#FCAF45']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.innerRoot}>
        {isLoading && !payload ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colours.textSecondary} />
          </View>
        ) : (
          <StoryViewer
            backdrop={{ kind: 'solid', color: '#0B0B0C' }}
            // The host picks an emoji in Guestbook settings; the book glyph is
            // the fallback for a Guestbook that has never been configured.
            icon={
              payload?.guestbook.icon ? (
                <AppText style={styles.heroEmoji}>{payload.guestbook.icon}</AppText>
              ) : (
                <GuestbookHeroIcon size={32} />
              )
            }
            title="Guestbook"
            description={description}
            footnote={footnote}
            submissions={slides}
            activeSlideIndex={activeSlideIndex}
            onChangeSlideIndex={(index) => {
              setMenuVisible(false);
              setActiveSlideIndex(index);
            }}
            onDismiss={() => router.back()}
            cta={isHost ? undefined : { label: 'Leave a message', onPress: openRecorder }}
            canDeleteActive={canDeleteActive}
            onPressOverflow={() => setMenuVisible(true)}
            renderSlideCaption={(item) =>
              isHost ? (
                <View style={{ gap: 2 }}>
                  <AppText style={styles.captionPrimary}>{item.takenBy || 'Guest'}</AppText>
                  {formatStoryTimestamp(item.postedAt) ? (
                    <AppText style={styles.captionSecondary}>
                      {formatStoryTimestamp(item.postedAt)}
                    </AppText>
                  ) : null}
                </View>
              ) : (
                // Naming the guest back to themselves reads oddly, and there is
                // never anyone else's message here to disambiguate from.
                <View style={{ gap: 2 }}>
                  <AppText style={styles.captionPrimary}>Your message</AppText>
                  {formatStoryTimestamp(item.postedAt) ? (
                    <AppText style={styles.captionSecondary}>
                      {formatStoryTimestamp(item.postedAt)}
                    </AppText>
                  ) : null}
                </View>
              )
            }
            renderSlideMedia={(item, onEnd) => {
              if (item.mediaType !== 'audio') return null;
              const message = resolvedMessages.find((entry) => entry.id === item.id);
              if (!message) return null;
              return <AudioStorySlide key={message.id} message={message} onEnd={onEnd} />;
            }}
          />
        )}
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <Pressable
              style={styles.menuOption}
              onPress={() => {
                Alert.alert('Delete message?', 'This will remove your Guestbook message.', [
                  { text: 'Cancel', style: 'cancel', onPress: () => setMenuVisible(false) },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => void confirmDeleteActiveMessage(),
                  },
                ]);
              }}
            >
              <AppText style={styles.menuDeleteText}>Delete message</AppText>
            </Pressable>
            <Pressable
              style={[styles.menuOption, styles.menuCancelOption]}
              onPress={() => setMenuVisible(false)}
            >
              <AppText style={styles.menuCancelText}>Cancel</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  /** Inset by 2pt so the gradient behind it reads as a border. */
  innerRoot: {
    flex: 1,
    margin: 2,
    backgroundColor: '#0B0B0C',
    overflow: 'hidden',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 32,
    lineHeight: 40,
  },
  audioSlide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: '#0B0B0C',
  },
  audioPlayBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSlideLabel: {
    marginTop: spacing.sm,
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 16,
  },
  audioSlideDuration: {
    color: 'rgba(255, 255, 255, 0.66)',
    fontSize: 14,
  },
  captionPrimary: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captionSecondary: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  menuSheet: {
    backgroundColor: colours.surfaceRaised,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  menuOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  menuDeleteText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    color: '#EF4444',
  },
  menuCancelOption: {
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
  },
  menuCancelText: {
    fontFamily: 'InstrumentSans_500Medium',
    color: colours.textSecondary,
  },
});
