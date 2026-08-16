import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import type { ShareOptions, ShareSingleOptions } from 'react-native-share';

import { inferMimeTypeFromUri } from '@/features/media/storage-paths';

const INSTAGRAM_ANDROID_PACKAGE = 'com.instagram.android';
/** Probed with `canOpenURL`, which needs `instagram` declared in
 *  `LSApplicationQueriesSchemes` — the `react-native-share` config plugin adds
 *  it, but only when `expo prebuild` regenerates the native project. */
const INSTAGRAM_IOS_SCHEME = 'instagram://';

/**
 * Opens Instagram with one photo-library asset preselected, leaving Instagram
 * to present its own composer rather than forcing a destination.
 *
 * This replaces the previous `instagram-stories://share` route, which caused
 * both problems being fixed here:
 *
 *  - It is Stories-only by definition, so the user could never choose Reel or
 *    Feed.
 *  - It moves the media through `UIPasteboard`. `InstagramStories.m` in
 *    react-native-share calls `[[UIPasteboard generalPasteboard] setItems:...]`
 *    immediately before opening the URL, and since iOS 16 any cross-app
 *    pasteboard read raises the system "Allow Paste?" prompt. That prompt was
 *    therefore not incidental — it is inherent to Meta's Stories API and
 *    cannot be suppressed while still using it.
 *
 * Handing Instagram an asset identifier moves no data through the pasteboard,
 * and needs no Meta App ID, so the old `source_application` requirement is
 * gone entirely.
 */
const INSTAGRAM_IOS_LIBRARY_SCHEME = 'instagram://library?LocalIdentifier=';

type MediaShareInput = {
  uri: string;
  id?: string | null;
  mediaType?: 'photo' | 'video';
  filename?: string;
  title?: string;
};

function normaliseMediaType(input: MediaShareInput): 'photo' | 'video' {
  if (input.mediaType === 'video') return 'video';
  return inferMimeTypeFromUri(input.uri).startsWith('video/') ? 'video' : 'photo';
}

function filenameFromUri(uri: string, id?: string | null, mediaType: 'photo' | 'video' = 'photo', preferred?: string): string {
  if (preferred) return preferred;
  const path = uri.split(/[?#]/, 1)[0] ?? uri;
  const extension = path.split('.').pop()?.toLowerCase();
  const fallbackExtension = mediaType === 'video' ? 'mp4' : 'jpg';
  const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : fallbackExtension;
  return `${mediaType === 'video' ? 'recap' : 'photo'}-${id || Date.now()}.${safeExtension}`;
}

async function ensureLocalMediaUri(input: MediaShareInput): Promise<string> {
  const { uri, id } = input;
  const mediaType = normaliseMediaType(input);
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  const destinationFile = new FileSystem.File(
    FileSystem.Paths.cache,
    `share-${filenameFromUri(uri, id, mediaType, input.filename)}`,
  );
  const downloaded = await FileSystem.File.downloadFileAsync(uri, destinationFile, {
    idempotent: true,
  });
  return downloaded.uri;
}

async function fetchMediaBlob(input: MediaShareInput): Promise<{ blob: Blob; file: File }> {
  const response = await fetch(input.uri);
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const mediaType = normaliseMediaType(input);
  const mimeType = blob.type || inferMimeTypeFromUri(input.uri) || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
  const file = new File(
    [blob],
    filenameFromUri(input.uri, input.id, mediaType, input.filename),
    { type: mimeType },
  );
  return { blob, file };
}

async function downloadMediaOnWeb(input: MediaShareInput): Promise<void> {
  const { blob, file } = await fetchMediaBlob(input);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

async function shareMediaFileFallback(localUri: string, mimeType: string, mediaType: 'photo' | 'video'): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }

  await Sharing.shareAsync(localUri, {
    dialogTitle: mediaType === 'video' ? 'Share recap' : 'Share photo',
    mimeType,
    UTI: mediaType === 'video' ? 'public.movie' : 'public.image',
  });
  return true;
}

async function shareWebMediaFile(input: MediaShareInput, fallbackTitle: string): Promise<boolean> {
  const nav = window.navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  if (!nav.share) return false;

  const { file } = await fetchMediaBlob(input);
  if (!nav.canShare?.({ files: [file] })) return false;

  await nav.share({
    files: [file],
    title: input.title ?? fallbackTitle,
    text: input.title ?? fallbackTitle,
  });
  return true;
}

export async function shareMediaFile(input: MediaShareInput): Promise<void> {
  void Haptics.selectionAsync().catch(() => {});
  const mediaType = normaliseMediaType(input);

  if (Platform.OS === 'web') {
    try {
      if (await shareWebMediaFile(input, mediaType === 'video' ? 'Event recap' : 'Event photo')) {
        return;
      }
      await downloadMediaOnWeb(input);
      Alert.alert(
        mediaType === 'video' ? 'Recap downloaded' : 'Photo downloaded',
        'Your browser cannot open a file share sheet here. The file has been downloaded so you can upload or send it.',
      );
    } catch (error) {
      console.error('[sharing] failed to share media on web', error);
      Alert.alert('Share unavailable', 'This browser could not prepare the file. Please try downloading it again.');
    }
    return;
  }

  const localUri = await ensureLocalMediaUri(input);
  const mimeType = inferMimeTypeFromUri(localUri);
  try {
    const RNShare = (await import('react-native-share')).default;
    await RNShare.open({
      url: localUri,
      type: mimeType,
      filename: filenameFromUri(localUri, input.id, mediaType, input.filename),
      title: input.title ?? (mediaType === 'video' ? 'Share recap' : 'Share photo'),
      failOnCancel: false,
    } as ShareOptions);
  } catch (error) {
    if (isUserCancel(error)) return;
    console.error('[sharing] failed to open native media share sheet', error);
    const openedFallback = await shareMediaFileFallback(localUri, mimeType, mediaType);
    if (!openedFallback) {
      Alert.alert('Share unavailable', 'This device could not open a file share sheet.');
    }
  }
}

function isUserCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss|did not share/i.test(message);
}

/**
 * The system share sheet, offered ONLY after the guest explicitly asks for it.
 *
 * Never called automatically. Silently degrading into the share sheet is
 * exactly what made "Share to Instagram" indistinguishable from "Share", so
 * the fallback is now a second, deliberate tap rather than something that
 * happens on the guest's behalf.
 */
function offerShareSheetAfterInstagramFailure(
  title: string,
  message: string,
  localUri: string | null,
  mimeType: string | null,
  mediaType: 'photo' | 'video',
): void {
  if (!localUri || !mimeType) {
    Alert.alert(title, message);
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Share another way',
      onPress: () => {
        void shareMediaFileFallback(localUri, mimeType, mediaType)
          .then((opened) => {
            if (!opened) {
              Alert.alert('Share unavailable', 'This device could not open a share sheet.');
            }
          })
          .catch((error) => {
            console.error('[sharing] share-sheet fallback failed', error);
          });
      },
    },
  ]);
}

/**
 * Hands the recap to Instagram and lets Instagram decide what to do with it —
 * deliberately NOT the system share sheet, and deliberately NOT Stories-only.
 *
 * Each platform uses its ordinary media-sharing route rather than Meta's
 * Stories API:
 *
 *  - Android: `ACTION_SEND` with the Instagram package named, so the OS shows
 *    no chooser and Instagram presents its own Story / Reel / Feed options.
 *  - iOS: the recap is written to the photo library and Instagram is opened on
 *    that asset, which is the only pasteboard-free way to point Instagram at a
 *    specific video.
 *
 * The system share sheet is never reached automatically — that was the
 * original bug, where this button behaved identically to plain "Share". It is
 * offered only as an explicit choice after a failure the user needs to resolve
 * (Instagram missing, photo access refused).
 *
 * Note the iOS route saves the recap to the guest's photo library as a side
 * effect. That is inherent to the approach, not incidental: Instagram can only
 * be pointed at library assets.
 */
export async function shareMediaToInstagram(input: MediaShareInput): Promise<void> {
  void Haptics.selectionAsync().catch(() => {});
  const mediaType = normaliseMediaType(input);

  // Instagram exposes no way for a browser to hand media to the Story
  // composer. Rather than pretend, web downloads the file and says so.
  if (Platform.OS === 'web') {
    try {
      if (await shareWebMediaFile(input, mediaType === 'video' ? 'Event recap' : 'Event photo')) return;
      await downloadMediaOnWeb(input);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        mediaType === 'video' ? 'Recap downloaded' : 'Photo downloaded',
        `Browsers cannot send ${mediaType === 'video' ? 'a recap video' : 'a photo'} directly into Instagram here. Upload the downloaded file in Instagram to post it.`,
      );
    } catch (error) {
      console.error('[sharing] failed to prepare Instagram web download', error);
      Alert.alert(
        'Share to Instagram',
        'Your browser could not prepare this file for Instagram. Please download it and upload it in Instagram.',
      );
    }
    return;
  }

  let localUri: string | null = null;
  let mimeType: string | null = null;

  try {
    const RNShare = (await import('react-native-share')).default;

    // Checked before the file is fetched — no point downloading a recap for an
    // app that is not there.
    const instagramInstalled =
      Platform.OS === 'android'
        ? (await RNShare.isPackageInstalled(INSTAGRAM_ANDROID_PACKAGE)).isInstalled
        : await Linking.canOpenURL(INSTAGRAM_IOS_SCHEME);

    if (!instagramInstalled) {
      localUri = await ensureLocalMediaUri(input);
      mimeType = inferMimeTypeFromUri(localUri);
      offerShareSheetAfterInstagramFailure(
        'Instagram not installed',
        'Install Instagram to post this there, or save the file and upload it yourself.',
        localUri,
        mimeType,
        mediaType,
      );
      return;
    }

    // A remote https:// URL cannot be handed to either platform's share path,
    // so the recap is pulled down to the cache first.
    localUri = await ensureLocalMediaUri(input);
    mimeType = inferMimeTypeFromUri(localUri);

    if (Platform.OS === 'android') {
      // `ACTION_SEND` with `setPackage("com.instagram.android")` — see
      // `InstagramShare.java`, which extends `SingleShareIntent`. Naming the
      // package means Android shows no chooser of its own and hands the video
      // straight to Instagram, which then offers Story / Reel / Feed itself.
      // This is the generic media intent, NOT a Stories-specific one, so no
      // pasteboard and no permission prompt are involved.
      await RNShare.shareSingle({
        social: RNShare.Social.INSTAGRAM,
        url: localUri,
        type: mimeType,
        filename: filenameFromUri(localUri, input.id, mediaType, input.filename),
      } as ShareSingleOptions);
      return;
    }

    // iOS has no `ACTION_SEND` equivalent: the only way to open Instagram on a
    // specific piece of media without the pasteboard is to reference an asset
    // already in the photo library. Implemented directly rather than through
    // `RNShare.Social.INSTAGRAM`, whose iOS path builds this same URL but
    // expects a `ph://` identifier and shadows its own `videoDurationSeconds`
    // local, so a `file://` URI silently produces a malformed target.
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) {
      offerShareSheetAfterInstagramFailure(
        'Photos access needed',
        'Instagram can only open a video that is saved to your photo library.',
        localUri,
        mimeType,
        mediaType,
      );
      return;
    }

    let asset: { id: string };
    try {
      // `Asset.create` is the SDK 57 class-based API. The old
      // `createAssetAsync` is not merely deprecated here — it throws at
      // runtime (see `legacyWarnings.ts`), which is what made every attempt
      // fail before Instagram was ever reached. `asset.id` is still the iOS
      // `localIdentifier` (`MediaLibraryUtilities.swift` maps it directly).
      asset = await MediaLibrary.Asset.create(localUri);
    } catch (assetError) {
      // Saving to Photos is the one step here with no user-visible symptom of
      // its own, so a failure was previously indistinguishable from Instagram
      // simply refusing to open.
      throw new Error(
        `could not save to Photos — ${assetError instanceof Error ? assetError.message : String(assetError)}`,
      );
    }

    // `localIdentifier` looks like `<uuid>/L0/001`. Those slashes must be
    // percent-encoded — interpolated raw they terminate the query value early
    // and Instagram receives an identifier that matches no asset.
    const target = `${INSTAGRAM_IOS_LIBRARY_SCHEME}${encodeURIComponent(asset.id)}`;

    const canOpen = await Linking.canOpenURL(target).catch(() => false);
    const openedInstagram = canOpen
      ? await Linking.openURL(target).then(() => true).catch(() => false)
      : false;

    if (openedInstagram) return;

    console.warn(
      `[sharing] instagram://library did not open (canOpenURL=${canOpen}) — falling back to the share sheet`,
    );

    // `instagram://library` is undocumented and newer Instagram builds do not
    // reliably register it, so this cannot be treated as a guaranteed route.
    // Falling through to the share sheet keeps the guest moving — Instagram's
    // own extension still offers Story / Reel / Feed from there — instead of
    // stranding them at a dialog whose only real option is "cancel", which is
    // what the previous version of this branch did.
    const openedSheet = await shareMediaFileFallback(localUri, mimeType, mediaType);
    if (!openedSheet) {
      offerShareSheetAfterInstagramFailure(
        'Could not open Instagram',
        'The recap has been saved to your photos — you can post it from Instagram.',
        localUri,
        mimeType,
        mediaType,
      );
    }
  } catch (error) {
    if (isUserCancel(error)) return;

    console.error('[sharing] Instagram share failed', error);
    // The reason is shown, not just logged. A device-only failure that says
    // nothing about itself is unactionable for the person hitting it and
    // undiagnosable for anyone reading a bug report about it.
    offerShareSheetAfterInstagramFailure(
      'Could not open Instagram',
      `Instagram could not open this recap: ${error instanceof Error ? error.message : String(error)}`,
      localUri,
      mimeType,
      mediaType,
    );
  }
}

export async function sharePhotoToInstagram(photo: MediaShareInput): Promise<void> {
  await shareMediaToInstagram({ ...photo, mediaType: 'photo' });
}
