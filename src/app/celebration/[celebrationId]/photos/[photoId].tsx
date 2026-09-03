import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
  Modal,
  Share,
  useWindowDimensions,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { BRAND_CONFIG } from '@/config/brand';
import { colours, radii, spacing } from '@/design';
import { useAuth } from '@/features/auth/context';
import { LockIcon } from '@/components/ui/icons';
import {
  celebrationDetailKeys,
  fetchCelebrationDetail,
} from '@/services/celebration-detail';
import { pinHostPhoto, unpinHostPhoto } from '@/services/media-pin';
import { sharePhotoToInstagram } from '@/features/sharing/share-to-instagram';

// ── Models ──

type PhotoItem = {
  id?: string;
  uri: string;
  takenBy: string;
  timestamp?: string;
  isPinned?: boolean;
  is_pinned?: boolean;
  pinnedAt?: string | null;
  caption?: string | null;
  mediaType?: 'photo' | 'video';
};

// ── SVG Icons ──

function CloseXIcon({ size = 18, color = '#FFFFFF' }) {
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

function OverflowDotsIcon({ size = 18, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={12} r={2} fill={color} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Circle cx={19} cy={12} r={2} fill={color} />
    </Svg>
  );
}

function InstagramStoryIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2.5} y={2.5} width={19} height={19} rx={5} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={4.5} stroke={color} strokeWidth={1.8} />
      <Circle cx={17.2} cy={6.8} r={1.2} fill={color} />
    </Svg>
  );
}

function ShareExportIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M12 3v12M8 7l4-4 4 4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DownloadTrayIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v12M8 11l4 4 4-4M4 19h16"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Helper to resolve preset photo images
function getPhotoSource(uri: string) {
  if (uri === 'preset_1') return require('../../../../../assets/images/placeholders/christian_wedding.png');
  if (uri === 'preset_2') return require('../../../../../assets/images/placeholders/hindu_wedding.png');
  if (uri === 'preset_3') return require('../../../../../assets/images/placeholders/treatment_preview_1.png');
  if (uri === 'preset_4') return require('../../../../../assets/images/placeholders/treatment_preview_2.png');
  return { uri };
}

// ── Redesigned Photo Viewer Component ──

export default function PhotoViewerScreen() {
  const { celebrationId, photoId } = useLocalSearchParams<{ celebrationId: string; photoId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(Number(photoId) || 0);
  const [loading, setLoading] = useState(true);
  const [devRole, setDevRole] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Load dev role override
  useEffect(() => {
    AsyncStorage.getItem('__dev_role').then(setDevRole);
  }, []);

  // Fetch celebration details to check reveal status & host permissions
  const { data: detail, isLoading: eventLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const celebration = detail?.celebration;
  const primarySession = detail?.primarySession;

  // `detail.viewerRole === 'guest'` is authoritative: that value means this
  // detail came from the guest-token RPC path (see `fetchCelebrationDetail`),
  // which never returns `celebration.created_by` — so the `!session ? true`
  // branch below would otherwise default every anonymous guest to host.
  const isHost = detail?.viewerRole === 'guest'
    ? false
    : (devRole === 'guest'
        ? false
        : (devRole === 'host' ? true : (!session ? true : session.user.id === celebration?.created_by)));

  // Guests still respect reveal timing, but hosts can always open their own
  // photo viewer. Host-only galleries are enforced elsewhere and should not
  // trap the host behind the same lock that applies to guests.
  const isLocked =
    !isHost &&
    primarySession?.reveal_mode === 'scheduled' &&
    primarySession?.reveal_at &&
    new Date(primarySession.reveal_at).getTime() > Date.now();

  // Load photos list
  useEffect(() => {
    (async () => {
      if (isLocked) {
        setLoading(false);
        return;
      }

      try {
        const key = `__mock_photos_${celebrationId}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as PhotoItem[];
          setPhotos(parsed);
          const initialIdx = Number(photoId);
          if (initialIdx >= 0 && initialIdx < parsed.length) {
            setCurrentIndex(initialIdx);
          }
        }
      } catch {
        Alert.alert('Error', 'Failed to load photo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [celebrationId, photoId, isLocked]);

  const activePhoto = photos[currentIndex] ?? null;

  // ── Carousel Gesture Animation Setup ──
  const panY = useRef(new Animated.Value(0)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const carouselOffsetX = useRef(new Animated.Value(0)).current;

  // Carousel width is the full screen width minus padding (16px each side)
  const carouselWidth = screenWidth - 32;

  // Keep responder stable via useRef to avoid jank on every swipe, but use
  // separate refs to keep handlers current. A responder built with
  // `useRef(...).current` captures stale state at init (currentIndex=0,
  // photos=[]); building only once means handlers can't navigate. But
  // rebuilding via `useMemo` on every state change causes the animation to
  // jank. Solution: refs for state, stable responder object.
  const currentIndexRef = useRef(currentIndex);
  const photosLengthRef = useRef(photos.length);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    photosLengthRef.current = photos.length;
  }, [currentIndex, photos.length]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 || Math.abs(gestureState.dx) > 6,
      onPanResponderMove: (_, gestureState) => {
        // Track both axes simultaneously; gestures are determined at release time
        panY.setValue(gestureState.dy);
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);

        // Vertical dismissal takes priority (swipe down to close)
        if (isVerticalSwipe && (gestureState.dy > 100 || (gestureState.dy > 50 && gestureState.vy > 0.4))) {
          Animated.timing(panY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => router.back());
          return;
        }

        // Horizontal carousel swipe (dragging left/right between photos)
        if (isHorizontalSwipe) {
          const thresholdPercent = 0.3; // Swipe past 30% of carousel width to commit
          const thresholdPx = carouselWidth * thresholdPercent;

          // Swipe left (negative dx) -> try to go to next photo
          if (gestureState.dx < -thresholdPx || (gestureState.dx < -10 && gestureState.vx < -0.5)) {
            if (currentIndexRef.current < photosLengthRef.current - 1) {
              void Haptics.selectionAsync().catch(() => {});
              // Animate to full page swipe distance and commit index
              Animated.timing(panX, {
                toValue: -carouselWidth,
                duration: 200,
                useNativeDriver: true,
              }).start(() => {
                panX.setValue(0);
                setCurrentIndex((prev) => prev + 1);
              });
              Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 6,
              }).start();
              return;
            }
          }

          // Swipe right (positive dx) -> try to go to previous photo
          if (gestureState.dx > thresholdPx || (gestureState.dx > 10 && gestureState.vx > 0.5)) {
            if (currentIndexRef.current > 0) {
              void Haptics.selectionAsync().catch(() => {});
              // Animate to full page swipe distance and commit index
              Animated.timing(panX, {
                toValue: carouselWidth,
                duration: 200,
                useNativeDriver: true,
              }).start(() => {
                panX.setValue(0);
                setCurrentIndex((prev) => prev - 1);
              });
              Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 6,
              }).start();
              return;
            }
          }

          // Swipe didn't pass threshold—spring back to current photo
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
          return;
        }

        // Neither vertical nor horizontal swipe—spring back everything
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  // Update refs whenever state changes so gesture handlers see current values
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    photosLengthRef.current = photos.length;
  }, [currentIndex, photos.length]);

  // When currentIndex changes, animate the carousel to show the new photo
  useLayoutEffect(() => {
    Animated.spring(carouselOffsetX, {
      toValue: -currentIndex * carouselWidth,
      useNativeDriver: true,
      bounciness: 0,
      speed: 8,
    }).start();
  }, [currentIndex, carouselWidth, carouselOffsetX]);

  // ── Actions ──

  async function getLocalPhotoUri(uri: string): Promise<string> {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const filename = uri.split('/').pop()?.split('?')[0] || 'photo.jpg';
      const file = new FileSystem.File(FileSystem.Paths.cache, filename);
      const downloaded = await FileSystem.File.downloadFileAsync(uri, file);
      return downloaded.uri;
    }
    return uri;
  }

  const handleSaveOriginal = async () => {
    setMenuVisible(false);
    if (!activePhoto) return;

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(activePhoto.uri);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo-${activePhoto.id || 'download'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Success', 'Photo downloaded successfully.');
      } catch (err: any) {
        console.error('Failed to download photo on web:', err);
        Alert.alert('Download failed', 'Failed to download photo on web: ' + err.message);
      }
      return;
    }

    try {
      const MediaLibrary = await import('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Allow access to your photo library to save photos to your device.'
        );
        return;
      }

      const localPath = await getLocalPhotoUri(activePhoto.uri);
      await MediaLibrary.saveToLibraryAsync(localPath);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Success', 'Photo downloaded successfully.');
    } catch (err: any) {
      console.error('Failed to download photo:', err);
      Alert.alert('Download failed', 'Could not save photo to your device: ' + (err.message || String(err)));
    }
  };

  const handleShareStory = async () => {
    if (!activePhoto) return;
    await sharePhotoToInstagram(activePhoto);
  };

  const handleShareGeneral = async () => {
    if (!activePhoto) return;
    void Haptics.selectionAsync().catch(() => {});

    const eventCode = celebration?.public_slug || '';
    const photoIdVal = activePhoto.id || activePhoto.uri;
    const shareLink = `${BRAND_CONFIG.guestDomain}/e/${eventCode}?photoId=${encodeURIComponent(photoIdVal)}`;

    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: `Check out this photo from ${celebration?.title || 'the event'}! View it here: ${shareLink}` }
          : { message: `Check out this photo from ${celebration?.title || 'the event'}! View it here: ${shareLink}`, url: shareLink }
      );
    } catch (err: any) {
      console.error('Failed to share photo:', err);
    }
  };

  const allMediaPhotos = detail?.mediaPhotos ?? [];
  const pinnedCount = allMediaPhotos.filter((p) => p.isPinned === true).length;
  const currentMediaItem = allMediaPhotos.find(
    (p) => p.id === activePhoto?.id || p.storagePath === activePhoto?.uri
  );
  const isPinned = currentMediaItem?.isPinned ?? (activePhoto as any)?.isPinned === true;

  const handleTogglePin = async () => {
    if (!isHost || !activePhoto || !celebrationId) return;
    setMenuVisible(false);
    const mediaItemId = currentMediaItem?.id ?? activePhoto.id ?? activePhoto.uri;

    try {
      if (isPinned) {
        await unpinHostPhoto({ mediaItemId, celebrationId: String(celebrationId) });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        if (pinnedCount >= 2) {
          Alert.alert('Limit reached', 'Maximum of 2 pinned items allowed.');
          return;
        }
        await pinHostPhoto({ mediaItemId, celebrationId: String(celebrationId) });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebrationId)),
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update pin status.');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!isHost || !activePhoto) return;
    setMenuVisible(false);

    Alert.alert(
      'Delete this photo?',
      'This will permanently remove it from the event gallery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Photo',
          style: 'destructive',
          onPress: async () => {
            try {
              const key = `__mock_photos_${celebrationId}`;
              const stored = await AsyncStorage.getItem(key);
              if (stored) {
                const parsed = JSON.parse(stored) as PhotoItem[];
                const deletedPhotoUri = activePhoto.uri;

                // Remove photo at current index
                const updated = parsed.filter((_, idx) => idx !== currentIndex);
                await AsyncStorage.setItem(key, JSON.stringify(updated));

                // Cleanup in mock_challenges
                const challengesKey = `__mock_challenges_${celebrationId}`;
                const challengesStored = await AsyncStorage.getItem(challengesKey);
                if (challengesStored) {
                  const parsedChallenges = JSON.parse(challengesStored) as any[];
                  const updatedChallenges = parsedChallenges.map((c) =>
                    c.photo === deletedPhotoUri ? { ...c, photo: null } : c
                  );
                  await AsyncStorage.setItem(challengesKey, JSON.stringify(updatedChallenges));
                }

                // Cleanup in mock_challenge_submissions
                const allKeys = await AsyncStorage.getAllKeys();
                const submissionKeys = allKeys.filter((k) =>
                  k.startsWith(`__mock_challenge_submissions_${celebrationId}`)
                );
                for (const sKey of submissionKeys) {
                  const subsStored = await AsyncStorage.getItem(sKey);
                  if (subsStored) {
                    const parsedSubs = JSON.parse(subsStored) as any[];
                    const updatedSubs = parsedSubs.filter((item: any) => {
                      const uri = typeof item === 'string' ? item : item.uri;
                      return uri !== deletedPhotoUri;
                    });
                    await AsyncStorage.setItem(sKey, JSON.stringify(updatedSubs));
                  }
                }

                // Sync UI immediately
                queryClient.invalidateQueries({
                  queryKey: celebrationDetailKeys.detail(String(celebrationId)),
                });

                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

                Alert.alert('Photo deleted', '', [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]);
              }
            } catch {
              Alert.alert('Error', 'Failed to delete photo.');
            }
          },
        },
      ]
    );
  };

  if (loading || eventLoading) {
    return (
      <View style={S.loadingRoot}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  // Enforce locked screen fallback
  if (isLocked) {
    return (
      <Screen scrollable={false}>
        <View style={S.lockedRoot}>
          <View style={S.lockCircle}>
            <LockIcon size={24} color="#000000" />
          </View>
          <AppText variant="titleLarge" style={{ color: '#FFFFFF', marginTop: spacing.md }}>
            This Photo is Locked
          </AppText>
          <AppText
            variant="bodyMedium"
            tone="secondary"
            align="center"
            style={{ marginTop: spacing.xs, marginHorizontal: spacing.xl }}
          >
            This photo will unlock automatically once the event reveal time has passed.
          </AppText>
          <Pressable style={S.backBtn} onPress={() => router.back()}>
            <AppText style={S.backBtnText}>Go Back</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!activePhoto) {
    return (
      <Screen scrollable={false}>
        <View style={S.lockedRoot}>
          <AppText variant="bodyMedium" tone="secondary">
            Photo not found.
          </AppText>
          <Pressable style={S.backBtn} onPress={() => router.back()}>
            <AppText style={S.backBtnText}>Go Back</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // Container drag scale & opacity interpolations
  const scale = panY.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  const opacity = panY.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.6],
    extrapolate: 'clamp',
  });

  return (
    <View style={S.root}>
      {/* ── HEADER ── */}
      <View style={[S.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={() => router.back()} style={S.circleHeaderBtn}>
          <CloseXIcon />
        </Pressable>

        <Pressable onPress={() => setMenuVisible(true)} style={S.circleHeaderBtn}>
          <OverflowDotsIcon />
        </Pressable>
      </View>

      {/* ── INTERACTIVE CAROUSEL WITH DRAG GESTURES ── */}
      <View style={S.centerArea}>
        {/* Carousel container: holds three photos side-by-side */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            flexDirection: 'row',
            width: carouselWidth * 3,
            height: '100%',
            transform: [
              // Combine the carousel offset (based on currentIndex) with the drag (panX)
              { translateX: Animated.add(carouselOffsetX, panX) },
              { translateY: panY },
              { scale },
            ],
            opacity,
          }}
        >
          {/* Previous photo (if exists) */}
          {currentIndex > 0 && (
            <View style={{ width: carouselWidth, height: '100%' }}>
              <Image
                source={getPhotoSource(photos[currentIndex - 1]?.uri || '')}
                style={[S.photoImage, { width: carouselWidth - 32 }]}
                resizeMode="cover"
              />
            </View>
          )}
          {/* Padding for previous when at first photo */}
          {currentIndex === 0 && <View style={{ width: carouselWidth, height: '100%' }} />}

          {/* Current photo (center, always visible) */}
          {activePhoto && (
            <View style={[S.photoContainer, { width: carouselWidth }]}>
              <Image
                source={getPhotoSource(activePhoto.uri)}
                style={S.photoImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Next photo (if exists) */}
          {currentIndex < photos.length - 1 && (
            <View style={{ width: carouselWidth, height: '100%' }}>
              <Image
                source={getPhotoSource(photos[currentIndex + 1]?.uri || '')}
                style={[S.photoImage, { width: carouselWidth - 32 }]}
                resizeMode="cover"
              />
            </View>
          )}
          {/* Padding for next when at last photo */}
          {currentIndex === photos.length - 1 && <View style={{ width: carouselWidth, height: '100%' }} />}
        </Animated.View>
      </View>

      {Boolean(activePhoto?.caption && activePhoto.caption.trim()) && (
        <View style={S.photoCaptionBoxWrap} pointerEvents="none">
          <View style={S.captionBoxInner}>
            <AppText style={S.captionBoxText}>
              {activePhoto?.caption?.trim()}
            </AppText>
          </View>
        </View>
      )}

      {/* ── METADATA ROW ── */}
      <View style={[S.metadataRow, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        {/* Left aligned: Photographer Name & Time */}
        <View style={S.metaLeft}>
          <AppText style={S.authorName} numberOfLines={1}>
            {activePhoto.takenBy || 'Riya Sharma'}
          </AppText>
          <AppText style={S.captureTime} numberOfLines={1}>
            Today at 7:42 PM
          </AppText>
        </View>

        {/* Right aligned: Monochrome Action Icons */}
        <View style={S.metaRightIcons}>
          <Pressable onPress={handleShareStory} style={S.iconBtn}>
            <InstagramStoryIcon />
          </Pressable>

          <Pressable onPress={handleShareGeneral} style={S.iconBtn}>
            <ShareExportIcon />
          </Pressable>

          {activePhoto.mediaType !== 'video' && (
            <Pressable onPress={handleSaveOriginal} style={S.iconBtn}>
              <DownloadTrayIcon />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── OVERFLOW THREE-DOT MENU MODAL ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={S.menuSheet}>
            {activePhoto.mediaType !== 'video' && (
              <Pressable style={S.menuOption} onPress={handleSaveOriginal}>
                <AppText style={S.menuOptionText}>Save Original</AppText>
              </Pressable>
            )}

            {isHost && (
              <>
                {isPinned ? (
                  <Pressable style={[S.menuOption, S.menuOptionBorder]} onPress={handleTogglePin}>
                    <AppText style={S.menuOptionText}>Unpin</AppText>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[S.menuOption, S.menuOptionBorder, pinnedCount >= 2 && S.menuOptionDisabled]}
                    onPress={pinnedCount >= 2 ? undefined : handleTogglePin}
                    disabled={pinnedCount >= 2}
                  >
                    <AppText style={[S.menuOptionText, pinnedCount >= 2 && S.menuOptionDisabledText]}>
                      Pin to top
                    </AppText>
                  </Pressable>
                )}

                <Pressable style={[S.menuOption, S.menuOptionBorder]} onPress={handleDeleteConfirmed}>
                  <AppText style={S.menuDeleteText}>Delete Photo</AppText>
                </Pressable>
              </>
            )}

            <Pressable style={[S.menuOption, S.menuCancelOption]} onPress={() => setMenuVisible(false)}>
              <AppText style={S.menuCancelText}>Cancel</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedRoot: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#EFE9E0',
  },
  backBtnText: {
    color: '#0B0B0C',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 14,
  },

  // ── Header Bar ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  circleHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Photo Frame ──
  centerArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0D0D0E',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },

  // ── Metadata Row ──
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  metaLeft: {
    flex: 1,
    gap: 2,
  },
  authorName: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  captureTime: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  metaRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  iconBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Overflow Menu Sheet ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 36,
  },
  menuSheet: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuOption: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
  },
  menuOptionText: {
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  menuDeleteText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 16,
    color: '#FF4D4D',
  },
  menuCancelOption: {
    borderTopWidth: 8,
    borderTopColor: '#000000',
    backgroundColor: '#1C1C1E',
  },
  menuCancelText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  menuOptionDisabled: {
    opacity: 0.4,
  },
  menuOptionDisabledText: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  photoCaptionBoxWrap: {
    position: 'absolute',
    top: '72%',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 35,
  },
  captionBoxInner: {
    backgroundColor: 'rgba(11, 11, 12, 0.78)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  captionBoxText: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
