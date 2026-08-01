import { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { colours, radii, spacing } from '@/design';
import { useAuth } from '@/features/auth/context';
import { LockIcon } from '@/components/ui/icons';
import {
  celebrationDetailKeys,
  fetchCelebrationDetail,
} from '@/services/celebration-detail';

// ── Models ──

type PhotoItem = {
  uri: string;
  takenBy: string;
  timestamp?: string;
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

  // Check strict reveal/lock constraints
  const isLocked = primarySession?.reveal_mode === 'scheduled' &&
                   primarySession?.reveal_at &&
                   new Date(primarySession.reveal_at).getTime() > Date.now();

  const isHost = devRole === 'guest'
    ? false
    : (devRole === 'host' ? true : (!session ? true : session.user.id === celebration?.created_by));

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

  // ── Swipe Down & Carousel Gesture Animation Setup ──
  const panY = useRef(new Animated.Value(0)).current;
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 || Math.abs(gestureState.dx) > 6,
      onPanResponderMove: (_, gestureState) => {
        // Vertical drag down for dismissal
        if (gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          panY.setValue(gestureState.dy);
        }
        // Horizontal drag for gallery swipe
        else if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
          panX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Vertical dismissal threshold
        if (gestureState.dy > 120 || (gestureState.dy > 60 && gestureState.vy > 0.5)) {
          Animated.timing(panY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => router.back());
          return;
        }

        // Spring back vertical drag if threshold not met
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();

        // Horizontal swipe navigation with smooth slide animation
        if (gestureState.dx < -50 || (gestureState.dx < -20 && gestureState.vx < -0.3)) {
          // Swipe left -> Next photo
          if (currentIndex < photos.length - 1) {
            void Haptics.selectionAsync().catch(() => {});
            Animated.timing(panX, {
              toValue: -400,
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              panX.setValue(0);
              setCurrentIndex((prev) => prev + 1);
            });
            return;
          }
        } else if (gestureState.dx > 50 || (gestureState.dx > 20 && gestureState.vx > 0.3)) {
          // Swipe right -> Previous photo
          if (currentIndex > 0) {
            void Haptics.selectionAsync().catch(() => {});
            Animated.timing(panX, {
              toValue: 400,
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              panX.setValue(0);
              setCurrentIndex((prev) => prev - 1);
            });
            return;
          }
        }

        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  // ── Actions ──

  const handleSaveOriginal = () => {
    setMenuVisible(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Saved', 'Photo saved to Camera Roll.');
  };

  const handleShareStory = () => {
    void Haptics.selectionAsync().catch(() => {});
    Alert.alert('Instagram Story', 'Opening Instagram Story export...');
  };

  const handleShareGeneral = async () => {
    void Haptics.selectionAsync().catch(() => {});
    try {
      if (activePhoto) {
        await Share.share({
          message: `Check out this photo taken by ${activePhoto.takenBy || 'a guest'} at ${celebration?.title || 'the event'}!`,
        });
      }
    } catch {}
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

      {/* ── 80% HEIGHT PHOTO CONTAINER WITH DRAG GESTURES ── */}
      <View style={S.centerArea}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            S.photoContainer,
            {
              transform: [{ translateY: panY }, { translateX: panX }, { scale }],
              opacity,
            },
          ]}
        >
          <Image
            source={getPhotoSource(activePhoto.uri)}
            style={S.photoImage}
            resizeMode="cover"
          />
        </Animated.View>
      </View>

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

          <Pressable onPress={handleSaveOriginal} style={S.iconBtn}>
            <DownloadTrayIcon />
          </Pressable>
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
            <Pressable style={S.menuOption} onPress={handleSaveOriginal}>
              <AppText style={S.menuOptionText}>Save Original</AppText>
            </Pressable>

            {isHost && (
              <Pressable style={[S.menuOption, S.menuOptionBorder]} onPress={handleDeleteConfirmed}>
                <AppText style={S.menuDeleteText}>Delete Photo</AppText>
              </Pressable>
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
});
