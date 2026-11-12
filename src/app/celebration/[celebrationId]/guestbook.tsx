/**
 * The Guestbook — a private, challenge-shaped place for video messages.
 *
 * Presentation is deliberately the challenge story viewer, so the Guestbook
 * reads as one more thing to do at the event rather than a separate feature.
 * The only visual departure is the backdrop: a challenge blurs a photo from
 * the event, and the Guestbook moves its own tile's gradient.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
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
import { deleteGuestPhoto } from '@/services/guest-media-upload';
import { deleteHostPhoto } from '@/services/media-delete';
import {
  StoryViewer,
  formatStoryTimestamp,
  type StorySlideItem,
} from '@/features/celebrations/story-viewer';
import { AudioWaveformPlayer } from '@/features/celebrations/audio-playback';
import { FeatureGate } from '@/features/entitlements/feature-gate';
import { upgradesForFeature } from '@/features/entitlements/event-entitlements';
import { UpgradeSheet } from '@/features/entitlements/upgrade-sheet';
import { useEventEntitlements } from '@/features/entitlements/use-event-entitlements';
import { useEventFeatureSwitches } from '@/features/entitlements/use-event-feature-switches';
import { GUESTBOOK_GRADIENT } from '@/features/celebrations/challenge-gradients';
import { useIsEventHost } from '@/features/entitlements/use-event-role';
import { isSampleCelebrationId } from '@/features/celebrations/sample-event';
import { resolveSignedUrls } from '@/features/media/signed-url-cache';

type ResolvedMessage = GuestbookMessageRecord & { signedUrl: string };

/** What `fetch*Guestbook` fills in when the host has not written their own. */
const GUESTBOOK_DEFAULT_INSTRUCTIONS = 'Leave a message for the host.';

const TEXT_SHADE_COLORS = [
  'rgba(11, 11, 12, 0)',
  'rgba(11, 11, 12, 0.34)',
  'rgba(11, 11, 12, 0.34)',
  'rgba(11, 11, 12, 0)',
] as const;
const TEXT_SHADE_STOPS = [0.1, 0.36, 0.7, 0.98] as const;
const HAS_LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * An approximation of the display's corner radius, in points.
 *
 * The glass frame below sits just inside the screen edge, so on a phone with
 * rounded corners its curve has to follow the display's.
 *
 * Neither React Native nor Expo exposes the real radius — on iOS it is a
 * private `UIScreen` property — so this infers it from the top safe-area
 * inset, the one public signal that tracks the same hardware generations: a
 * Dynamic Island sits on the most rounded displays, a notch on slightly less
 * rounded ones, and a square-cornered phone has neither.
 *
 * Each band deliberately rounds up. A radius at least as large as the
 * display's keeps every pixel of the frame inside the mask; guessing small
 * clips the corners, which is the thing being fixed here. Guessing large
 * costs a barely perceptible sliver of background at each corner instead, so
 * the error is worth taking in that direction.
 */
function useScreenCornerRadius(): number {
  const insets = useSafeAreaInsets();

  // A browser viewport has square corners even on a rounded phone.
  if (Platform.OS === 'web') return 0;
  // Android reports the status bar height here whatever the display shape, so
  // the inset says nothing about curvature. Nearly all current Android phones
  // are rounded, and modestly so.
  if (Platform.OS === 'android') return 28;
  // 59pt in practice on every Dynamic Island iPhone.
  if (insets.top >= 51) return 55;
  // 44–50pt across the notched iPhones (X through 14).
  if (insets.top >= 30) return 48;
  // Home-button iPhones and iPads: genuinely square.
  return 0;
}

/**
 * The gallery card's clear glass over the moving gradient, shaped to the screen
 * itself so it warps the colour along every edge. The gradient is darkened
 * behind the text only, leaving the edges bright enough for the warp to show. Off iOS 26, and always on the
 * web, a fine light edge stands in.
 */
function GuestbookGlassFrame({ cornerRadius }: { cornerRadius: number }) {
  const frameStyle = [StyleSheet.absoluteFill, { borderRadius: cornerRadius }];
  const borderRadius = cornerRadius;

  if (HAS_LIQUID_GLASS) {
    return (
      <View pointerEvents="none" style={frameStyle}>
        <GlassView
          glassEffectStyle="clear"
          colorScheme="dark"
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
        <LinearGradient
          colors={TEXT_SHADE_COLORS}
          locations={TEXT_SHADE_STOPS}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={[frameStyle, styles.glassFrameFallback]}>
      <LinearGradient
        colors={TEXT_SHADE_COLORS}
        locations={TEXT_SHADE_STOPS}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
    </View>
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

function GuestbookScreenContent() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const cornerRadius = useScreenCornerRadius();

  const [resolvedMessages, setResolvedMessages] = useState<ResolvedMessage[]>([]);
  const [isSigningUrls, setIsSigningUrls] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const entitlements = useEventEntitlements(String(celebrationId));

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const isHost = (detail?.viewerRole ?? 'guest') === 'host';
  const isSample = isSampleCelebrationId(String(celebrationId));
  const messagesOpen = isSample || entitlements.has('guestbookMessages');
  const featureSwitches = useEventFeatureSwitches(String(celebrationId));

  // A guest only gets here through a link once there is nothing to leave a
  // message in. The event's own screen no longer offers the way in.
  const guestHasNoGuestbook =
    Boolean(detail) &&
    !isHost &&
    !isSample &&
    !entitlements.isLoading &&
    !featureSwitches.isLoading &&
    (!messagesOpen || !featureSwitches.guestbook);
  useEffect(() => {
    if (guestHasNoGuestbook) router.replace(`/celebration/${celebrationId}` as never);
  }, [guestHasNoGuestbook, router, celebrationId]);

  const hostQuery = useQuery({
    queryKey: ['guestbook', 'host', String(celebrationId)],
    queryFn: () => fetchHostGuestbook(String(celebrationId)),
    enabled: Boolean(celebrationId) && isHost,
  });

  const guestQuery = useQuery({
    queryKey: ['guestbook', 'guest', String(celebrationId)],
    queryFn: () => fetchGuestGuestbook(String(celebrationId)),
    // The example album has no guestbook rows and no guest token to read
    // them with. Its slides come from the definition instead — none yet, so
    // the intro card stands alone and explains what this is.
    enabled: Boolean(celebrationId) && !isHost && !isSample,
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
        const urlByPath = await resolveSignedUrls(
          'event-media',
          messages.map((item) => item.storagePath),
        );

        if (cancelled) return;
        setResolvedMessages(
          messages
            .map((item) => {
              const signedUrl = urlByPath.get(item.storagePath);
              return signedUrl ? { ...item, signedUrl } : null;
            })
            .filter((item): item is ResolvedMessage => item !== null),
        );
      } catch (error) {
        if (!cancelled) {
          console.error('[guestbook] failed to sign guestbook URLs', error);
          setResolvedMessages([]);
        }
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

  // A host moderates the whole Guestbook; a guest may remove what they wrote.
  // Since `get_guest_guestbook` only ever returns the caller's own messages, a
  // guest looking at a message is by definition looking at one they can delete
  // — but without a token there is nothing to authenticate the delete with.
  const canDeleteActive =
    Boolean(activeMessage) && (isHost || Boolean(guestMeta?.guestToken));

  const description = isSample
    ? 'Little video messages from guests, just for the host.'
    : messagesOpen
    ? payload?.guestbook.instructions?.trim() || GUESTBOOK_DEFAULT_INSTRUCTIONS
    : // The host's view while messages are locked, where the stock invitation
      // would be a promise with no button behind it.
      payload?.guestbook.instructions?.trim() &&
        payload.guestbook.instructions.trim() !== GUESTBOOK_DEFAULT_INSTRUCTIONS
      ? payload.guestbook.instructions.trim()
      : 'Thank you for celebrating with us.';

  const footnote = isSample
    ? 'On your own events, messages will appear here.'
    : !messagesOpen
    ? undefined
    : isHost
    ? resolvedMessages.length === 0
      ? 'No messages yet. They\'ll be just for you.'
      : `${resolvedMessages.length} private message${resolvedMessages.length === 1 ? '' : 's'}, visible only to you.`
    : 'Only the host will see this.';

  function openRecorder() {
    router.push({
      pathname: '/celebration/[celebrationId]/camera',
      params: { celebrationId: String(celebrationId), captureTarget: 'guestbook' },
    } as never);
  }

  async function confirmDeleteActiveMessage() {
    setMenuVisible(false);
    if (!activeMessage) return;

    try {
      // Both RPCs are media-type agnostic and enforce their own rule: the host
      // one checks the caller manages the event session, the guest one checks
      // the supplied token owns the row. Neither can be talked into deleting
      // something the caller has no claim on.
      if (isHost) {
        await deleteHostPhoto({ mediaItemId: activeMessage.id });
      } else {
        if (!guestMeta?.guestToken) return;
        await deleteGuestPhoto({
          mediaItemId: activeMessage.id,
          guestToken: guestMeta.guestToken,
        });
      }

      // Step back a slide, as the challenge viewer does, so the viewer lands on
      // the message before the one they just removed rather than being silently
      // advanced onto the next person's.
      setActiveSlideIndex((current) => Math.max(0, current - 1));

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
      <View style={styles.innerRoot}>
        {isLoading && !payload ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colours.textSecondary} />
          </View>
        ) : (
          <StoryViewer
            backdrop={{ kind: 'gradient', colors: GUESTBOOK_GRADIENT }}
            introFrame={<GuestbookGlassFrame cornerRadius={cornerRadius} />}
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
            // No CTA on the example: there is nothing to record into.
            // Guests record only where the package lets them; a host whose
            // package does not is shown the way to it instead.
            cta={
              isSample || entitlements.isLoading
                ? undefined
                : isHost
                ? messagesOpen
                  ? undefined
                  : { label: 'Let guests leave messages', onPress: () => setUpgradeOpen(true) }
                : messagesOpen
                ? { label: 'Leave a message', onPress: openRecorder }
                : undefined
            }
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
              // An audio message has no frame, so the waveform takes the place
              // the video would occupy — centred, full-bleed, on the Guestbook's
              // own black. `onEnd` is the viewer's advance, so audio moves the
              // story on exactly as a finished video does, and holds if it is
              // the last message.
              return (
                <View key={message.id} style={styles.audioSlide}>
                  <AudioWaveformPlayer
                    uri={message.signedUrl}
                    seed={message.id}
                    durationMs={message.durationMs}
                    autoPlay
                    onEnded={onEnd}
                    height={170}
                    // The story header already carries who sent it and when,
                    // and its tap zones own the whole screen — so the waveform
                    // is the entire slide, as a video frame would be.
                    showRemaining={false}
                    showPlayButton={false}
                  />
                </View>
              );
            }}
          />
        )}
      </View>

      {upgradeOpen ? (
        <UpgradeSheet
          visible
          celebrationId={String(celebrationId)}
          currentPlan={entitlements.plan}
          options={upgradesForFeature(entitlements.plan, 'guestbookMessages')}
          feature="guestbookMessages"
          title="Unlock Guestbook Messages"
          onClose={() => setUpgradeOpen(false)}
          onUpgraded={() => setUpgradeOpen(false)}
        />
      ) : null}

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
                Alert.alert(
                  'Delete message?',
                  isHost
                    ? `This permanently removes ${activeMessage?.displayName?.trim() || 'this guest'}'s message from your Guestbook.`
                    : 'This will remove your Guestbook message.',
                  [
                    { text: 'Cancel', style: 'cancel', onPress: () => setMenuVisible(false) },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => void confirmDeleteActiveMessage(),
                    },
                  ],
                );
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
  innerRoot: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    overflow: 'hidden',
  },
  glassFrameFallback: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
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

/**
 * Guestbook is a Stills+ feature, so the screen checks before it
 * renders rather than trusting whatever opened it. A host without the package
 * is offered the upgrade; a guest is sent back without ever seeing it.
 */
export default function GuestbookScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const { isHost } = useIsEventHost(String(celebrationId));

  return (
    <FeatureGate
      celebrationId={String(celebrationId)}
      feature="guestbook"
      title="Unlock Guestbook"
      isHost={isHost}
    >
      <GuestbookScreenContent />
    </FeatureGate>
  );
}
