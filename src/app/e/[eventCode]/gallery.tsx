import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { CameraIcon, ClockIcon, LockIcon, CloseIcon, ShareIcon, PinIcon } from '@/components/ui/icons';
import { InviteShareSheet } from '@/features/sharing/invite-share-sheet';
import { BRAND_CONFIG } from '@/config/brand';
import { colours, radii, spacing, layout } from '@/design';
import {
  fetchGuestGallery,
  loadStoredGuestSession,
  clearStoredGuestSession,
  compressImageWeb,
  uploadGuestPhoto,
  guestSessionStorage,
  type GuestSession,
} from '@/services/guest-session';
import { deleteGuestPhoto } from '@/services/guest-media-upload';
import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';

const GALLERY_HEADER_ICON = require('../../../../assets/brand/gallery-icon.png');

export default function GuestGalleryScreen() {
  const { eventCode } = useLocalSearchParams<{ eventCode: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();

  const [storedSession, setStoredSession] = useState<GuestSession | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<any | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  const fileInputRef = useRef<any>(null);

  // Load and validate the session locally
  useEffect(() => {
    if (!eventCode) return;
    let active = true;

    async function checkSession() {
      try {
        const session = await loadStoredGuestSession(eventCode);
        if (active) {
          if (session?.guestToken) {
            setStoredSession(session);
          } else {
            // No valid session: redirect back to event cover page
            router.replace(`/e/${eventCode}`);
          }
        }
      } catch (e) {
        console.error('Error loading session:', e);
        if (active) router.replace(`/e/${eventCode}`);
      } finally {
        if (active) setIsVerifyingSession(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [eventCode, router]);

  // Query gallery data securely validating guest token
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['guest', 'gallery', String(eventCode)],
    queryFn: () => fetchGuestGallery(String(eventCode), storedSession!.guestToken),
    enabled: !!storedSession?.guestToken && !!eventCode,
    retry: false,
  });

  // Logs query errors to console
  useEffect(() => {
    if (error) {
      console.error('Gallery query failed:', error);
    }
  }, [error]);

  // Web camera / file capture trigger
  const triggerCapture = useCallback(() => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      // Direct file pick fallback for native testing
      // (This screen is primarily built for Web, native users use the app viewfinder)
      AlertNativeFallback();
    }
  }, []);

  const AlertNativeFallback = () => {
    if (typeof window === 'undefined') return;
    alert('Direct file uploads are optimized for the web experience. Native users should use the Candid viewfinder.');
  };

  // Process capture file
  const handleFileChange = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file || !storedSession || !data) return;

    // Check remaining shot limit
    const shotsRemaining = data.session.shot_limit_per_guest === null
      ? null
      : Math.max(0, data.session.shot_limit_per_guest - data.guest.shots_used);

    if (shotsRemaining !== null && shotsRemaining <= 0) {
      setUploadError('You have used all your shots for this event!');
      return;
    }

    setUploadProgress(0);
    setUploadError(null);

    try {
      // 1. Resize and compress the image on canvas
      const compressedBlob = await compressImageWeb(file);
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';

      if (!isBackendConfigured) {
        // Mock upload fallback
        const mockPhotosKey = `__mock_photos_${data.celebration.id}`;
        const objectUrl = URL.createObjectURL(compressedBlob);
        
        // Load existing mock photos
        const storedPhotosRaw = await AsyncStorage.getItem(mockPhotosKey);
        const storedPhotos = storedPhotosRaw ? JSON.parse(storedPhotosRaw) : [];
        const newPhoto = {
          id: `mock_${Date.now()}`,
          uri: objectUrl,
          captured_at: new Date().toISOString(),
          takenBy: storedSession.displayName,
        };
        
        const nextPhotos = [newPhoto, ...storedPhotos];
        await AsyncStorage.setItem(mockPhotosKey, JSON.stringify(nextPhotos));
        
        // Update local session count
        const nextSession = { ...storedSession, shotsUsed: nextPhotos.length };
        await AsyncStorage.setItem(`guest_session_${eventCode.trim().toLowerCase()}`, JSON.stringify(nextSession));
        setStoredSession(nextSession);
      } else {
        // Real upload to Supabase
        await uploadGuestPhoto({
          eventSessionId: data.session.id,
          guestToken: storedSession.guestToken,
          fileBytes: compressedBlob,
          fileExtension: fileExt,
        });
      }

      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1200);
      void refetch();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploadProgress(null);
    }
  };

  const countdown = useCountdown(data?.celebration?.ends_at ?? null);

  if (error) {
    return (
      <View style={[S.root, S.centred, { padding: spacing.lg }]}>
        <AppText variant="bodyLarge" tone="error" align="center" style={{ marginBottom: spacing.md }}>
          Gallery Authorization Error
        </AppText>
        <AppText variant="bodyMedium" tone="secondary" align="center" style={{ marginBottom: spacing.lg }}>
          {error instanceof Error ? error.message : String(error)}
        </AppText>
        <Pressable
          onPress={async () => {
            await clearStoredGuestSession(String(eventCode));
            router.replace(`/e/${eventCode}`);
          }}
          style={{
            backgroundColor: colours.accentWarm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md
          }}
        >
          <AppText style={{ color: colours.textOnBrand, fontWeight: 'bold' }}>Return to Cover</AppText>
        </Pressable>
      </View>
    );
  }

  if (isVerifyingSession || isLoading) {
    return (
      <View style={[S.root, S.centred]}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  if (!storedSession || !data) {
    // Session check is async. If it's checked and null, redirect to cover.
    return (
      <View style={[S.root, S.centred, { padding: spacing.lg }]}>
        <AppText variant="bodyMedium" tone="secondary" align="center">
          Verifying guest session...
        </AppText>
      </View>
    );
  }

  const { celebration, session, guest, photos } = data;
  const shotsRemaining = session.shot_limit_per_guest === null
    ? null
    : Math.max(0, session.shot_limit_per_guest - guest.shots_used);
  const activeMediaLabel = activePhoto?.media_type === 'video' ? 'video' : 'photo';
  const activeMediaLabelTitle = activePhoto?.media_type === 'video' ? 'Video' : 'Photo';
  const canDeleteActivePhoto =
    Boolean(activePhoto?.id) &&
    Boolean(storedSession?.guestToken) &&
    (activePhoto?.is_mine === true ||
      (Boolean(activePhoto?.guest_session_id) &&
        activePhoto?.guest_session_id === storedSession?.guestSessionId));

  async function deleteActivePhotoNow() {
    if (!activePhoto?.id || !storedSession?.guestToken || !eventCode) return;
    const deletedMediaItemId = activePhoto.id;

    const result = await deleteGuestPhoto({
      mediaItemId: deletedMediaItemId,
      guestToken: storedSession.guestToken,
    });

    const nextSession = {
      ...storedSession,
      shotsUsed: result.shotsUsed,
    };
    await guestSessionStorage.set(String(eventCode), nextSession);
    setStoredSession(nextSession);
    setActivePhoto(null);

    queryClient.setQueryData(['guest', 'gallery', String(eventCode)], (current: any) => {
      if (!current) return current;
      return {
        ...current,
        guest: {
          ...current.guest,
          shots_used: result.shotsUsed,
        },
        photos: Array.isArray(current.photos)
          ? current.photos.filter((item: any) => item.id !== deletedMediaItemId)
          : current.photos,
      };
    });

    await refetch();
    await queryClient.invalidateQueries({
      queryKey: ['guest', 'gallery', String(eventCode)],
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function confirmDeleteActivePhoto() {
    if (!activePhoto?.id || !storedSession?.guestToken) return;

    const confirmDelete = async () => {
      try {
        await deleteActivePhotoNow();
      } catch (deleteError) {
        console.error(`[guest-gallery] failed to delete ${activeMediaLabel}`, deleteError);
        Alert.alert('Error', `Could not delete this ${activeMediaLabel}. Please try again.`);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Delete this ${activeMediaLabel}? This will remove it from the event gallery.`)) {
        void confirmDelete();
      }
      return;
    }

    Alert.alert(
      `Delete this ${activeMediaLabel}?`,
      'This will remove it from the event gallery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${activeMediaLabelTitle}`,
          style: 'destructive',
          onPress: () => {
            void confirmDelete();
          },
        },
      ],
    );
  }

  const numColumns = screenWidth > 600 ? 3 : 2;
  const imageSize = Math.floor(screenWidth / numColumns) - 2;

  return (
    <View style={[S.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef}
          style={S.hiddenInput}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />
      )}

      {/* Header Info */}
      <View style={S.header}>
        <View style={S.headerTitleRow}>
          <View style={S.headerIdentity}>
            <View style={S.headerLogoSlot}>
              <Image
                source={GALLERY_HEADER_ICON}
                accessibilityRole="image"
                accessibilityLabel={BRAND_CONFIG.appName}
                resizeMode="contain"
                style={S.headerLogo}
              />
            </View>
            <AppText variant="displaySmall" style={S.title}>{celebration.title}</AppText>
          </View>
          <Pressable
            onPress={() => setShareVisible(true)}
            style={({ pressed }) => [S.sharePill, pressed && { opacity: 0.82 }]}
            accessibilityRole="button"
            accessibilityLabel="Share invitation"
          >
            <ShareIcon size={16} color={colours.textOnBrand} />
            <AppText variant="labelSmall" style={S.sharePillText}>Share invitation</AppText>
          </Pressable>
        </View>
        
        <View style={S.metaRow}>
          <View style={S.metaCol}>
            <ClockIcon size={14} color={colours.textSecondary} />
            <AppText variant="caption" tone="secondary">{countdown}</AppText>
          </View>
          <View style={S.metaCol}>
            <CameraIcon size={14} color={colours.textSecondary} />
            <AppText variant="caption" tone="secondary">
              Shots Left: {shotsRemaining === null ? '∞' : `${shotsRemaining}/${session.shot_limit_per_guest}`}
            </AppText>
          </View>
        </View>

        {uploadProgress !== null && (
          <View style={S.progressContainer}>
            <ActivityIndicator size="small" color={colours.accentWarm} />
            <AppText variant="caption" style={S.progressText}>
              Compressing and uploading photo...
            </AppText>
          </View>
        )}

        {uploadError && (
          <AppText variant="caption" tone="error" style={S.errorText}>
            {uploadError}
          </AppText>
        )}
      </View>

      {/* Locked State Panel */}
      {session.is_locked ? (
        <View style={[S.content, S.centred, S.lockedPanel]}>
          <LockIcon size={44} color={colours.textSecondary} />
          <AppText variant="bodyLarge" align="center" style={S.lockedTitle}>
            The gallery is currently locked
          </AppText>
          <AppText variant="bodyMedium" tone="secondary" align="center">
            Photos will be revealed automatically when the countdown ends.
          </AppText>
        </View>
      ) : (
        /* Unlocked Grid View */
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={S.gridContainer}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActivePhoto(item)}
              style={[S.gridItem, { width: imageSize, height: imageSize }]}
            >
              <Image source={{ uri: item.storage_path }} style={S.gridImage} />
              {Boolean(item.is_pinned || item.isPinned) && (
                <View style={S.pinBadge}>
                  <PinIcon size={12} color="#FFFFFF" />
                </View>
              )}
              <View style={S.authorTag}>
                <AppText variant="caption" style={S.authorText} numberOfLines={1}>
                  {item.display_name}
                </AppText>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={[S.emptyContainer, S.centred]}>
              <AppText variant="bodyMedium" tone="secondary" align="center">
                No photos in the gallery yet. Be the first to contribute!
              </AppText>
            </View>
          }
        />
      )}

      {/* Floating Web Capture CTA */}
      {!session.is_locked && (shotsRemaining === null || shotsRemaining > 0) && (
        <Pressable
          onPress={triggerCapture}
          disabled={uploadProgress !== null}
          style={[S.fab, uploadProgress !== null && S.fabDisabled]}
        >
          <CameraIcon size={24} color={colours.textOnBrand} />
          <AppText variant="labelLarge" style={S.fabLabel}>Capture Photo</AppText>
        </Pressable>
      )}

      {/* Lightbox / Zoom Modal */}
      {activePhoto && (
        <Modal transparent visible={!!activePhoto} animationType="fade">
          <View style={S.modalOverlay}>
            <Pressable style={S.modalClose} onPress={() => setActivePhoto(null)}>
              <CloseIcon size={24} color="#FFFFFF" />
            </Pressable>
            <Image
              source={{ uri: activePhoto.storage_path }}
              style={S.modalImage}
              resizeMode="contain"
            />
            <View style={S.modalInfo}>
              <AppText variant="bodyLarge" style={S.modalAuthor}>{activePhoto.display_name}</AppText>
              <AppText variant="caption" tone="secondary">
                {new Date(activePhoto.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </AppText>
              {canDeleteActivePhoto ? (
                <Pressable
                  onPress={confirmDeleteActivePhoto}
                  style={({ pressed }) => [S.deleteButton, pressed && { opacity: 0.82 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete this ${activeMediaLabel}`}
                >
                  <AppText variant="labelSmall" style={S.deleteButtonText}>
                    Delete {activeMediaLabelTitle}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Modal>
      )}

      <InviteShareSheet
        visible={shareVisible}
        eventName={celebration.title}
        eventCode={String(eventCode)}
        bottomInset={insets.bottom}
        onClose={() => setShareVisible(false)}
      />
    </View>
  );
}

// Live remaining countdown ticker
function useCountdown(endsAt: string | null): string {
  const [label, setLabel] = useState(() => formatRemaining(endsAt));

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setLabel(formatRemaining(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return label;
}

function formatRemaining(endsAt: string | null): string {
  if (!endsAt) return 'Unlimited Time';

  const remaining = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Ended';

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colours.background,
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    display: 'none',
  },

  // Header styling
  header: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colours.borderSubtle,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /**
   * Sits where a back button would, at the leading edge of the header row and
   * opposite the share pill. The 38pt box matches a nav button's footprint so
   * the mark carries the same padding as the share control on the far side;
   * the mark itself is 26pt, the height the wordmark used to be.
   */
  headerLogoSlot: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 26,
    height: 26,
    opacity: 0.92,
  },
  title: {
    flex: 1,
    color: colours.textPrimary,
  },
  sharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colours.brandPrimary,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
  },
  sharePillText: {
    color: colours.textOnBrand,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  progressText: {
    color: colours.accentWarm,
  },
  errorText: {
    marginTop: spacing.sm,
  },

  // Grid styling
  gridContainer: {
    padding: 1,
  },
  gridItem: {
    margin: 1,
    position: 'relative',
    backgroundColor: colours.surfaceMuted,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  authorTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  authorText: {
    color: '#FFFFFF',
    fontSize: 10,
  },

  // Locked and empty panels
  content: {
    flex: 1,
  },
  lockedPanel: {
    padding: layout.gutter * 2,
    gap: spacing.md,
  },
  lockedTitle: {
    color: colours.textPrimary,
    fontWeight: 'bold',
    marginTop: spacing.xs,
  },
  emptyContainer: {
    padding: layout.gutter * 3,
  },

  // Floating Capture Button
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colours.accentWarm,
    paddingHorizontal: spacing.lg,
    height: 56,
    borderRadius: radii.pill,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabDisabled: {
    opacity: 0.5,
  },
  fabLabel: {
    color: colours.textOnBrand,
    fontWeight: 'bold',
  },

  // Modal Zoom styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  },
  modalImage: {
    width: '100%',
    height: '70%',
  },
  pinBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  modalInfo: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  modalAuthor: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  deleteButton: {
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  deleteButtonText: {
    color: '#FF7A7A',
    fontWeight: '700',
  },
});
