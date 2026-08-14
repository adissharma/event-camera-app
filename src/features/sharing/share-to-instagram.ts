import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import type { ShareSingleOptions } from 'react-native-share';

import { inferMimeTypeFromUri } from '@/features/media/storage-paths';

const INSTAGRAM_ANDROID_PACKAGE = 'com.instagram.android';
const INSTAGRAM_IOS_SCHEME = 'instagram://';

type InstagramShareInput = {
  uri: string;
  id?: string | null;
  mediaType?: 'photo' | 'video';
};

function filenameFromUri(uri: string, id?: string | null): string {
  const path = uri.split(/[?#]/, 1)[0] ?? uri;
  const extension = path.split('.').pop()?.toLowerCase();
  const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'jpg';
  return `photo-${id || Date.now()}.${safeExtension}`;
}

async function ensureLocalImageUri(uri: string, id?: string | null): Promise<string> {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  const destinationFile = new FileSystem.File(
    FileSystem.Paths.cache,
    `instagram-${filenameFromUri(uri, id)}`,
  );
  const downloaded = await FileSystem.File.downloadFileAsync(uri, destinationFile, {
    idempotent: true,
  });
  return downloaded.uri;
}

async function downloadPhotoOnWeb(uri: string, id?: string | null): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filenameFromUri(uri, id);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

async function shareImageFileFallback(localUri: string, mimeType: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }

  await Sharing.shareAsync(localUri, {
    dialogTitle: 'Share photo',
    mimeType,
    UTI: 'public.image',
  });
  return true;
}

function isUserCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss|did not share/i.test(message);
}

export async function sharePhotoToInstagram(photo: InstagramShareInput): Promise<void> {
  void Haptics.selectionAsync().catch(() => {});

  if (photo.mediaType === 'video') {
    Alert.alert('Share to Instagram', 'Instagram sharing from this button is available for photos only.');
    return;
  }

  if (Platform.OS === 'web') {
    try {
      await downloadPhotoOnWeb(photo.uri, photo.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Photo downloaded',
        'Browsers cannot send a photo directly into Instagram. Upload the downloaded photo in Instagram to post it.',
      );
    } catch (error) {
      console.error('[sharing] failed to prepare Instagram web download', error);
      Alert.alert(
        'Share to Instagram',
        'Your browser could not download this photo. Open the photo, save it to your device, then upload it in Instagram.',
      );
    }
    return;
  }

  let localUri: string | null = null;
  let mimeType: string | null = null;

  try {
    localUri = await ensureLocalImageUri(photo.uri, photo.id);
    mimeType = inferMimeTypeFromUri(localUri);

    if (Platform.OS === 'android') {
      const RNShare = (await import('react-native-share')).default;
      const { isInstalled } = await RNShare.isPackageInstalled(INSTAGRAM_ANDROID_PACKAGE);
      if (!isInstalled) {
        const openedFallback = await shareImageFileFallback(localUri, mimeType);
        if (!openedFallback) {
          Alert.alert('Instagram not installed', 'Install Instagram, or save this photo and upload it there.');
        }
        return;
      }

      await RNShare.shareSingle({
        social: RNShare.Social.INSTAGRAM,
        url: localUri,
        type: mimeType,
        filename: filenameFromUri(localUri, photo.id),
        forceDialog: true,
      } as ShareSingleOptions);
      return;
    }

    const canOpenInstagram = await Linking.canOpenURL(INSTAGRAM_IOS_SCHEME);
    if (!canOpenInstagram) {
      const openedFallback = await shareImageFileFallback(localUri, mimeType);
      if (!openedFallback) {
        Alert.alert('Instagram not installed', 'Install Instagram, or save this photo and upload it there.');
      }
      return;
    }

    const RNShare = (await import('react-native-share')).default;
    await RNShare.shareSingle({
      social: RNShare.Social.INSTAGRAM,
      url: localUri,
      type: mimeType,
      filename: filenameFromUri(localUri, photo.id),
    } as ShareSingleOptions);
  } catch (error) {
    if (isUserCancel(error)) {
      return;
    }

    console.error('[sharing] failed to share photo to Instagram', error);
    if (!localUri || !mimeType) {
      Alert.alert('Could not share', 'This photo could not be prepared for Instagram. Please save it and upload it there.');
      return;
    }

    try {
      const openedFallback = await shareImageFileFallback(localUri, mimeType);
      if (!openedFallback) {
        Alert.alert('Could not share', 'Instagram could not open this photo. Please save it and upload it in Instagram.');
      }
    } catch (fallbackError) {
      console.error('[sharing] failed to open photo share fallback', fallbackError);
      Alert.alert('Could not share', 'Instagram could not open this photo. Please save it and upload it in Instagram.');
    }
  }
}
