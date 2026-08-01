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
} from 'react-native';
import * as Haptics from 'expo-haptics';
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

  // ── States ──
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isPhotosLoaded, setIsPhotosLoaded] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);
  const [shareVisible, setShareVisible] = useState(false);

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

  function toggleFlash() {
    setFlash((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  }

  function toggleFacing() {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }

  async function handleCapture() {
    if (limit !== null && photos.length >= limit) {
      Alert.alert('Limit Reached', "You've reached the photo limit for this event.");
      return;
    }

    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        });

        if (photo && photo.uri) {
          // Play native shutter flash animation
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

          // Prepare Flying animation values
          setFlyingThumbnailUri(photo.uri);
          flyingAnim.setValue({ x: 0, y: 0 });
          flyingScale.setValue(1);
          flyingOpacity.setValue(1);

          // Trigger smooth flight transition into Photos button
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
          ]).start(async () => {
            setFlyingThumbnailUri(null);

            // Update photos list
            const userName = firstNameFrom(profile) || 'You';
            const newPhoto: PhotoItem = { uri: photo.uri, takenBy: userName };
            const next = [newPhoto, ...photos];
            setPhotos(next);
            await AsyncStorage.setItem(
              `__mock_photos_${celebrationId}`,
              JSON.stringify(next),
            );
            // Invalidate query to trigger global Live Activity sync manager instantly
            void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
          });
        }
      } catch (e) {
        console.error('Failed to capture photo:', e);
        Alert.alert('Error', 'Failed to take photo. Please check permissions.');
      }
    }
  }

  async function handleShareLink() {
    if (!celebration) return;
    try {
      await Share.share({
        message: `Join "${celebration.title}" on Candidly → ${BRAND_CONFIG.guestDomain}/e/${celebration.public_slug}`,
      });
    } catch {}
  }

  async function handleCopyCode() {
    if (!celebration) return;
    await Clipboard.setStringAsync(celebration.public_slug);
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

  const remainingPhotos = (limit !== null && isPhotosLoaded) ? limit - photos.length : null;
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
      <View style={[S.viewfinderContainer, { height: viewfinderHeight }]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          zoom={zoom}
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

        {/* Zoom Selector Controls */}
        <View style={S.zoomContainer}>
          <View style={S.zoomPill}>
            {[
              { label: '0.5', value: 0 },
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
          {/* Flash Button */}
          <Pressable 
            onPress={toggleFlash} 
            style={S.controlBtn}
            accessibilityRole="button"
            accessibilityLabel="Toggle flash"
          >
            <FlashIcon mode={flash} />
          </Pressable>

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
            style={({ pressed }) => [S.shutterBtn, pressed && { opacity: 0.8 }]}
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
                  {celebration.public_slug}
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
