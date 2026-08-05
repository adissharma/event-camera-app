import { useState, useEffect, useRef } from 'react';
import {
  Animated,
  ActivityIndicator,
  View,
  Image,
  useWindowDimensions,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
  Share,
  NativeModules,
  Linking,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
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
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { useAuth } from '@/features/auth/context';
import { AppText } from '@/components/ui/text';
import { QrCodeIcon, CloseIcon } from '@/components/ui/icons';
import { BRAND_CONFIG } from '@/config/brand';
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
import type { MediaSource } from '@/types/database';

interface PhotoItem {
  uri: string;
  takenBy: string;
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
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
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

  // ── Upload pipeline ──
  //
  // `capture_mode` is the source of truth for whether the camera-roll action
  // shows at all — no separate toggle, no client-side flag. It applies to both
  // hosts and guests, so the setting controls what actions are available to both.
  const isGuest = detail?.viewerRole === 'guest';
  const captureMode = primarySession?.capture_mode ?? 'camera_and_library';
  const showCameraRollAction = captureMode !== 'camera_only';
  const [guestAuth, setGuestAuth] = useState<{ slug: string; guestToken: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isGuest || !celebrationId) return;
    let cancelled = false;
    (async () => {
      const found = await loadStoredGuestSessionByCelebrationId(String(celebrationId));
      if (!cancelled && found) {
        setGuestAuth({ slug: found.slug, guestToken: found.session.guestToken });
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
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  // Real per-shot flash strobe (off/on/auto), meaningful only on native — see
  // `toggleFlash` for why web drives a completely different prop.
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  // Continuous "torch" light, the only flash-adjacent capability a browser's
  // camera API exposes. Web-only state; native never reads it.
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [shareVisible, setShareVisible] = useState(false);

  // On web the torch and zoom are driven straight onto the live MediaStream
  // track rather than through `CameraView`'s props — see `web-camera-track`
  // for why the library cannot do it. `capabilities` describes the camera
  // that is open RIGHT NOW, so it changes when the camera is flipped.
  const { containerRef: cameraContainerRef, capabilities: webCamera } = useWebCameraTrack({
    facing,
    torchOn,
    zoom,
  });

  /** Web only shows a flash control when the open camera really has a torch. */
  const showFlashControl = !isWeb || webCamera.torch;

  /** Guards `handleCameraMountError` against reverting `facing` in a loop. */
  const isRecoveringFacing = useRef(false);

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
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
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

    const userName = firstNameFrom(profile) || 'You';
    const newPhoto: PhotoItem = { uri, takenBy: userName };
    const next = [newPhoto, ...photos];
    setPhotos(next);

    if (!isBackendConfigured) {
      await AsyncStorage.setItem(`__mock_photos_${celebrationId}`, JSON.stringify(next));
    } else {
      setIsUploading(true);
      try {
        if (isGuest && guestAuth) {
          await uploadGuestPhoto({
            eventCode: guestAuth.slug,
            guestToken: guestAuth.guestToken,
            localUri: uri,
            source,
            mimeType,
            width,
            height,
          });
        } else if (!isGuest && celebrationId) {
          await uploadHostPhoto({
            celebrationId: String(celebrationId),
            localUri: uri,
            source,
            mimeType,
            width,
            height,
          });
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
      } catch (e) {
        console.error(`Failed to upload ${source} photo:`, e);
        Alert.alert('Upload failed', 'Your photo could not be uploaded. Please try again.');
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

  async function handleCapture() {
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
          await commitPhoto(photo.uri, 'camera', mimeType, photo.width, photo.height);
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
      await commitPhoto(asset.uri, 'library', asset.mimeType, asset.width, asset.height);
    } catch (e) {
      console.error('Failed to pick photo from library:', e);
      Alert.alert('Error', 'Failed to add photo. Please try again.');
    }
  }

  async function handleShareLink() {
    // `event_code` (short, meant to be spoken or typed) is what the guest
    // join screen and `get_event_preview_by_code` look up by. `public_slug`
    // is a different, deliberately unguessable column meant for opaque URLs
    // — sharing it here as "the code" meant no code a host gave out could
    // actually join the event.
    if (!celebration || !celebration.event_code) return;
    try {
      await Share.share({
        message: `Join "${celebration.title}" on Candidly → ${BRAND_CONFIG.guestDomain}/e/${celebration.event_code}`,
      });
    } catch {}
  }

  async function handleCopyCode() {
    if (!celebration || !celebration.event_code) return;
    await Clipboard.setStringAsync(celebration.event_code);
    Alert.alert('Copied', 'Event code copied to clipboard.');
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
            Candidly needs your camera to capture beautiful memories directly at the event.
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
            {celebration?.title ?? 'Event'}
          </AppText>
          <AppText style={S.headerSubtitle}>
            {getSubtitle()}
          </AppText>
        </View>

        {/* Symmetrical placeholder for centering the title */}
        <View style={{ width: 38 }} />
      </View>

      {/* 2. Full-Screen Camera View Container */}
      <View ref={cameraContainerRef} style={[S.viewfinderContainer, { height: viewfinderHeight }]}>
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
          enableTorch={false}
          zoom={isWeb ? 0 : zoom}
          onMountError={handleCameraMountError}
          // A camera that starts successfully ends any recovery in progress,
          // so a later, unrelated failure gets its own revert attempt.
          onCameraReady={() => {
            isRecoveringFacing.current = false;
          }}
        />

        {/* Shutter Animation Overlay */}
        <Animated.View 
          style={[StyleSheet.absoluteFill, S.shutterFlash, { opacity: shutterFlashOpacity }]} 
          pointerEvents="none" 
        />

        {/* Remaining Photos Limit Tag */}
        {remainingPhotos !== null && (
          <View style={S.photosLeftTag}>
            <AppText style={S.photosLeftCount}>
              {displayedCount !== null ? displayedCount : remainingPhotos}
            </AppText>
          </View>
        )}

        {/* Camera-roll action — mirrors the shots-left tag on the opposite
            corner. Visible only when capture_mode allows a library source;
            no separate toggle, this reads the same setting the shots-left
            count and the shutter's own capture_mode gate already use. */}
        {showCameraRollAction && (
          <Pressable
            onPress={handlePickFromLibrary}
            disabled={outOfShots || isUploading}
            style={[S.cameraRollTag, (outOfShots || isUploading) && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Add photo from camera roll"
          >
            <CameraRollPlusIcon size={20} />
          </Pressable>
        )}

        {/* Zoom Selector Controls */}
        {/* `zoomContainer` spans the full viewfinder width (`left: 0, right:
            0`) to centre its pill child, but that leaves its own invisible
            hit-testable bounds covering the corners too — silently
            swallowing taps on the camera-roll button underneath, at the same
            zIndex but earlier in this file's paint order. `box-none` makes
            only the pill itself (and its buttons) touchable, not the empty
            width around it. */}
        <View style={S.zoomContainer} pointerEvents="box-none">
          <View style={S.zoomPill}>
            {[
              { label: '0.5', value: MIN_ZOOM },
              { label: '1x', value: 0.15 },
              { label: '2.5', value: 0.45 },
            ].map((opt) => {
              const active = zoom === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  style={[S.zoomOption, active && S.zoomOptionActive]}
                  onPress={() => setZoom(opt.value)}
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

      {/* 3. Bottom Controls Panel */}
      <View style={[S.bottomPanel, { height: bottomPanelHeight + insets.bottom, paddingBottom: insets.bottom }]}>
        <View style={S.bottomControlsRow}>
          {/* Flash Button — web only has an on/off torch, not the native
              off/on/auto strobe, so the icon reflects whichever state this
              platform actually has.

              A torch belongs to one physical camera rather than to the
              device: most front cameras have none, and a browser cannot
              light one that does not exist. Where there is nothing to switch
              on, the control is left out instead of sitting there dead. The
              placeholder keeps the shutter centred in the row. */}
          {showFlashControl ? (
            <Pressable
              onPress={toggleFlash}
              style={S.controlBtn}
              accessibilityRole="button"
              accessibilityLabel="Toggle flash"
            >
              <FlashIcon mode={isWeb ? (torchOn ? 'on' : 'off') : flash} />
            </Pressable>
          ) : (
            <View style={S.controlBtn} />
          )}

          {/* Flip Camera Button */}
          <Pressable 
            onPress={toggleFacing} 
            style={S.controlBtn}
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
          >
            <FlipIcon />
          </Pressable>

          {/* Shutter Button */}
          <Pressable
            onPress={handleCapture}
            disabled={outOfShots || isUploading}
            style={({ pressed }) => [
              S.shutterBtn,
              pressed && { opacity: 0.8 },
              (outOfShots || isUploading) && { opacity: 0.4 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <View style={S.shutterBtnInner} />
          </Pressable>

          {/* QR Invite Button */}
          <Pressable 
            onPress={() => setShareVisible(true)} 
            style={S.controlBtn}
            accessibilityRole="button"
            accessibilityLabel="Invite guests"
          >
            <QrCodeIcon size={24} color="#FFFFFF" />
          </Pressable>

          {/* Photos Button */}
          <Pressable 
            onPress={() => router.replace(`/celebration/${celebrationId}`)}
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
        </View>
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
        <Modal
          visible={shareVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setShareVisible(false)}
        >
          <View style={S.modalOverlay}>
            <View style={[S.modalSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
              <View style={S.sheetHandle} />

              <AppText variant="titleLarge" style={{ textAlign: 'center', marginTop: spacing.xs, color: '#FFFFFF' }}>
                Invite Guests
              </AppText>
              <AppText variant="bodySmall" tone="secondary" align="center">
                Share the link or code so your guests can start contributing.
              </AppText>

              {/* QR card */}
              <View style={S.qrCard}>
                <AppText variant="eyebrow" tone="secondary" align="center" style={{ letterSpacing: 1 }}>
                  {celebration.title}
                </AppText>
                <View style={S.qrIconWrap}>
                  <QrCodeIcon size={100} color={colours.brandPrimary} />
                </View>
                <AppText style={[S.qrCode, { color: colours.brandPrimary }]}>
                  {celebration.event_code ?? '——————'}
                </AppText>
              </View>

              <Pressable
                style={[S.sheetBtnPrimary, { backgroundColor: colours.brandPrimary }]}
                onPress={handleShareLink}
              >
                <AppText style={{ color: colours.textOnBrand, fontWeight: '700', fontSize: 15 }}>
                  Share Link
                </AppText>
              </Pressable>
              <Pressable style={S.sheetBtnSecondary} onPress={handleCopyCode}>
                <AppText style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                  Copy Code
                </AppText>
              </Pressable>
              <Pressable
                style={{ paddingVertical: spacing.sm, alignItems: 'center' }}
                onPress={() => setShareVisible(false)}
              >
                <AppText variant="bodySmall" tone="secondary">Dismiss</AppText>
              </Pressable>
            </View>
          </View>
        </Modal>
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

  // Camera-Roll Pill — same family as photosLeftTag, opposite corner.
  cameraRollTag: {
    position: 'absolute',
    bottom: PILL_INSET,
    right: PILL_INSET,
    backgroundColor: 'rgba(11, 11, 12, 0.65)',
    height: PILL_HEIGHT,
    width: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
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
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
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
  shutterBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#1C1B19',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  qrCard: {
    backgroundColor: '#0B0B0C',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  qrIconWrap: {
    backgroundColor: '#EFE9E0',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  qrCode: {
    fontFamily: 'InstrumentSans_700Bold',
    fontSize: 24,
    letterSpacing: 3,
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
});
