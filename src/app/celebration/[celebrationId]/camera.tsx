import { useState, useEffect, useRef, useCallback } from 'react';
import { useEvent, useEventListener } from 'expo';
import {
  Animated,
  ActivityIndicator,
  AppState,
  View,
  Image,
  TextInput,
  useWindowDimensions,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { VideoView, useVideoPlayer } from 'expo-video';
let CameraView: any = null;
let useCameraPermissions: any = () => [null, () => {}];
let hasNativeCamera = false;

try {
  const expoCamera = require('expo-camera');
  CameraView = expoCamera.CameraView;
  useCameraPermissions = expoCamera.useCameraPermissions;
  hasNativeCamera = true;
} catch (error) {
  console.warn('Native camera module is missing in this build.', error);
}
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { celebrationKeys } from '@/services/celebrations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle } from 'react-native-svg';

import { useAuth } from '@/features/auth/context';
import { AppText } from '@/components/ui/text';
import { QrCodeIcon } from '@/components/ui/icons';
import { InviteShareSheet } from '@/features/sharing/invite-share-sheet';
import {
  fetchCelebrationDetail,
  type CelebrationDetail,
  celebrationDetailKeys,
} from '@/services/celebration-detail';
import { colours, radii, spacing, layout } from '@/design';
import { fetchMyProfile, firstNameFrom, profileKeys } from '@/services/profile';
import { isBackendConfigured } from '@/lib/supabase/client';
import { loadStoredGuestSessionByCelebrationId } from '@/services/guest-session';
import { uploadGuestPhoto } from '@/services/guest-media-upload';
import { uploadHostPhoto } from '@/services/host-media-upload';
import { useWebCameraTrack } from '@/features/media/web-camera-track';
import { useViewfinderPinchZoom } from '@/features/media/use-viewfinder-pinch-zoom';
import {
  createMirroredVideoTrack,
  type MirroredVideoTrack,
} from '@/features/media/web-mirrored-video-track';
import type { MediaSource } from '@/types/database';
import { eventAllowsVideoCapture } from '@/features/media/event-media';
import { uploadGuestMedia } from '@/services/guest-media-upload';
import { uploadHostMedia } from '@/services/host-media-upload';
import { normaliseMimeType } from '@/features/media/storage-paths';
import { useMicrophoneStatus } from '@/features/media/microphone-status';
import { AudioWaveform } from '@/features/celebrations/audio-waveform';
import { AudioWaveformPlayer } from '@/features/celebrations/audio-playback';
import { AudioCapture, type AudioCaptureResult } from '@/features/celebrations/audio-capture';

interface PhotoItem {
  uri: string;
  takenBy: string;
  id?: string;
  takenById?: string | null;
  postedAt?: string | null;
  submissionId?: string | null;
  challengeId?: string | null;
  caption?: string | null;
  mediaType?: 'photo' | 'video' | 'audio';
  durationMs?: number | null;
  mimeType?: string | null;
}

type VideoPreview = {
  uri: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationMs: number;
  source: MediaSource;
  challengeId?: string | null;
  guestbook?: boolean;
  caption?: string | null;
  /** Audio takes the same commit path as video, differing only in what the
   *  preview renders and what media type is uploaded. */
  kind?: 'video' | 'audio';
};

type PendingChallengePost = {
  challengeId: string;
  mediaItemId: string;
  localUri: string;
  mediaType: 'photo' | 'video';
  postedAt: string;
  caption?: string | null;
  durationMs?: number | null;
  mimeType?: string | null;
};

function formatUploadFailure(mediaType: 'photo' | 'video' | 'audio', error: unknown) {
  const fallback = `Your ${mediaType} could not be uploaded. Please try again.`;
  if (!(error instanceof Error) || !error.message) return fallback;
  return `${fallback}\n\n${error.message}`;
}

function getWebCameraVideoElement(container: unknown): HTMLVideoElement | null {
  if (Platform.OS !== 'web') return null;
  if (!container || typeof (container as Element).querySelector !== 'function') return null;
  const video = (container as Element).querySelector('video');
  return video instanceof HTMLVideoElement ? video : null;
}

function releaseVideoPreviewUri(uri: string) {
  if (Platform.OS === 'web' && uri.startsWith('blob:')) {
    URL.revokeObjectURL(uri);
  }
}

function getPreferredWebRecorderMimeType(): string | undefined {
  if (Platform.OS !== 'web' || typeof MediaRecorder === 'undefined') return undefined;

  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4D002A,mp4a.40.2',
    'video/mp4',
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function InlineVideoPreview({ uri, autoPlay = false }: { uri: string; autoPlay?: boolean }) {
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = false;
    instance.muted = false;
    if (autoPlay) {
      instance.play();
      return;
    }
    instance.pause();
  });

  return (
    <View style={S.inlineVideoPreviewWrap}>
      <VideoView
        player={player}
        style={S.inlineVideoPreviewVideo}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

// ─── Layout constants ─────────────────────────────────────────────────────────

/**
 * Header type metrics.
 *
 * `AppText` defaults to the `body` variant, which carries `lineHeight: 22`.
 * The header styles below raise `fontSize` past that without raising the
 * leading to match, so a 24px display serif was being squeezed into a 22px
 * line box and losing its ascenders off the top. Every font size here is
 * paired with a leading that can actually contain it.
 */
const HEADER_TITLE_SIZE = 24;
const HEADER_TITLE_LEADING = 30;
const HEADER_SUBTITLE_SIZE = 12;
const HEADER_SUBTITLE_LEADING = 16;
const HEADER_SUBTITLE_GAP = 4;

/** What the two lines genuinely occupy, plus a little slack. */
const HEADER_CONTENT_HEIGHT =
  HEADER_TITLE_LEADING + HEADER_SUBTITLE_GAP + HEADER_SUBTITLE_LEADING + 6;

/** Clear air between the safe-area edge and the title, on every device. */
const HEADER_TOP_GAP = 24;

/**
 * The two floating viewfinder controls — the photo counter and the zoom
 * selector — are both built from these, so they cannot drift apart in height,
 * corner radius, or internal padding.
 */
const PILL_HEIGHT = 36;
const PILL_RADIUS = PILL_HEIGHT / 2;
const PILL_PADDING = 3;
/** Inner control height, so the pill's own padding is the only thing added. */
const PILL_INNER_HEIGHT = PILL_HEIGHT - PILL_PADDING * 2;
/** Distance from the viewfinder edge. Shared, so both sit on one baseline. */
const PILL_INSET = 20;

/** Counter type, sized to sit inside PILL_HEIGHT without clipping. */
const COUNTER_SIZE = 22;
const COUNTER_LEADING = 28;
const MAX_VIDEO_DURATION_MS = 30_000;
/**
 * Audio runs to a minute where video stops at thirty seconds. A spoken message
 * to the host wants the room a clip does not, and audio costs an order of
 * magnitude less per second to upload. The finalize RPCs enforce the same two
 * ceilings server-side — this constant only drives the countdown.
 */
const MAX_AUDIO_DURATION_MS = 60_000;

/** `m:ss`, so the audio countdown can start at 1:00 and video still reads 0:30. */
function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The widest zoom level, on the normalised 0–1 scale `CameraView.zoom` uses.
 *
 * Deliberately not exactly `0`. `expo-camera`'s web layer converts a
 * normalized zoom via `if (!value) return;` (see its
 * `WebCameraUtils.convertNormalizedSetting`), which treats an explicit `0`
 * identically to "not provided" and silently drops the constraint — so
 * returning to this level appeared to do nothing and the camera stayed at
 * whichever zoom was applied last. Web no longer routes zoom through that
 * function at all (`useWebCameraTrack` applies it to the track directly),
 * but the value is kept truthy so nothing depends on which path is taken.
 * It is indistinguishable from zero at any real zoom range.
 */
const MIN_ZOOM = 0.0001;
const MAX_ZOOM = 1;
const PINCH_ZOOM_SENSITIVITY = 0.55;

const ZOOM_OPTIONS = [
  { label: '0.5', value: MIN_ZOOM },
  { label: '1x', value: 0.15 },
  { label: '2.5', value: 0.45 },
];

function clampCameraZoom(value: number): number {
  if (!Number.isFinite(value)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function distanceBetweenTouches(touches: ArrayLike<{ pageX: number; pageY: number }>): number | null {
  if (touches.length < 2) return null;
  const first = touches[0];
  const second = touches[1];
  const dx = first.pageX - second.pageX;
  const dy = first.pageY - second.pageY;
  return Math.hypot(dx, dy);
}

function nearestZoomOptionValue(zoom: number): number {
  return ZOOM_OPTIONS.reduce((nearest, option) =>
    Math.abs(option.value - zoom) < Math.abs(nearest - zoom) ? option.value : nearest,
    ZOOM_OPTIONS[0].value,
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function CloseChevron({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DotsIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5} r={2} fill={color} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Circle cx={12} cy={19} r={2} fill={color} />
    </Svg>
  );
}

function FlashIcon({ mode, size = 22, color = '#FFFFFF' }: { mode: 'off' | 'on' | 'auto'; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={mode === 'on' ? color : 'none'}
      />
      {mode === 'auto' && (
        <View style={S.flashAutoBadge}>
          <AppText style={S.flashAutoText}>A</AppText>
        </View>
      )}
    </Svg>
  );
}

function FlipIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CameraRollPlusIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Camera / Viewfinder Screen ────────────────────────────────────────────────

export default function CameraScreen() {
  const { celebrationId, captureTarget, challengeId } = useLocalSearchParams<{
    celebrationId: string;
    captureTarget?: string;
    challengeId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // ── Auth & Profile ──
  const { session } = useAuth();
  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
    enabled: isBackendConfigured && !!session,
  });

  // ── Event query ──
  const { data: detail, isLoading: eventLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const celebration = detail?.celebration;
  const primarySession = detail?.primarySession;
  const limit = primarySession?.shot_limit_per_guest ?? null;
  const isChallengeCapture = captureTarget === 'challenge' && Boolean(challengeId);
  const isGuestbookCapture = captureTarget === 'guestbook';
  // The Guestbook is a distinct feature from the main gallery's photo/video
  // toggle — a host disabling video contributions for the gallery should not
  // silently break Guestbook video messages, so this bypasses that gate.
  const videoCaptureEnabled = isGuestbookCapture || eventAllowsVideoCapture(primarySession);

  // ── Upload pipeline ──
  //
  // `capture_mode` is the source of truth for whether the camera-roll action
  // shows at all — no separate toggle, no client-side flag. It applies to both
  // hosts and guests, so the setting controls what actions are available to both.
  const isGuest = detail?.viewerRole === 'guest';
  const captureMode = primarySession?.capture_mode ?? 'camera_and_library';
  const showCameraRollAction = captureMode !== 'camera_only' && !isGuestbookCapture;
  const [guestAuth, setGuestAuth] = useState<{
    slug: string;
    guestToken: string;
    guestSessionId: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isGuest || !celebrationId) return;
    let cancelled = false;
    (async () => {
      const found = await loadStoredGuestSessionByCelebrationId(String(celebrationId));
      if (!cancelled && found) {
        setGuestAuth({
          slug: found.slug,
          guestToken: found.session.guestToken,
          guestSessionId: found.session.guestSessionId,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuest, celebrationId]);

  // ── States ──
  const isWeb = Platform.OS === 'web';
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isPhotosLoaded, setIsPhotosLoaded] = useState(false);
  // Guestbook messages are spoken to camera, so they default to the selfie
  // camera — every other capture target keeps the rear camera default.
  const [facing, setFacing] = useState<'front' | 'back'>(
    captureTarget === 'guestbook' ? 'front' : 'back',
  );
  // Real per-shot flash strobe (off/on/auto), meaningful only on native — see
  // `toggleFlash` for why web drives a completely different prop.
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  // Continuous "torch" light, the only flash-adjacent capability a browser's
  // camera API exposes. Web-only state; native never reads it.
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [shareVisible, setShareVisible] = useState(false);
  const [challengePreviewUri, setChallengePreviewUri] = useState<string | null>(null);
  const [challengePhotoSource, setChallengePhotoSource] = useState<MediaSource>('camera');
  const [galleryPreviewUri, setGalleryPreviewUri] = useState<string | null>(null);
  const [galleryPhotoSource, setGalleryPhotoSource] = useState<MediaSource>('camera');
  const [galleryPhotoMime, setGalleryPhotoMime] = useState<string>('image/jpeg');
  const [galleryPhotoWidth, setGalleryPhotoWidth] = useState<number | undefined>(undefined);
  const [galleryPhotoHeight, setGalleryPhotoHeight] = useState<number | undefined>(undefined);
  const [galleryCaption, setGalleryCaption] = useState('');
  const MAX_CAPTION_LENGTH = 120;
  const [challengeCaption, setChallengeCaption] = useState('');
  const [videoPreview, setVideoPreview] = useState<VideoPreview | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingRemainingMs, setRecordingRemainingMs] = useState(MAX_VIDEO_DURATION_MS);
  const [captureType, setCaptureType] = useState<'photo' | 'video' | 'audio'>(
    isGuestbookCapture ? 'video' : 'photo',
  );
  const isAudioCapture = captureType === 'audio';
  /** Rolling amplitudes for the live waveform; only the tail is ever drawn. */
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const pushAudioLevel = useCallback((level: number) => {
    setAudioLevels((current) => {
      const next = current.length > 120 ? current.slice(current.length - 120) : current.slice();
      next.push(level);
      return next;
    });
  }, []);
  const activeMaxDurationMs = isAudioCapture ? MAX_AUDIO_DURATION_MS : MAX_VIDEO_DURATION_MS;
  const recordingStartRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActiveRef = useRef(false);
  const recordingStopRequestedRef = useRef(false);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  // `expo-camera`'s web camera stream never includes a microphone track (see
  // `stopWebMicStream` below), so recording acquires one independently.
  const webMicStreamRef = useRef<MediaStream | null>(null);
  // Set only when recording the front camera on web — see
  // `createMirroredVideoTrack` for why that path needs its own track.
  const webMirroredVideoTrackRef = useRef<MirroredVideoTrack | null>(null);
  const webRecorderMimeType = isWeb ? getPreferredWebRecorderMimeType() : undefined;
  const hasShownFirstLimitNoticeRef = useRef(false);
  const hasShownFiveLeftNoticeRef = useRef(false);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(MIN_ZOOM);
  const captureModeAnim = useRef(new Animated.Value(captureType === 'video' ? 1 : 0)).current;

  // On web the torch and zoom are driven straight onto the live MediaStream
  // track rather than through `CameraView`'s props — see `web-camera-track`
  // for why the library cannot do it.
  const { containerRef: cameraContainerRef } = useWebCameraTrack({
    facing,
    torchOn,
    zoom,
  });

  /**
   * Web only shows a flash control for the back camera.
   *
   * This is deliberately NOT gated on `webCamera.torch` (the browser's own
   * capability report). `MediaStreamTrack.getCapabilities().torch` is
   * unreliable on mobile Chrome — it can come back empty for a beat right
   * after the stream starts, or simply never populate on some Android
   * builds — so trusting it as a visibility gate hid the flash button on
   * real rear cameras that do have one. `facing` is a much safer signal:
   * front cameras essentially never have a torch, rear cameras on a phone
   * being used for event photography essentially always do. The actual
   * `applyConstraints` call in `web-camera-track` still checks real
   * capabilities before touching the track, so tapping the button on
   * hardware that truly has no torch just does nothing — same as if it were
   * correctly hidden, without the risk of hiding it when it does work.
   */
  const showFlashControl = !isWeb || facing === 'back';
  const showPhotoLibraryAction = showCameraRollAction && captureType === 'photo';

  /** Guards `handleCameraMountError` against reverting `facing` in a loop. */
  const isRecoveringFacing = useRef(false);

  const supportsVideoRecording =
    videoCaptureEnabled && (!isWeb || Boolean(webRecorderMimeType));

  // Same check, same status reporting, on every recording surface — main
  // gallery video, Challenge video, Guestbook video, Guestbook audio all
  // land here, since they all share this one screen. "Active" is whichever
  // mode would actually capture sound, with the viewfinder actually showing
  // (not a preview) — a guest browsing in photo mode is never asked for a
  // microphone they'll never use.
  const micActive =
    !videoPreview &&
    !challengePreviewUri &&
    !galleryPreviewUri &&
    (isAudioCapture || (captureType === 'video' && supportsVideoRecording));
  const micStatus = useMicrophoneStatus({ active: micActive });

  useEffect(() => {
    // The Guestbook offers audio and video; anything else that leaks in (a
    // stale 'photo' from a previous target) falls back to video.
    if (isGuestbookCapture) {
      if (captureType !== 'video' && captureType !== 'audio') setCaptureType('video');
      return;
    }
    if (captureType === 'audio') {
      setCaptureType(videoCaptureEnabled ? 'video' : 'photo');
      return;
    }
    if (!videoCaptureEnabled && captureType !== 'photo') {
      setCaptureType('photo');
    }
  }, [videoCaptureEnabled, captureType, isGuestbookCapture]);

  useEffect(() => {
    Animated.timing(captureModeAnim, {
      toValue: captureType === 'video' ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [captureModeAnim, captureType]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingActiveRef.current) {
        if (Platform.OS === 'web') {
          webRecorderRef.current?.stop();
          // `onstop` may never run once this screen has unmounted, so the
          // microphone and any mirrored-track redraw loop are released
          // synchronously here too.
          stopWebMicStream();
          stopWebMirroredVideoTrack();
        } else {
          cameraRef.current?.stopRecording?.();
        }
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreview?.uri) {
        releaseVideoPreviewUri(videoPreview.uri);
      }
    };
  }, [videoPreview]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && recordingActiveRef.current) {
        recordingStopRequestedRef.current = true;
        if (Platform.OS === 'web') {
          webRecorderRef.current?.stop();
        } else {
          cameraRef.current?.stopRecording?.();
        }
      }
    });
    return () => subscription.remove();
  }, []);

  // ── Animation Values ──
  const shutterFlashOpacity = useRef(new Animated.Value(0)).current;
  const flyingAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const flyingScale = useRef(new Animated.Value(1)).current;
  const flyingOpacity = useRef(new Animated.Value(1)).current;
  const [flyingThumbnailUri, setFlyingThumbnailUri] = useState<string | null>(null);

  // ── Countdown Timer ──
  const [countdown, setCountdown] = useState({
    days: 0, hours: 0, minutes: 0,
    isCompleted: false, isOngoing: false,
  });

  // ── Drum Roll Counter Animation ──
  const [displayedCount, setDisplayedCount] = useState<number | null>(null);
  const hasAnimatedCounter = useRef(false);

  useEffect(() => {
    if (!celebration) return;
    const compute = () => {
      const endsAt = primarySession?.ends_at ?? celebration.ends_at;
      if (!endsAt) {
        setCountdown({ days: 0, hours: 0, minutes: 0, isCompleted: false, isOngoing: true });
        return;
      }
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, isCompleted: true, isOngoing: false });
        return;
      }
      const totalMin = Math.floor(diff / 60000);
      const totalHrs = Math.floor(totalMin / 60);
      setCountdown({
        days: Math.floor(totalHrs / 24),
        hours: totalHrs % 24,
        minutes: totalMin % 60,
        isCompleted: false,
        isOngoing: false,
      });
    };
    compute();
    const t = setInterval(compute, 10000);
    return () => clearInterval(t);
  }, [celebration, primarySession]);

  // ── Load Captured Photos ──
  useEffect(() => {
    if (!celebrationId) return;
    (async () => {
      const key = `__mock_photos_${celebrationId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const migrated = parsed.map((item: any) => {
            if (typeof item === 'string') {
              return { uri: item, takenBy: 'Guest' };
            }
            return item;
          });
          setPhotos(migrated);
        } catch {}
      }
      setIsPhotosLoaded(true);
    })();
  }, [celebrationId]);

  // ── Dynamic Dimensions & Animation Targets ──
  // Header geometry is derived rather than guessed: HEADER_CONTENT_HEIGHT is
  // the space the two lines of type actually occupy, and HEADER_TOP_GAP is
  // clear air between the safe-area edge and the title. Adding them keeps the
  // total at the 80 the viewfinder maths already assumes.
  const headerHeight = HEADER_TOP_GAP + HEADER_CONTENT_HEIGHT;
  const bottomPanelHeight = 115;
  const viewfinderHeight = screenHeight - insets.top - headerHeight - bottomPanelHeight - insets.bottom;
  const photoButtonSize = 44;

  // Center coordinates of the screen/viewfinder
  const startCenterX = screenWidth / 2;
  const startCenterY = insets.top + headerHeight + viewfinderHeight / 2;

  // Center coordinates of the Photos thumbnail button (bottom right)
  const targetCenterX = screenWidth - layout.gutter - photoButtonSize / 2;
  const targetCenterY = screenHeight - insets.bottom - bottomPanelHeight / 2;

  // Offsets for the transition
  const deltaX = targetCenterX - startCenterX;
  const deltaY = targetCenterY - startCenterY;

  // ── Handlers ──

  /**
   * `flash` (off/on/auto) is a per-shot strobe decision the hardware makes at
   * the moment of capture — real on native, but not a thing a browser's
   * camera API can do at all. The only flash-adjacent capability the web
   * platform exposes is `torch`, a continuous light with no shutter-synced
   * behaviour. "Auto" has no meaning for a light that is simply on or off, so
   * web gets a 2-state toggle instead of native's 3-state cycle.
   *
   * `torchOn` is read by `useWebCameraTrack`, which applies it to the live
   * MediaStream track; it is not passed to `CameraView`, whose own web
   * implementation of this cannot be made to work — see that module.
   */
  function toggleFlash() {
    if (isWeb) {
      setTorchOn((prev) => !prev);
      return;
    }
    setFlash((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  }

  function toggleFacing() {
    // A deliberate flip starts a fresh recovery budget: the previous failure,
    // if any, is no longer what the viewfinder is trying to do.
    isRecoveringFacing.current = false;
    setTorchOn(false);
    setZoom(MIN_ZOOM);
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }

  function setCaptureMode(next: 'photo' | 'video' | 'audio') {
    if (isRecording || next === captureType) return;
    // The Guestbook is the only surface offering audio, and it offers nothing
    // else — every other target keeps the photo/video pair it had.
    if (isGuestbookCapture) {
      if (next !== 'audio' && next !== 'video') return;
      setCaptureType(next);
      return;
    }
    if (!videoCaptureEnabled || next === 'audio') return;
    if (isWeb && next === 'video' && !webRecorderMimeType) {
      Alert.alert(
        'Video not supported here',
        'This browser can record video, but not yet in a format that plays reliably in the iPhone app. Please use the iOS app for video on this event for now.',
      );
      return;
    }
    setCaptureType(next);
  }

  /**
   * Recovery when a camera fails to start — a single-camera device, another
   * app holding the camera, a mid-session permission hiccup. Without this the
   * view is left on a stream that no longer matches what the UI claims, with
   * no visible feedback.
   *
   * The revert is deliberately allowed only ONCE per flip. Reverting sets
   * `facing` back, and on web that remounts the camera (see the `key` on
   * `CameraView`) — so if BOTH cameras fail, an unguarded revert would flip
   * back and forth forever, stacking an alert on every pass. The second
   * consecutive failure reports and stops instead.
   */
  function handleCameraMountError() {
    if (isRecoveringFacing.current) {
      isRecoveringFacing.current = false;
      console.error('Camera failed to start on both facings — not reverting again.');
      Alert.alert(
        'Camera unavailable',
        "Couldn't start the camera. Another app may be using it, or camera access may be blocked for this site.",
      );
      return;
    }

    console.error('Camera failed to (re)start — reverting facing mode.');
    isRecoveringFacing.current = true;
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
    Alert.alert(
      'Camera unavailable',
      "Couldn't switch cameras. This device may only have one, or another app is using it.",
    );
  }

  function maybeShowGuestLimitMilestone(shotsUsedAfterUpload: number) {
    if (!isGuest || limit === null) return;

    const remainingAfterUpload = Math.max(0, limit - shotsUsedAfterUpload);

    if (shotsUsedAfterUpload === 1 && !hasShownFirstLimitNoticeRef.current) {
      hasShownFirstLimitNoticeRef.current = true;
      Alert.alert(
        'You\'re in',
        `Lovely start. You’ve now got ${remainingAfterUpload} moment${remainingAfterUpload === 1 ? '' : 's'} left to capture the story.`,
      );
      return;
    }

    if (
      limit > 5 &&
      remainingAfterUpload === 5 &&
      !hasShownFiveLeftNoticeRef.current
    ) {
      hasShownFiveLeftNoticeRef.current = true;
      Alert.alert(
        '5 moments left',
        'You’re down to your final 5 moments, so make them count.',
      );
    }
  }

  /**
   * Flying-thumbnail animation and upload, shared by a camera capture and a
   * camera-roll pick so the two feel like the same action landing in the
   * same place, and so the upload path is written exactly once.
   *
   * Host and guest both go through a real pipeline now (`uploadHostPhoto` /
   * `uploadGuestPhoto`) — there is no product reason for a host's own
   * contribution to their own event to land somewhere different from a
   * guest's. A failed or cancelled upload never reaches `finalize`, so
   * nothing server-side needs rolling back — only the local, session-only
   * thumbnail does, in the `catch` below.
   *
   * The one remaining branch is `isBackendConfigured`: with no real backend
   * at all (the typed development fallback), both roles fall back to local
   * mock storage, same as every other screen in that mode.
   */
  async function commitPhoto(
    uri: string,
    source: MediaSource,
    mimeType?: string,
    width?: number,
    height?: number,
    captionText?: string,
  ) {
    setFlyingThumbnailUri(uri);
    flyingAnim.setValue({ x: 0, y: 0 });
    flyingScale.setValue(1);
    flyingOpacity.setValue(1);

    await new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(flyingAnim, {
          toValue: { x: deltaX, y: deltaY },
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(flyingScale, {
          toValue: 0.15,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(flyingOpacity, {
          toValue: 0.1,
          duration: 380,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

    setFlyingThumbnailUri(null);

    const trimmedCaption = captionText?.trim() || undefined;
    const userName = firstNameFrom(profile) || 'You';
    const newPhoto: PhotoItem = { uri, takenBy: userName, caption: trimmedCaption ?? null };
    const next = [newPhoto, ...photos];
    setPhotos(next);

    if (!isBackendConfigured) {
      await AsyncStorage.setItem(`__mock_photos_${celebrationId}`, JSON.stringify(next));
    } else {
      setIsUploading(true);
      try {
        if (isGuest && guestAuth) {
          const uploadResult = await uploadGuestPhoto({
            eventCode: guestAuth.slug,
            guestToken: guestAuth.guestToken,
            localUri: uri,
            source,
            mimeType,
            width,
            height,
            metadata: trimmedCaption ? { caption: trimmedCaption } : undefined,
          });
          newPhoto.id = uploadResult.mediaItemId;
          maybeShowGuestLimitMilestone(uploadResult.shotsUsed);
        } else if (!isGuest && celebrationId) {
          const uploadResult = await uploadHostPhoto({
            celebrationId: String(celebrationId),
            localUri: uri,
            source,
            mimeType,
            width,
            height,
            metadata: trimmedCaption ? { caption: trimmedCaption } : undefined,
          });
          newPhoto.id = uploadResult.mediaItemId;
        } else {
          // Guest identity hasn't loaded yet (loadStoredGuestSessionByCelebrationId
          // is async — see the effect above). Rare in practice since the
          // camera-roll/shutter buttons are only reachable once the screen
          // has fully mounted, but fail loud rather than silently drop the photo.
          throw new Error('No identity available to upload this photo yet.');
        }
        await queryClient.invalidateQueries({
          queryKey: celebrationDetailKeys.detail(String(celebrationId)),
        });
        setPhotos([newPhoto, ...photos]);
      } catch (e) {
        console.error(`Failed to upload ${source} photo:`, e);
        Alert.alert('Upload failed', formatUploadFailure('photo', e));
        // The server never received it — only the local, session-only
        // thumbnail needs undoing.
        setPhotos(photos);
      } finally {
        setIsUploading(false);
      }
    }

    // Invalidate query to trigger global Live Activity sync manager instantly
    void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
  }

  async function commitVideo(preview: VideoPreview, captionInput?: string) {
    const mediaKind = preview.kind === 'audio' ? 'audio' : 'video';
    const trimmedCaption = captionInput?.trim() || undefined;
    setIsUploading(true);
    try {
      let postedMediaItemId: string | null = null;
      const postedAt = new Date().toISOString();
      if (!isBackendConfigured) {
        const item: PhotoItem = {
          uri: preview.uri,
          takenBy: firstNameFrom(profile) || 'You',
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          postedAt,
          mediaType: mediaKind,
          durationMs: preview.durationMs,
          mimeType: preview.mimeType,
          challengeId: preview.challengeId ?? null,
          caption: trimmedCaption ?? null,
        };
        postedMediaItemId = item.id ?? null;
        const key = preview.challengeId
          ? `__mock_challenge_submissions_${celebrationId}_${preview.challengeId}`
          : preview.guestbook
            ? `__mock_guestbook_${celebrationId}`
            : `__mock_photos_${celebrationId}`;
        const stored = await AsyncStorage.getItem(key);
        let current: PhotoItem[] = [];
        if (stored) {
          try {
            current = JSON.parse(stored).map((value: any) =>
              typeof value === 'string' ? { uri: value, takenBy: 'Guest', mediaType: 'photo' } : value,
            );
          } catch {
            current = [];
          }
        }
        await AsyncStorage.setItem(key, JSON.stringify([item, ...current]));
      } else if (isGuest && guestAuth) {
        const uploadResult = await uploadGuestMedia({
          eventCode: guestAuth.slug,
          guestToken: guestAuth.guestToken,
          localUri: preview.uri,
          source: preview.source,
          mediaType: mediaKind,
          mimeType: preview.mimeType,
          width: preview.width ?? undefined,
          height: preview.height ?? undefined,
          durationMs: preview.durationMs,
          metadata: preview.challengeId
            ? {
                challenge_id: preview.challengeId,
                submission_kind: 'challenge',
                ...(trimmedCaption ? { caption: trimmedCaption } : {}),
              }
            : preview.guestbook
              ? { submission_kind: 'guestbook' }
              : undefined,
        });
        postedMediaItemId = uploadResult.mediaItemId;
        // Guestbook messages are not part of the guest's photo/video shot
        // allowance, so `shotsUsed` here would be misleading if surfaced.
        if (!preview.guestbook) {
          maybeShowGuestLimitMilestone(uploadResult.shotsUsed);
        }
      } else if (!isGuest && celebrationId) {
        const uploadResult = await uploadHostMedia({
          celebrationId: String(celebrationId),
          localUri: preview.uri,
          source: preview.source,
          mediaType: mediaKind,
          mimeType: preview.mimeType,
          width: preview.width ?? undefined,
          height: preview.height ?? undefined,
          durationMs: preview.durationMs,
          metadata: preview.challengeId
            ? {
                challenge_id: preview.challengeId,
                submission_kind: 'challenge',
                ...(trimmedCaption ? { caption: trimmedCaption } : {}),
              }
            : preview.guestbook
              ? { submission_kind: 'guestbook' }
              : undefined,
        });
        postedMediaItemId = uploadResult.mediaItemId;
      } else {
        throw new Error('No identity available to upload this video yet.');
      }

      if (preview.challengeId) {
        const pending: PendingChallengePost = {
          challengeId: String(preview.challengeId),
          mediaItemId: postedMediaItemId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          localUri: preview.uri,
          mediaType: 'video',
          postedAt,
          durationMs: preview.durationMs,
          mimeType: preview.mimeType,
        };
        await AsyncStorage.setItem(
          `__mock_pending_challenge_refresh_${celebrationId}`,
          JSON.stringify(pending),
        );
      }

      await queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebrationId)),
      });
      void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });

      if (preview.challengeId) {
        const target = {
          pathname: '/celebration/[celebrationId]',
          params: {
            celebrationId: String(celebrationId),
            openChallengeId: String(preview.challengeId),
            ...(postedMediaItemId ? { openChallengeMediaId: postedMediaItemId } : {}),
            challengePostedAt: String(Date.now()),
          },
        };
        if (router.canDismiss()) {
          router.dismissTo(target as never);
        } else {
          router.replace(target as never);
        }
        setVideoPreview(null);
        setChallengeCaption('');
        return;
      }

      if (preview.guestbook) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['guestbook', 'guest', String(celebrationId)] }),
          queryClient.invalidateQueries({ queryKey: ['guestbook', 'host', String(celebrationId)] }),
        ]);
        const guestbookTarget = {
          pathname: '/celebration/[celebrationId]/guestbook',
          params: { celebrationId: String(celebrationId) },
        };
        if (router.canDismiss()) {
          router.dismissTo(guestbookTarget as never);
        } else {
          router.replace(guestbookTarget as never);
        }
        setVideoPreview(null);
        setChallengeCaption('');
        deleteLocalVideo(preview.uri, 'posting');
        return;
      }

      const galleryTarget = {
        pathname: '/celebration/[celebrationId]',
        params: {
          celebrationId: String(celebrationId),
          videoPostedAt: String(Date.now()),
        },
      };

      if (router.canDismiss()) {
        router.dismissTo(galleryTarget as never);
      } else {
        router.replace(galleryTarget as never);
      }

      deleteLocalVideo(preview.uri, 'posting');
    } catch (error) {
      console.error('Failed to upload video:', error);
      Alert.alert('Upload failed', formatUploadFailure(mediaKind, error));
    } finally {
      setIsUploading(false);
    }
  }

  async function commitChallengePhoto(uri: string, captionInput?: string, photoSource: MediaSource = 'camera'): Promise<string | false> {
    if (!celebrationId || !challengeId) {
      throw new Error('Missing challenge capture context.');
    }

    const trimmedCaption = captionInput?.trim() || undefined;
    setIsUploading(true);
    try {
      const userName = firstNameFrom(profile) || 'You';
      const userId = profile?.id ?? session?.user.id ?? guestAuth?.guestSessionId ?? null;
      const postedAt = new Date().toISOString();
      let postedMediaItemId: string | null = null;
      const metadata = {
        challenge_id: challengeId,
        submission_kind: 'challenge',
        ...(trimmedCaption ? { caption: trimmedCaption } : {}),
      };

      if (!isBackendConfigured) {
        const submissionsKey = `__mock_challenge_submissions_${celebrationId}_${challengeId}`;
        const storedSubmissions = await AsyncStorage.getItem(submissionsKey);
        let submissions: PhotoItem[] = [];
        if (storedSubmissions) {
          try {
            submissions = JSON.parse(storedSubmissions).map((item: any) => {
              if (typeof item === 'string') {
                return { uri: item, takenBy: 'Guest' };
              }
              return item as PhotoItem;
            });
          } catch {
            submissions = [];
          }
        }

        postedMediaItemId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const nextSubmissions = [
          {
            uri,
            takenBy: userName,
            takenById: userId,
            postedAt,
            id: postedMediaItemId,
            submissionId: postedMediaItemId,
            challengeId,
            caption: trimmedCaption ?? null,
            mediaType: 'photo' as const,
          },
          ...submissions,
        ];
        await AsyncStorage.setItem(submissionsKey, JSON.stringify(nextSubmissions));
      } else if (isGuest && guestAuth) {
        const uploadResult = await uploadGuestPhoto({
          eventCode: guestAuth.slug,
          guestToken: guestAuth.guestToken,
          localUri: uri,
          source: photoSource,
          mimeType: 'image/jpeg',
          metadata,
        });
        postedMediaItemId = uploadResult.mediaItemId;
      } else if (!isGuest && celebrationId) {
        const uploadResult = await uploadHostPhoto({
          celebrationId: String(celebrationId),
          localUri: uri,
          source: photoSource,
          mimeType: 'image/jpeg',
          metadata,
        });
        postedMediaItemId = uploadResult.mediaItemId;
      } else {
        throw new Error('No identity available to upload this challenge photo yet.');
      }

      const pending: PendingChallengePost = {
        challengeId: String(challengeId),
        mediaItemId: postedMediaItemId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        localUri: uri,
        mediaType: 'photo',
        postedAt,
        mimeType: 'image/jpeg',
      };
      await AsyncStorage.setItem(
        `__mock_pending_challenge_refresh_${celebrationId}`,
        JSON.stringify(pending),
      );

      await queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebrationId)),
      });
      void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
      const target = {
        pathname: '/celebration/[celebrationId]',
        params: {
          celebrationId: String(celebrationId),
          openChallengeId: String(challengeId),
          ...(postedMediaItemId ? { openChallengeMediaId: postedMediaItemId } : {}),
          challengePostedAt: String(Date.now()),
        },
      };
      if (router.canDismiss()) {
        router.dismissTo(target as never);
      } else {
        router.replace(target as never);
      }
      return postedMediaItemId ?? pending.mediaItemId;
    } catch (error) {
      console.error('Failed to post challenge photo:', error);
      Alert.alert('Upload failed', formatUploadFailure('photo', error));
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  /**
   * `expo-camera`'s web layer opens its preview stream through
   * `WebUserMediaManager.requestUserMediaAsync`, which defaults its `isMuted`
   * parameter to `true` — and `getStreamDevice` always calls it with no
   * audio argument, regardless of `CameraView`'s own `mute` prop. So on web
   * the live camera stream never has a microphone track, no matter what this
   * screen passes. `startVideoRecording` requests one separately and stops
   * it here once recording ends, fails, or this screen unmounts.
   */
  function stopWebMicStream() {
    webMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    webMicStreamRef.current = null;
  }

  function stopWebMirroredVideoTrack() {
    webMirroredVideoTrackRef.current?.stop();
    webMirroredVideoTrackRef.current = null;
  }

  async function startVideoRecording() {
    if (
      !supportsVideoRecording ||
      recordingActiveRef.current ||
      isUploading ||
      outOfShots ||
      (!isWeb && !cameraRef.current?.recordAsync)
    ) {
      return;
    }

    // No permission gate here: `useMicrophoneStatus` above already requested
    // access as soon as video mode became active, and recording is never
    // blocked on the answer — a guest who declined still gets their video,
    // just with the "may not include sound" status visible in the viewfinder.
    recordingActiveRef.current = true;
    recordingStopRequestedRef.current = false;
    setRecordingRemainingMs(MAX_VIDEO_DURATION_MS);
    setIsRecording(true);
    recordingStartRef.current = Date.now();
    clearRecordingTimer();
    recordingTimerRef.current = setInterval(() => {
      const startedAt = recordingStartRef.current;
      if (!startedAt) return;
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, MAX_VIDEO_DURATION_MS - elapsedMs);
      setRecordingRemainingMs(remainingMs);
      if (remainingMs === 0 && !recordingStopRequestedRef.current) {
        recordingStopRequestedRef.current = true;
        if (isWeb) {
          webRecorderRef.current?.stop();
        } else {
          cameraRef.current?.stopRecording?.();
        }
      }
    }, 100);

    try {
      if (isWeb) {
        const previewElement = getWebCameraVideoElement(cameraContainerRef.current);
        const previewStream = previewElement?.srcObject;

        if (!(previewStream instanceof MediaStream)) {
          throw new Error('The browser camera stream is not ready yet.');
        }

        const videoTrack = previewStream
          .getVideoTracks()
          .find((track) => track.readyState === 'live');
        if (!videoTrack) {
          throw new Error('No live camera track is available for recording.');
        }

        const preferredMimeType = webRecorderMimeType;
        if (!preferredMimeType) {
          throw new Error('This browser cannot record an MP4 video for cross-device playback.');
        }

        // `previewStream` never carries a microphone track — see
        // `stopWebMicStream` — so one is requested independently here. A
        // denied or unavailable microphone still leaves a working, silent
        // recording rather than failing the capture outright.
        let micTrack: MediaStreamTrack | null = null;
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          webMicStreamRef.current = micStream;
          micTrack = micStream.getAudioTracks()[0] ?? null;
        } catch (micError) {
          console.warn('Microphone unavailable — recording video without audio.', micError);
        }

        // The front camera's preview is CSS-mirrored by `expo-camera`'s web
        // layer, but that is a display-only effect on the `<video>` element —
        // it never touches the underlying track, so `MediaRecorder` would
        // otherwise record the raw, un-mirrored feed and produce a video that
        // no longer matches what the guest watched themselves record. Baking
        // the same flip into the recorded track keeps the two in agreement,
        // the same way `mirror` on `CameraView` already keeps native's
        // preview and capture in agreement for both photo and video.
        let recordedVideoTrack: MediaStreamTrack;
        if (facing === 'front') {
          const mirrored = createMirroredVideoTrack(videoTrack);
          webMirroredVideoTrackRef.current = mirrored;
          recordedVideoTrack = mirrored.track;
        } else {
          recordedVideoTrack = videoTrack.clone();
        }

        const clonedTracks = [recordedVideoTrack, ...(micTrack ? [micTrack] : [])];
        const recordingStream = new MediaStream(clonedTracks);
        const recorder = preferredMimeType
          ? new MediaRecorder(recordingStream, { mimeType: preferredMimeType })
          : new MediaRecorder(recordingStream);

        webRecorderRef.current = recorder;

        const recording = await new Promise<VideoPreview>((resolve, reject) => {
          const chunks: Blob[] = [];

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          recorder.onerror = () => {
            clonedTracks.forEach((track) => track.stop());
            stopWebMicStream();
            stopWebMirroredVideoTrack();
            webRecorderRef.current = null;
            reject(new Error('The browser could not finish recording this video.'));
          };

          recorder.onstop = () => {
            try {
              clonedTracks.forEach((track) => track.stop());
              stopWebMicStream();
              stopWebMirroredVideoTrack();
              webRecorderRef.current = null;

              const mimeType = normaliseMimeType(
                recorder.mimeType || preferredMimeType || chunks[0]?.type || 'video/webm',
              ) || 'video/webm';
              const blob = new Blob(chunks, { type: mimeType });
              if (blob.size <= 0) {
                reject(new Error('The browser produced an empty video file.'));
                return;
              }

              const durationMs = Math.min(
                MAX_VIDEO_DURATION_MS,
                Math.max(100, Date.now() - (recordingStartRef.current ?? Date.now())),
              );

              resolve({
                uri: URL.createObjectURL(blob),
                mimeType: blob.type || mimeType,
                width: previewElement?.videoWidth ?? null,
                height: previewElement?.videoHeight ?? null,
                durationMs,
                source: 'camera',
                challengeId: isChallengeCapture ? String(challengeId) : null,
                guestbook: isGuestbookCapture,
              });
            } catch (error) {
              reject(
                error instanceof Error
                  ? error
                  : new Error('The browser could not prepare that video.'),
              );
            }
          };

          recorder.start(250);
        });

        setVideoPreview(recording);
        return;
      }

      const recording = await cameraRef.current.recordAsync({
        maxDuration: 30,
        codec: Platform.OS === 'ios' ? 'avc1' : undefined,
      });

      if (!recording?.uri) {
        throw new Error('The camera stopped without returning a video file.');
      }

      const localFile = new File(recording.uri);
      const fileInfo = localFile.info();
      if (!fileInfo.exists || !fileInfo.size || fileInfo.size <= 0) {
        throw new Error(`Camera returned an empty video file: ${recording.uri}`);
      }

      const durationMs = Math.min(
        MAX_VIDEO_DURATION_MS,
        Math.max(100, Date.now() - (recordingStartRef.current ?? Date.now())),
      );
      setVideoPreview({
        uri: recording.uri,
        mimeType: Platform.OS === 'ios' ? 'video/quicktime' : 'video/mp4',
        width: null,
        height: null,
        durationMs,
        source: 'camera',
        challengeId: isChallengeCapture ? String(challengeId) : null,
        guestbook: isGuestbookCapture,
      });
    } catch (error) {
      console.error('Failed to record video:', error);
      stopWebMicStream();
      stopWebMirroredVideoTrack();
      Alert.alert(
        'Recording failed',
        error instanceof Error ? error.message : 'We could not record that video. Please try again.',
      );
    } finally {
      clearRecordingTimer();
      recordingStartRef.current = null;
      recordingActiveRef.current = false;
      recordingStopRequestedRef.current = false;
      setIsRecording(false);
    }
  }

  function stopVideoRecording() {
    if (!recordingActiveRef.current || recordingStopRequestedRef.current) return;
    recordingStopRequestedRef.current = true;
    if (isWeb) {
      webRecorderRef.current?.stop();
      return;
    }
    cameraRef.current?.stopRecording?.();
  }

  /**
   * Audio has no camera to drive, so this only runs the clock and the flag —
   * flipping `isRecording` is what starts the `AudioCapture` below, and
   * clearing it is what stops it and produces the file.
   */
  function startAudioRecording() {
    if (recordingActiveRef.current) return;
    recordingActiveRef.current = true;
    recordingStopRequestedRef.current = false;
    setAudioLevels([]);
    setRecordingRemainingMs(MAX_AUDIO_DURATION_MS);
    setIsRecording(true);
    recordingStartRef.current = Date.now();
    clearRecordingTimer();
    recordingTimerRef.current = setInterval(() => {
      const startedAt = recordingStartRef.current;
      if (!startedAt) return;
      const remainingMs = Math.max(0, MAX_AUDIO_DURATION_MS - (Date.now() - startedAt));
      setRecordingRemainingMs(remainingMs);
      // The minute is up — stop for the guest rather than letting the
      // recording run past what the server will accept.
      if (remainingMs === 0) stopAudioRecording();
    }, 100);
  }

  const handleAudioRecorded = useCallback((result: AudioCaptureResult) => {
    setVideoPreview({
      kind: 'audio',
      uri: result.uri,
      mimeType: result.mimeType,
      // `recording` is the only source `create_guest_media_upload_intent`
      // accepts for audio — there is no library path to a voice message.
      source: 'recording',
      durationMs: Math.min(result.durationMs, MAX_AUDIO_DURATION_MS),
      guestbook: true,
    });
  }, []);

  const handleAudioError = useCallback((message: string) => {
    recordingActiveRef.current = false;
    setIsRecording(false);
    clearRecordingTimer();
    setAudioLevels([]);
    Alert.alert('Recording failed', message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAudioRecording() {
    if (!recordingActiveRef.current) return;
    recordingActiveRef.current = false;
    recordingStopRequestedRef.current = true;
    clearRecordingTimer();
    recordingStartRef.current = null;
    // `AudioCapture` sees this go false, stops, and reports the file through
    // `onComplete` — which is what opens the preview.
    setIsRecording(false);
  }

  async function retakeVideo() {
    if (!videoPreview || isUploading) return;
    const uri = videoPreview.uri;
    setVideoPreview(null);
    // `captureType` is untouched, so dropping the preview lands back in
    // whichever mode produced it — audio retakes return to audio.
    setAudioLevels([]);
    setRecordingRemainingMs(activeMaxDurationMs);
    deleteLocalVideo(uri, 'retake');
  }

  function deleteLocalVideo(uri: string, reason: 'retake' | 'posting') {
    try {
      if (Platform.OS === 'web') {
        releaseVideoPreviewUri(uri);
        return;
      }
      const file = new File(uri);
      if (file.info().exists) file.delete();
    } catch (error) {
      console.warn(`Could not remove temporary video after ${reason}:`, error);
    }
  }

  // Pinch-to-zoom on web. Native is handled by the `PanResponder` below; a
  // browser needs its own opt-out of the page-level pinch gesture, which is
  // what this attaches. The callbacks are memoised so the non-passive
  // listeners stay registered across renders rather than being torn down and
  // re-added on every zoom change — i.e. continuously, mid-pinch.
  const applyPinchZoom = useCallback((next: number) => setZoom(next), []);
  useViewfinderPinchZoom({
    containerRef: cameraContainerRef,
    // Audio mode has no camera, and the preview overlay covers the viewfinder.
    enabled: !isAudioCapture && !videoPreview && !challengePreviewUri,
    zoom,
    onZoomChange: applyPinchZoom,
    clamp: clampCameraZoom,
    sensitivity: PINCH_ZOOM_SENSITIVITY,
  });

  const viewfinderPanResponder = PanResponder.create({
    // `isWeb` guards below: pinch there is owned by
    // `useViewfinderPinchZoom`, which reads real DOM touches. Letting this
    // claim two-finger gestures as well would apply each pinch twice.
    onStartShouldSetPanResponderCapture: (event) =>
      !isWeb && !isAudioCapture && event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (event, gestureState) => {
      if (!isWeb && !isAudioCapture && event.nativeEvent.touches.length >= 2) return true;
      return (
        !isGuestbookCapture &&
        videoCaptureEnabled &&
        !isRecording &&
        Math.abs(gestureState.dx) > 16 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35
      );
    },
    onPanResponderGrant: (event) => {
      const distance = distanceBetweenTouches(event.nativeEvent.touches);
      if (distance === null) return;
      event.preventDefault?.();
      pinchStartDistanceRef.current = distance;
      pinchStartZoomRef.current = zoom;
    },
    onPanResponderMove: (event) => {
      const distance = distanceBetweenTouches(event.nativeEvent.touches);
      const startDistance = pinchStartDistanceRef.current;
      if (distance === null || !startDistance) return;

      event.preventDefault?.();
      const scale = distance / startDistance;
      const nextZoom = pinchStartZoomRef.current + Math.log(scale) * PINCH_ZOOM_SENSITIVITY;
      setZoom(clampCameraZoom(nextZoom));
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, gestureState) => {
      const wasPinching = pinchStartDistanceRef.current !== null;
      pinchStartDistanceRef.current = null;
      pinchStartZoomRef.current = zoom;
      if (wasPinching) return;

      if (isGuestbookCapture || !videoCaptureEnabled || isRecording) return;
      if (gestureState.dx <= -24) {
        setCaptureMode('video');
        return;
      }
      if (gestureState.dx >= 24) {
        setCaptureMode('photo');
      }
    },
    onPanResponderTerminate: () => {
      pinchStartDistanceRef.current = null;
      pinchStartZoomRef.current = zoom;
    },
  });

  async function handleCapture() {
    if (isAudioCapture) {
      if (isRecording) {
        stopAudioRecording();
        return;
      }
      if (videoPreview) return;
      startAudioRecording();
      return;
    }
    if (captureType === 'video' && supportsVideoRecording) {
      if (isRecording) {
        stopVideoRecording();
        return;
      }
      if (videoPreview || challengePreviewUri) {
        return;
      }
      await startVideoRecording();
      return;
    }
    if (isChallengeCapture && challengePreviewUri) {
      return;
    }
    if (outOfShots) {
      Alert.alert('Limit Reached', "You've reached the photo limit for this event.");
      return;
    }
    if (isUploading) return;

    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
          // Web-only option (native always shoots jpg regardless). Without
          // this, web silently defaults to png — a format canvas.toDataURL
          // ignores `quality` for entirely, so `quality: 0.85` above was a
          // no-op on every web capture even before the upload itself broke.
          imageType: 'jpg',
          // Also web-only, and for the same reason `imageType` needs stating
          // explicitly: expo-camera's web preview is always CSS-mirrored for
          // the front camera, but the canvas snapshot `takePictureAsync` reads
          // that preview from is not mirrored unless told to be. Left unset,
          // a selfie is saved flipped relative to what the guest just saw
          // themselves take. Native needs no such flag — the `mirror` prop on
          // `CameraView` below already keeps its preview and its capture in
          // agreement.
          ...(isWeb ? { isImageMirror: facing === 'front' } : null),
        });

        if (photo && photo.uri) {
          // Native shutter flash — fire-and-forget, independent of the
          // flying-thumbnail animation that follows.
          shutterFlashOpacity.setValue(0);
          Animated.sequence([
            Animated.timing(shutterFlashOpacity, {
              toValue: 0.7,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(shutterFlashOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();

          // `photo.format` is authoritative — always present, and avoids
          // guessing the MIME type from the URI, which is unreliable for a
          // web capture's data: URI (no file extension to read).
          const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
          if (isChallengeCapture) {
            setChallengePhotoSource('camera');
            setChallengePreviewUri(photo.uri);
          } else {
            setGalleryPhotoSource('camera');
            setGalleryPhotoMime(mimeType);
            setGalleryPhotoWidth(photo.width);
            setGalleryPhotoHeight(photo.height);
            setGalleryPreviewUri(photo.uri);
            setGalleryCaption('');
          }
        }
      } catch (e) {
        console.error('Failed to capture photo:', e);
        Alert.alert('Error', 'Failed to take photo. Please check permissions.');
      }
    }
  }

  async function handlePickFromLibrary() {
    if (outOfShots) {
      Alert.alert('Limit Reached', "You've reached the photo limit for this event.");
      return;
    }
    if (isUploading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo Access Required',
        'Allow access to your photo library to add a photo from your camera roll.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (isChallengeCapture) {
        setChallengePhotoSource('library');
        setChallengePreviewUri(asset.uri);
      } else {
        setGalleryPhotoSource('library');
        setGalleryPhotoMime(asset.mimeType || 'image/jpeg');
        setGalleryPhotoWidth(asset.width);
        setGalleryPhotoHeight(asset.height);
        setGalleryPreviewUri(asset.uri);
        setGalleryCaption('');
      }
    } catch (e) {
      console.error('Failed to pick photo from library:', e);
      Alert.alert('Error', 'Failed to add photo. Please try again.');
    }
  }

  async function handlePostChallengePreview() {
    if (!challengePreviewUri || isUploading) return;
    const posted = await commitChallengePhoto(challengePreviewUri, challengeCaption, challengePhotoSource);
    if (posted) {
      setChallengePreviewUri(null);
      setChallengeCaption('');
    }
  }

  async function handlePostGalleryPreview() {
    if (!galleryPreviewUri || isUploading) return;
    await commitPhoto(
      galleryPreviewUri,
      galleryPhotoSource,
      galleryPhotoMime,
      galleryPhotoWidth,
      galleryPhotoHeight,
      galleryCaption,
    );
    setGalleryPreviewUri(null);
    setGalleryCaption('');
  }



  // ── Derived Labels ──

  function getSubtitle() {
    if (countdown.isOngoing) return 'Live';
    if (countdown.isCompleted) return 'Event Ended';
    const { days, hours, minutes } = countdown;
    if (days >= 1) return `${days}d ${hours}h left`;
    if (hours >= 1) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }

  /**
   * Shown before recording starts, while the mode needs audio and we already
   * know the mic isn't available — `unknown` is deliberately silent here,
   * since that's just the permission check still in flight, not a problem.
   */
  function getMicPreflightWarning(): string | null {
    if (micStatus.permission === 'denied') {
      return 'Microphone access isn’t enabled. Your recording may not include sound.';
    }
    if (micStatus.permission === 'unavailable') {
      return 'No microphone detected. Your recording may not include sound.';
    }
    return null;
  }

  /** Compact enough to sit inside the recording pill alongside the countdown. */
  function getMicLiveLabel(): string | null {
    if (micStatus.permission === 'denied') return 'No sound';
    if (micStatus.permission === 'unavailable') return 'No mic';
    return null;
  }

  // `shot_limit_per_guest` caps guests, by name and by design — server-
  // computed from uploads that actually reached `ready`, so a failed or
  // abandoned upload never costs an allowance. It does not apply to a host
  // contributing to their own event, so `remainingPhotos` stays null for a
  // host: no counter renders, and nothing is ever "out of shots" for them.
  const shotsUsed = detail?.guestShotsUsed ?? 0;
  const remainingPhotos =
    isGuest && limit !== null && Boolean(detail) ? limit - shotsUsed : null;
  const outOfShots = remainingPhotos !== null && remainingPhotos <= 0;
  const latestPhotoUri = photos.length > 0 ? photos[0].uri : null;
  const latestPhotoId = photos.length > 0 ? photos[0].id ?? null : null;



  // ── Drum Roll Counter Animation Effect ──
  useEffect(() => {
    if (remainingPhotos !== null) {
      if (!hasAnimatedCounter.current) {
        hasAnimatedCounter.current = true;
        
        // Roll up from 0 to remainingPhotos
        const startValue = 0;
        setDisplayedCount(startValue);

        let current = startValue;
        const steps = remainingPhotos > 0 ? remainingPhotos : 1;
        const intervalTime = Math.max(20, Math.min(60, Math.floor(700 / steps))); // dynamic speed up to ~700ms total

        const runTick = () => {
          if (current < remainingPhotos) {
            current += 1;
            setDisplayedCount(current);
            
            if (current === remainingPhotos) {
              // Landed on final count: Medium impact haptic
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            } else {
              // Ticking up: Light selection/impact tick
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setTimeout(runTick, intervalTime);
            }
          }
        };

        // Delay starting the spin briefly so visual transitions look smooth
        setTimeout(runTick, 300);
      } else {
        // Direct value sync (e.g. after taking a photo)
        setDisplayedCount(remainingPhotos);
      }
    }
  }, [remainingPhotos]);

  // ── Render Helpers ──

  if (!hasNativeCamera || !CameraView) {
    return (
      <View style={S.permissionRoot}>
        <View style={S.permissionContent}>
          <AppText variant="displayMedium" align="center" style={{ color: '#FFFFFF', marginBottom: spacing.sm }}>
            Camera Module Unavailable
          </AppText>
          <AppText variant="bodyMedium" align="center" tone="secondary" style={{ marginBottom: spacing.xl }}>
            This build of the app does not contain the native camera module. Please rebuild the native app using:
            {"\n\n"}
            npx expo run:ios (or run:android)
          </AppText>
          <Pressable style={S.permissionBtn} onPress={() => router.back()}>
            <AppText style={S.permissionBtnText}>Go Back</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={S.loadingRoot}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={S.permissionRoot}>
        <View style={S.permissionContent}>
          <AppText variant="displayMedium" align="center" style={{ color: '#FFFFFF', marginBottom: spacing.sm }}>
            Camera Access Required
          </AppText>
          <AppText variant="bodyMedium" align="center" tone="secondary" style={{ marginBottom: spacing.xl }}>
            Stories. needs your camera to capture beautiful memories directly at the event.
          </AppText>
          <Pressable style={S.permissionBtn} onPress={requestPermission}>
            <AppText style={S.permissionBtnText}>Enable Camera</AppText>
          </Pressable>
          <Pressable style={{ marginTop: spacing.lg }} onPress={() => router.back()}>
            <AppText tone="secondary" style={{ textDecorationLine: 'underline' }}>Go Back</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={S.root}>
      {/* 1. Header Bar */}
      <View
        style={[
          S.header,
          {
            height: insets.top + headerHeight,
            // The safe-area inset is cleared in full before the gap is added,
            // so the title starts below the notch/island on every screen size.
            paddingTop: insets.top + HEADER_TOP_GAP,
          },
        ]}
      >
        <Pressable 
          onPress={() => router.back()} 
          style={S.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <CloseChevron />
        </Pressable>

        <View style={S.headerTitleGroup}>
          <AppText style={S.headerTitle} numberOfLines={1}>
            {isGuestbookCapture ? 'Guestbook' : celebration?.title ?? 'Event'}
          </AppText>
          <AppText style={S.headerSubtitle}>
            {isGuestbookCapture
              ? (isAudioCapture ? 'Audio message' : 'Video message')
              : getSubtitle()}
          </AppText>
        </View>

        {/* Symmetrical placeholder for centering the title */}
        <View style={{ width: 38 }} />
      </View>

      {/* Headless. Mounted only in audio mode so the microphone is never held
          open while the guest is shooting video. */}
      {isAudioCapture ? (
        <AudioCapture
          recording={isRecording}
          onLevel={pushAudioLevel}
          onComplete={handleAudioRecorded}
          onError={handleAudioError}
        />
      ) : null}

      {/* 2. Full-Screen Camera View Container */}
      <View
        ref={cameraContainerRef}
        style={[
          S.viewfinderContainer,
          isWeb && !isAudioCapture && S.webViewfinderGestureLock,
          { height: viewfinderHeight },
        ]}
        {...viewfinderPanResponder.panHandlers}
      >
        {isAudioCapture ? (
          // No camera in audio mode. The waveform takes the viewfinder's whole
          // area so the screen keeps the same shape as video — same header,
          // same frame, same shutter — and only the medium changes.
          <View style={S.audioStage}>
            <AudioWaveform
              levels={audioLevels}
              height={140}
              activeColor={isRecording ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)'}
            />
            <AppText style={S.audioStageHint}>
              {isRecording
                ? (getMicLiveLabel() ?? 'Listening…')
                : (getMicPreflightWarning() ?? 'Tap the button to start recording')}
            </AppText>
          </View>
        ) : (
        <CameraView
          // Flipping on web has to tear the old stream down before the new one
          // is requested. The library only ever gives Chrome a SOFT
          // `facingMode: { ideal: … }` constraint (its `exact` branch is
          // WebKit-only), and while a camera is still open the browser is free
          // to ignore that and return the same device — which `compareStreams`
          // then discards as "unchanged", so the flip did nothing at all.
          // Remounting runs the library's unmount cleanup, which stops every
          // open track, so the next `getUserMedia` starts from no live camera
          // and honours the facing that was asked for.
          key={isWeb ? facing : undefined}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          // Held CONSTANT on web on purpose: any change to these three makes
          // the library's settings effect fire, and it applies each changed
          // key on its own via `applyConstraints`, which replaces the track's
          // whole constraint set — wiping whatever `useWebCameraTrack` last
          // applied. Native still drives flash and zoom through these props.
          flash={isWeb ? 'off' : flash}
          mirror={facing === 'front'}
          mode={captureType === 'video' ? 'video' : 'picture'}
          mute={false}
          enableTorch={false}
          zoom={isWeb ? 0 : zoom}
          onMountError={handleCameraMountError}
          // A camera that starts successfully ends any recovery in progress,
          // so a later, unrelated failure gets its own revert attempt.
          onCameraReady={() => {
            isRecoveringFacing.current = false;
          }}
        />
        )}

        {/* Shutter Animation Overlay */}
        <Animated.View 
          style={[StyleSheet.absoluteFill, S.shutterFlash, { opacity: shutterFlashOpacity }]} 
          pointerEvents="none" 
        />

        {/* Remaining Photos Limit Tag */}
        {!isGuestbookCapture && remainingPhotos !== null && (
          <View style={S.photosLeftTag}>
            <AppText style={S.photosLeftCount}>
              {displayedCount !== null ? displayedCount : remainingPhotos}
            </AppText>
          </View>
        )}

        {isRecording ? (
          <View style={S.recordingPill}>
            <View style={S.recordingDot} />
            <AppText style={S.recordingText}>{formatCountdown(recordingRemainingMs)}</AppText>
            {/* Audio mode already carries this in its own hint + waveform;
                video has nothing else, so it gets its own small tell here. */}
            {!isAudioCapture ? (
              getMicLiveLabel() ? (
                <AppText style={S.micWarningText}>{getMicLiveLabel()}</AppText>
              ) : (
                <View
                  style={[
                    S.micLiveDot,
                    micStatus.isLive && {
                      opacity: 0.5 + Math.min(1, micStatus.level) * 0.5,
                      transform: [{ scale: 1 + Math.min(1, micStatus.level) * 0.35 }],
                    },
                  ]}
                />
              )
            ) : null}
          </View>
        ) : !isAudioCapture && captureType === 'video' && supportsVideoRecording && getMicPreflightWarning() ? (
          <View style={S.micPreflightPill}>
            <AppText style={S.micPreflightText}>{getMicPreflightWarning()}</AppText>
          </View>
        ) : null}

        {/* Camera-roll action — mirrors the shots-left tag on the opposite
            corner. Visible only when capture_mode allows a library source;
            no separate toggle, this reads the same setting the shots-left
            count and the shutter's own capture_mode gate already use. */}
        {showPhotoLibraryAction && (
          <Animated.View
            style={[
              S.cameraRollTagWrap,
              {
                opacity: captureModeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [{
                  translateY: captureModeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8],
                  }),
                }],
              },
            ]}
          >
            <Pressable
              onPress={handlePickFromLibrary}
              disabled={outOfShots || isUploading}
              style={[S.cameraRollTag, (outOfShots || isUploading) && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Add photo from camera roll"
            >
              <CameraRollPlusIcon size={20} />
            </Pressable>
          </Animated.View>
        )}

        {/* Zoom Selector Controls */}
        {/* `zoomContainer` spans the full viewfinder width (`left: 0, right:
            0`) to centre its pill child, but that leaves its own invisible
            hit-testable bounds covering the corners too — silently
            swallowing taps on the camera-roll button underneath, at the same
            zIndex but earlier in this file's paint order. `box-none` makes
            only the pill itself (and its buttons) touchable, not the empty
            width around it. */}
        {/* Nothing to zoom without a lens. */}
        <View
          style={[S.zoomContainer, isAudioCapture && { display: 'none' }]}
          pointerEvents="box-none"
        >
          <View style={S.zoomPill}>
            {ZOOM_OPTIONS.map((opt) => {
              const active = nearestZoomOptionValue(zoom) === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  style={[S.zoomOption, active && S.zoomOptionActive]}
                  onPress={() => setZoom(clampCameraZoom(opt.value))}
                >
                  <AppText style={[S.zoomOptionText, active && S.zoomOptionTextActive]}>
                    {opt.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {videoPreview ? (
        <View style={[StyleSheet.absoluteFill, S.challengePreviewOverlay]}>
          {videoPreview.kind === 'audio' ? (
            <AudioWaveformPlayer
              uri={videoPreview.uri}
              durationMs={videoPreview.durationMs}
              height={150}
            />
          ) : (
            <>
              <InlineVideoPreview uri={videoPreview.uri} />
              <View style={S.challengePreviewScrim} pointerEvents="none" />
            </>
          )}
          <View style={[S.challengePreviewTopActions, { top: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => void retakeVideo()}
              disabled={isUploading}
              style={({ pressed }) => [S.challengePreviewCloseBtn, pressed && { opacity: 0.86 }]}
              accessibilityRole="button"
              accessibilityLabel={
                videoPreview.kind === 'audio'
                  ? 'Discard recording and retake'
                  : 'Discard video and retake'
              }
            >
              <CloseChevron size={18} />
            </Pressable>
          </View>
          <View style={[S.challengePreviewActions, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md }]}>
            {Boolean(videoPreview.challengeId) && (
              <View style={S.captionInputContainer}>
                <View style={S.captionInputBox}>
                  <TextInput
                    style={S.captionTextInput}
                    value={challengeCaption}
                    onChangeText={setChallengeCaption}
                    placeholder="Add an optional caption..."
                    placeholderTextColor="rgba(255, 255, 255, 0.45)"
                    maxLength={MAX_CAPTION_LENGTH}
                    multiline={false}
                    returnKeyType="done"
                  />
                  <AppText style={S.captionCounterText}>
                    {MAX_CAPTION_LENGTH - challengeCaption.length}
                  </AppText>
                </View>
              </View>
            )}
            <Pressable
              onPress={() => void commitVideo(videoPreview, challengeCaption)}
              disabled={isUploading}
              style={({ pressed }) => [
                S.challengePreviewPrimaryBtn,
                pressed && { opacity: 0.92 },
                isUploading && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Post video"
            >
              <AppText style={S.challengePreviewPrimaryText}>
                {isUploading ? 'Posting…' : 'Post'}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : isChallengeCapture && challengePreviewUri ? (
        <View style={[StyleSheet.absoluteFill, S.challengePreviewOverlay]}>
          <Image source={{ uri: challengePreviewUri }} style={S.challengePreviewImage} resizeMode="cover" />
          <View style={S.challengePreviewScrim} />
          <View style={[S.challengePreviewTopActions, { top: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => {
                setChallengePreviewUri(null);
                setChallengeCaption('');
              }}
              disabled={isUploading}
              style={({ pressed }) => [S.challengePreviewCloseBtn, pressed && { opacity: 0.86 }]}
              accessibilityRole="button"
              accessibilityLabel="Discard photo and retake"
            >
              <CloseChevron size={18} />
            </Pressable>
          </View>
          <View style={[S.challengePreviewActions, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md }]}>
            <View style={S.captionInputContainer}>
              <View style={S.captionInputBox}>
                <TextInput
                  style={S.captionTextInput}
                  value={challengeCaption}
                  onChangeText={setChallengeCaption}
                  placeholder="Add an optional caption..."
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  maxLength={MAX_CAPTION_LENGTH}
                  multiline={false}
                  returnKeyType="done"
                />
                <AppText style={S.captionCounterText}>
                  {MAX_CAPTION_LENGTH - challengeCaption.length}
                </AppText>
              </View>
            </View>
            <Pressable
              onPress={() => void handlePostChallengePreview()}
              disabled={isUploading}
              style={({ pressed }) => [
                S.challengePreviewPrimaryBtn,
                pressed && { opacity: 0.92 },
                isUploading && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Post photo"
            >
              <AppText style={S.challengePreviewPrimaryText}>
                {isUploading ? 'Posting…' : 'Post'}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : galleryPreviewUri ? (
        <View style={[StyleSheet.absoluteFill, S.challengePreviewOverlay]}>
          <Image source={{ uri: galleryPreviewUri }} style={S.challengePreviewImage} resizeMode="cover" />
          <View style={S.challengePreviewScrim} />
          <View style={[S.challengePreviewTopActions, { top: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => {
                const source = galleryPhotoSource;
                setGalleryPreviewUri(null);
                setGalleryCaption('');
                if (source === 'library') {
                  void handlePickFromLibrary();
                }
              }}
              disabled={isUploading}
              style={({ pressed }) => [S.challengePreviewCloseBtn, pressed && { opacity: 0.86 }]}
              accessibilityRole="button"
              accessibilityLabel="Discard photo and retake"
            >
              <CloseChevron size={18} />
            </Pressable>
          </View>
          <View style={[S.challengePreviewActions, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md }]}>
            <View style={S.captionInputContainer}>
              <View style={S.captionInputBox}>
                <TextInput
                  style={S.captionTextInput}
                  value={galleryCaption}
                  onChangeText={setGalleryCaption}
                  placeholder="Add an optional caption..."
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  maxLength={MAX_CAPTION_LENGTH}
                  multiline={false}
                  returnKeyType="done"
                />
                <AppText style={S.captionCounterText}>
                  {MAX_CAPTION_LENGTH - galleryCaption.length}
                </AppText>
              </View>
            </View>
            <Pressable
              onPress={() => void handlePostGalleryPreview()}
              disabled={isUploading}
              style={({ pressed }) => [
                S.challengePreviewPrimaryBtn,
                pressed && { opacity: 0.92 },
                isUploading && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Post photo"
            >
              <AppText style={S.challengePreviewPrimaryText}>
                {isUploading ? 'Posting…' : 'Post'}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 3. Bottom Controls Panel */}
      <View style={[S.bottomPanel, { minHeight: bottomPanelHeight + insets.bottom, paddingBottom: insets.bottom }]}>
        <View style={S.bottomControlsRow}>
          {/* Flash Button — web only has an on/off torch, not the native
              off/on/auto strobe, so the icon reflects whichever state this
              platform actually has.

              A torch belongs to one physical camera rather than to the
              device: most front cameras have none, and a browser cannot
              light one that does not exist. Where there is nothing to switch
              on, the control is left out instead of sitting there dead. The
              placeholder keeps the shutter centred in the row. */}
          {/* Flash and flip are camera controls with nothing to act on in
              audio mode. Both leave a same-sized spacer so the shutter stays
              centred and does not shift as the mode changes. */}
          {isAudioCapture || !showFlashControl ? (
            <View style={S.controlBtn} />
          ) : (
            <Pressable
              onPress={toggleFlash}
              style={S.controlBtn}
              accessibilityRole="button"
              accessibilityLabel="Toggle flash"
            >
              <FlashIcon mode={isWeb ? (torchOn ? 'on' : 'off') : flash} />
            </Pressable>
          )}

          {/* Flip Camera Button */}
          {isAudioCapture ? (
            <View style={S.controlBtn} />
          ) : (
            <Pressable
              onPress={toggleFacing}
              style={[S.controlBtn, isRecording && { opacity: 0.35 }]}
              disabled={isRecording}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <FlipIcon />
            </Pressable>
          )}

          <Pressable
            onPress={handleCapture}
            // Guestbook messages do not draw on the guest's photo allowance,
            // so a guest who has used every shot can still leave one.
            disabled={(outOfShots && !isGuestbookCapture) || isUploading}
            style={({ pressed }) => [
              S.shutterBtn,
              captureType !== 'photo' && S.shutterBtnVideoMode,
              isRecording && S.shutterBtnRecording,
              pressed && { opacity: 0.8 },
              ((outOfShots && !isGuestbookCapture) || isUploading) && { opacity: 0.4 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              captureType === 'photo'
                ? 'Take photo'
                : isRecording
                  ? `Stop ${captureType} recording`
                  : `Start ${captureType} recording`
            }
          >
            <View
              style={[
                S.shutterBtnInner,
                captureType !== 'photo' && S.shutterBtnInnerVideoMode,
                isRecording && S.shutterBtnInnerRecording,
              ]}
            />
          </Pressable>

          {/* QR Invite Button — hidden for the Guestbook, which is not an
              invite surface. A same-sized spacer keeps the shutter centred. */}
          {isGuestbookCapture ? (
            <View style={S.controlBtnSpacer} />
          ) : (
            <Pressable
              onPress={() => setShareVisible(true)}
              style={S.controlBtn}
              accessibilityRole="button"
              accessibilityLabel="Invite guests"
            >
              <QrCodeIcon size={24} color="#FFFFFF" />
            </Pressable>
          )}

          {/* Photos Button — hidden for the Guestbook; it has no event
              gallery preview of its own. */}
          {isGuestbookCapture ? (
            <View style={S.controlBtnSpacer} />
          ) : (
          <Pressable
            onPress={() => {
              // This screen is a `transparentModal` sitting on top of the
              // gallery, which is still mounted underneath it.
              //
              // `replace` was the wrong verb for that shape: it swaps *this
              // modal's own stack entry* for the gallery route, so the gallery
              // ends up rendered inside a modal slot whose `contentStyle` is
              // `backgroundColor: 'transparent'`, with nothing left behind it.
              // On web that reads as a blank white page. Every other exit from
              // this screen uses `back()`, which is why only this button broke.
              //
              // `dismissTo` pops back to the gallery already in the stack and
              // applies the params on the way, so the modal is torn down
              // properly and the newly uploaded photo opens over a real screen.
              const target = {
                pathname: '/celebration/[celebrationId]',
                params: {
                  celebrationId: String(celebrationId),
                  ...(latestPhotoId ? { openPhotoId: latestPhotoId } : {}),
                },
              };

              // Nothing to dismiss to when the camera was deep-linked into
              // directly and is the only entry in the stack. `replace` is
              // correct there: there is no underlying screen to preserve.
              if (router.canDismiss()) {
                router.dismissTo(target as never);
                return;
              }
              router.replace(target as never);
            }}
            style={S.photosBtn}
            accessibilityRole="button"
            accessibilityLabel="Open gallery"
          >
            {latestPhotoUri ? (
              <Image source={{ uri: latestPhotoUri }} style={S.photosBtnThumb} />
            ) : (
              <View style={S.photosBtnPlaceholder}>
                <View style={S.photosBtnPlaceholderDot} />
              </View>
            )}
          </Pressable>
          )}
        </View>

        {/* The Guestbook swaps the left mode for audio; every other target
            keeps photo/video, and only when the event allows video at all. */}
        {isGuestbookCapture || videoCaptureEnabled ? (
          <View style={S.captureModeRail}>
            <View style={S.captureModeLabelRow}>
              <Animated.View
                style={[
                  S.captureModeSelection,
                  {
                    transform: [{
                      translateX: captureModeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 74],
                      }),
                    }],
                  },
                ]}
              />
              {(isGuestbookCapture
                ? ([
                    { key: 'audio', label: 'AUDIO' },
                    { key: 'video', label: 'VIDEO' },
                  ] as const)
                : ([
                    { key: 'photo', label: 'PHOTO' },
                    { key: 'video', label: 'VIDEO' },
                  ] as const)
              ).map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setCaptureMode(option.key)}
                  disabled={isRecording}
                  style={S.captureModeTapTarget}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${option.label.toLowerCase()} mode`}
                >
                  <AppText
                    style={[
                      S.captureModeLabel,
                      captureType === option.key && S.captureModeLabelActive,
                      isRecording && { opacity: 0.45 },
                    ]}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* 4. Flying Image Animation layer */}
      {flyingThumbnailUri && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.Image
            source={{ uri: flyingThumbnailUri }}
            style={[
              S.flyingThumbnail,
              {
                left: startCenterX - 100,
                top: startCenterY - 177,
                transform: [
                  { translateX: flyingAnim.x },
                  { translateY: flyingAnim.y },
                  { scale: flyingScale },
                ],
                opacity: flyingOpacity,
              },
            ]}
          />
        </View>
      )}

      {/* 5. Invite Modal */}
      {celebration && (
        <InviteShareSheet
          visible={shareVisible}
          eventName={celebration.title}
          eventCode={celebration.event_code}
          bottomInset={insets.bottom}
          onClose={() => setShareVisible(false)}
        />
      )}
    </View>
  );
}

  const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionRoot: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
  },
  permissionContent: {
    alignItems: 'center',
  },
  permissionBtn: {
    backgroundColor: '#EFE9E0',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: {
    color: '#0B0B0C',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    backgroundColor: '#0B0B0C',
    zIndex: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  headerTitle: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: HEADER_TITLE_SIZE,
    // Explicit, because the inherited `body` leading of 22 is shorter than
    // this font size and was cropping the ascenders.
    lineHeight: HEADER_TITLE_LEADING,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: HEADER_SUBTITLE_SIZE,
    lineHeight: HEADER_SUBTITLE_LEADING,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginTop: HEADER_SUBTITLE_GAP,
  },

  // ── Viewfinder ──
  viewfinderContainer: {
    marginHorizontal: 12,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  webViewfinderGestureLock: {
    touchAction: 'none',
    overscrollBehavior: 'contain',
  } as any,
  /** Fills the viewfinder in audio mode, where there is no camera to show. */
  audioStage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  audioStageHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 14,
  },
  shutterFlash: {
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },

  // Photos Left Pill
  photosLeftTag: {
    position: 'absolute',
    bottom: PILL_INSET,
    left: PILL_INSET,
    backgroundColor: 'rgba(11, 11, 12, 0.65)',
    // Height, radius and padding all come from the same constants as the zoom
    // pill, so the two read as one family. It was a 48px circle against the
    // pill's 36px, which sat 12px proud of it on the shared bottom edge.
    height: PILL_HEIGHT,
    minWidth: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    paddingHorizontal: PILL_PADDING + 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  photosLeftCount: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: COUNTER_SIZE,
    // Same fix as the header: the inherited leading of 22 was shorter than the
    // old 26px size, so the digits were cropped top and bottom and could not
    // sit on the container's centre line. This leading fits inside PILL_HEIGHT.
    lineHeight: COUNTER_LEADING,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  recordingPill: {
    position: 'absolute',
    top: PILL_INSET,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(11, 11, 12, 0.78)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: PILL_HEIGHT,
    zIndex: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FF453A',
  },
  recordingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Mic status, folded into the recording pill rather than a second pill —
  // one small tell next to the countdown, not a second thing competing for
  // attention while someone is mid-recording.
  micLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#34C759',
    marginLeft: 2,
  },
  micWarningText: {
    color: '#FFD60A',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  micPreflightPill: {
    position: 'absolute',
    top: PILL_INSET,
    left: PILL_INSET,
    right: PILL_INSET,
    alignSelf: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.78)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    zIndex: 20,
  },
  micPreflightText: {
    color: '#FFD60A',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineVideoPreviewWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inlineVideoPreviewVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  // Camera-Roll Pill — same family as photosLeftTag, opposite corner.
  cameraRollTagWrap: {
    position: 'absolute',
    bottom: PILL_INSET,
    right: PILL_INSET,
    zIndex: 20,
  },
  cameraRollTag: {
    backgroundColor: 'rgba(11, 11, 12, 0.65)',
    height: PILL_HEIGHT,
    width: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },

  challengePreviewOverlay: {
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
    zIndex: 120,
  },
  challengePreviewImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  challengePreviewScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11, 11, 12, 0.18)',
  },
  challengePreviewActions: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  challengePreviewTopActions: {
    position: 'absolute',
    top: 0,
    right: layout.gutter,
    zIndex: 2,
  },
  challengePreviewCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  challengePreviewPrimaryBtn: {
    height: 54,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE9E0',
  },
  challengePreviewPrimaryText: {
    color: '#0B0B0C',
    fontWeight: '700',
    fontSize: 16,
  },

  // Zoom Selector Pill
  zoomContainer: {
    position: 'absolute',
    bottom: PILL_INSET,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  zoomPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 11, 12, 0.6)',
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    padding: PILL_PADDING,
    gap: 4,
    alignItems: 'center',
  },
  zoomOption: {
    width: 38,
    height: PILL_INNER_HEIGHT,
    borderRadius: PILL_INNER_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomOptionActive: {
    backgroundColor: '#FFFFFF',
  },
  zoomOptionText: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 12,
    color: '#FFFFFF',
  },
  zoomOptionTextActive: {
    color: '#0B0B0C',
  },

  // ── Bottom Panel ──
  bottomPanel: {
    backgroundColor: '#0B0B0C',
    justifyContent: 'flex-end',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureModeRail: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  captureModeLabelRow: {
    position: 'relative',
    width: 148,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureModeSelection: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 74,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  captureModeTapTarget: {
    width: 74,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureModeLabel: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.58)',
  },
  captureModeLabelActive: {
    color: '#FFFFFF',
  },
  bottomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnSpacer: {
    width: 44,
    height: 44,
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterBtnVideoMode: {
    borderColor: 'rgba(255, 255, 255, 0.92)',
  },
  shutterBtnRecording: {
    borderColor: 'rgba(255, 59, 48, 0.72)',
  },
  shutterBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  shutterBtnInnerVideoMode: {
    backgroundColor: '#FF453A',
  },
  shutterBtnInnerRecording: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FF453A',
  },
  photosBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  photosBtnThumb: {
    width: '100%',
    height: '100%',
  },
  photosBtnPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photosBtnPlaceholderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },

  // ── Flying Thumbnail ──
  flyingThumbnail: {
    position: 'absolute',
    width: 200,
    height: 355,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 999,
  },

  // Flash Auto Badge
  flashAutoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -4,
    backgroundColor: '#0B0B0C',
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  flashAutoText: {
    fontSize: 7,
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // ── Modal / Share Sheet ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,5,6,0.88)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#09090A',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: 24,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  inviteHeader: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  inviteTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 34,
    marginBottom: 2,
  },
  inviteSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  inviteCodeRow: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  inviteCodeTitleWrap: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inviteCodeDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteCodeDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  inviteCodeActionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: 0,
  },
  inviteCodeLabel: {
    color: 'rgba(255,255,255,0.56)',
    textAlign: 'center',
    letterSpacing: 3,
  },
  inviteCodeValue: {
    flexShrink: 1,
    color: '#F1E7DA',
    textAlign: 'left',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 5,
  },
  inviteLinkValue: {
    flex: 1,
    color: '#F1E7DA',
    textAlign: 'left',
    fontSize: 14,
    lineHeight: 20,
  },
  inviteCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  inviteCopyLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sheetBtnPrimary: {
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnSecondary: {
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  captionInputContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: spacing.md,
  },
  captionInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.76)',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  captionTextInput: {
    flex: 1,
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 15,
    color: '#FFFFFF',
    padding: 0,
  },
  captionCounterText: {
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 8,
  },
});
