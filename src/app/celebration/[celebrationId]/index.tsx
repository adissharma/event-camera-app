/**
 * Event Detail Screen — 1:1 Pixel-Refined Editorial Layout
 *
 * Design language: "Ink & Ivory". Photography is the hero.
 * Inspired by Leica, Kinfolk Magazine, Apple Photos, and luxury wedding albums.
 */

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import {
  Animated,
  ActivityIndicator,
  FlatList,
  InteractionManager,
  View,
  Image,
  useWindowDimensions,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
  Share,
  ScrollView,
  Platform,
  PanResponder,
  type ImageSourcePropType,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Asset as ExpoAsset } from 'expo-asset';
import { useEventListener } from 'expo';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { useAuth } from '@/features/auth/context';
import { isBackendConfigured, requireSupabase } from '@/lib/supabase/client';
import { fetchMyProfile, profileKeys, firstNameFrom } from '@/services/profile';
import { shouldShowHostControls } from '@/lib/platform-guards';
import {
  loadStoredGuestSession,
  loadStoredGuestSessionByCelebrationId,
  clearStoredGuestSession,
  guestSessionStorage,
} from '@/services/guest-session';
import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { CloseIcon, LockIcon, PhotoGridIcon, PinIcon, VideoTabIcon } from '@/components/ui/icons';
import { InviteShareSheet } from '@/features/sharing/invite-share-sheet';
import {
  archiveCelebration,
  celebrationDetailKeys,
  fetchCelebrationDetail,
  requestEventRecap,
  type CelebrationDetail,
} from '@/services/celebration-detail';
import { deleteGuestPhoto } from '@/services/guest-media-upload';
import { deleteHostPhoto } from '@/services/media-delete';
import { celebrationKeys } from '@/services/celebrations';
import { listThemes, themeKeys } from '@/services/themes';
import { EventRevealModal } from '@/components/feedback/event-reveal-modal';
import { TreatedPhoto } from '@/components/media/treated-photo';
import { loadSourceImage } from '@/features/media/disposable-cache';
import { renderDisposablePhotoToFile } from '@/features/media/disposable-render';
import { normalisePhotoTreatment } from '@/features/media/photo-treatment';
import { canViewerSeePhotos, msUntilReveal, formatRevealCountdownWords } from '@/features/celebrations/reveal/state';
import { useRevealModal } from '@/features/celebrations/reveal/use-reveal-modal';
import { serverNow } from '@/services/server-time';
import { LOCALE_CONFIG } from '@/config/app-config';
import { BRAND_CONFIG } from '@/config/brand';
import { colours, fontFamilies, radii, spacing, layout } from '@/design';
import { copy } from '@/i18n';
import {
  resolveChallengeBrief,
  ChallengeIconSVG as SharedChallengeIconSVG,
} from '@/features/celebrations/challenge-icons';
import {
  OverflowDotsIcon,
  StoryViewer,
  formatStoryTimestamp,
  playWithSoundFallback,
} from '@/features/celebrations/story-viewer';
import { pinHostPhoto, unpinHostPhoto } from '@/services/media-pin';
import {
  listChallenges,
  updateChallenge,
  legacyChallengesKey,
  type EventChallenge,
} from '@/services/challenges';
import {
  ChallengePacksIntroModal,
  hasSeenChallengePacksIntro,
  markChallengePacksIntroSeen,
} from '@/features/celebrations/challenge-packs-intro-modal';
import { ChallengesEmptyCard } from '@/features/celebrations/challenges-empty-card';
import { useCoverSource, FALLBACK_COVER } from '@/features/celebrations/cover-source';
import { useEventEntitlements } from '@/features/entitlements/use-event-entitlements';
import {
  entitlementsForPlan,
  upgradesForFeature,
  type FeatureKey,
} from '@/features/entitlements/event-entitlements';
import { UpgradeSheet } from '@/features/entitlements/upgrade-sheet';
import { getPaywallPlan } from '@/features/payments/plan-catalogue';
import { createUniqueChannel } from '@/lib/supabase/realtime';
import {
  shareMediaFile,
  shareMediaToInstagram,
  sharePhotoToInstagram,
} from '@/features/sharing/share-to-instagram';

// ─── Layout constants ─────────────────────────────────────────────────────────

const GALLERY_PADDING = 16;
const GALLERY_EDGE_INSET = 0;
/**
 * Blur applied to the copy of the photo that fills the media area behind the
 * sharp one, where the photo's shape does not match the card's.
 *
 * High on purpose: this fill only has to suggest the photo's colour and light.
 * Anything low enough to make its subject legible produces a second image
 * competing with the sharp one in front of it.
 */
const HERO_MEDIA_FILL_BLUR = 45;

/**
 * How long a photo's caption stays up before it fades, and how long a tap
 * buys it back.
 *
 * A caption sitting over a photo indefinitely competes with it the same way
 * the old, unfaded chrome did; letting it go once the viewer has settled and
 * bringing it back on demand keeps the photo itself the point without losing
 * the caption for anyone who wants to read it again.
 */
const HERO_CAPTION_VISIBLE_MS = 1200;

const GRID_GAP = 6;
const ROW_GAP = 6;
/**
 * Columns in the gallery grid.
 *
 * Everything else follows from this: `CELL_W` divides the row by it, `CELL_H`
 * is derived from `CELL_W`, and both the column loop and `getThumbBounds`
 * read it directly — so the cell keeps its 4:5 shape and simply gets bigger,
 * and tap-to-open still starts from the right cell.
 */
const GALLERY_COLUMNS = 2;
const RECAP_MIN_ITEMS = 3;
const RECAP_MAX_ITEMS = 120;
const RECAP_MAX_VIDEOS = 20;
const ENABLE_EVENT_RECAP = false;

/** Challenge selector tiles */
const CHIP_D = 60;
const CHIP_R = 12;
const CHIP_GAP = 12;
const CHIP_PEEK = 18;
const GALLERY_STRIP_GAP = 12;
const CHALLENGE_TILE_ROTATIONS = [
  '-3.5deg',
  '2.75deg',
  '-2deg',
  '3.25deg',
  '-2.75deg',
  '3.5deg',
  '-1.5deg',
  '2.25deg',
] as const;

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

function CheckIcon({ size = 18, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Written out rather than reaching for `StyleSheet.absoluteFillObject`, which
 * this version of React Native (0.86) no longer exports. It evaluated to
 * `undefined`, so every view styled with it was laid out at zero size — which
 * is why the story viewer's touch overlay received no taps or swipes at all.
 */
/** The square brand mark. The wordmark is too wide for the nav's left slot. */
const GALLERY_NAV_MARK = require('../../../../assets/brand/gallery-icon.png');

const ABSOLUTE_FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

// ─── Placeholder image maps ───────────────────────────────────────────────────

// Cover art now resolves through `useCoverSource` in
// `@/features/celebrations/cover-source`, which is the single place that
// turns `celebrations.cover_storage_path` into something renderable. A local
// theme-slug map used to stand in for that here and matched no real cover.

/**
 * How much of the screen the event hero occupies, and the bleed the scrim
 * dissolves through beneath it.
 *
 * Exported because the creation reveal ends on a paywall whose hero has to be
 * the *same* photograph at the *same* size — the cover is supposed to look
 * continuous across that transition, and it only does while both screens agree
 * on this number. They previously agreed by coincidence (0.49 + 24 here,
 * 0.52 there, five points apart on a large phone and drifting on a small one).
 */
export const GALLERY_HERO_RATIO = 0.49;
const HERO_BLEED = 24;

export function galleryHeroHeight(screenHeight: number): number {
  return Math.round(screenHeight * GALLERY_HERO_RATIO) + HERO_BLEED;
}

/** How far the cover travels as the page scrolls, as a fraction of the hero. */
const HERO_PARALLAX_FRACTION = 0.35;

/**
 * The height of the *image* behind the hero, which is taller than the hero
 * itself so there is something to slide as the page scrolls.
 *
 * Exported because it is half of what decides which part of a cover a viewer
 * actually sees: the photograph is fitted to a box this tall and the hero
 * shows the middle of it. Anywhere else that wants to frame a cover the same
 * way — the dashboard's card does — has to fit it to the same shape, or it
 * will centre on the same point of a differently-proportioned box and land
 * somewhere else in the picture.
 */
export function galleryHeroImageHeight(screenHeight: number): number {
  const heroH = Math.round(screenHeight * GALLERY_HERO_RATIO);
  return galleryHeroHeight(screenHeight) + heroH * HERO_PARALLAX_FRACTION;
}

/**
 * The date as the event hero writes it.
 *
 * Exported for the creation reveal, which carries the title and date out of
 * this hero and into the paywall. It must be the same string in both places —
 * a second `Intl.DateTimeFormat` call configured from memory is how "19
 * September 2026" quietly becomes "Sept 19, 2026" halfway through an
 * animation. Timezone matters here: an event closing at midnight local is on
 * a different day in the viewer's zone.
 */
export function formatEventHeroDate(
  endsAt: string | null | undefined,
  timezone: string | null | undefined,
): string | null {
  if (!endsAt) return null;
  try {
    return new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone ?? undefined,
    }).format(new Date(endsAt));
  } catch {
    return null;
  }
}

const GALLERY_PRESETS = [
  { id: 'preset_1', source: require('../../../../assets/images/placeholders/christian_wedding.png') },
  { id: 'preset_2', source: require('../../../../assets/images/placeholders/hindu_wedding.png') },
  { id: 'preset_3', source: require('../../../../assets/images/placeholders/treatment_preview_1.png') },
  { id: 'preset_4', source: require('../../../../assets/images/placeholders/treatment_preview_2.png') },
];

// ─── Challenge data ───────────────────────────────────────────────────────────

export type Challenge = {
  id: string;
  label: string;
  icon: string;
  /**
   * The host's own "Guest instructions" from the edit-challenge screen. Saved
   * per challenge, so it takes precedence over the icon's stock brief — that
   * preset is only a starting point the form pre-fills, not the answer.
   */
  instructions?: string;
  photo?: string | null;
};

/** `event_challenges` row → the shape this screen renders. */
function toScreenChallenge(row: EventChallenge): Challenge {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    instructions: row.instructions ?? undefined,
    photo: row.photoUri,
  };
}

export interface PhotoItem {
  uri: string;
  takenBy: string;
  takenById?: string | null;
  uploadedByUserId?: string | null;
  guestSessionId?: string | null;
  postedAt?: string | null;
  submissionId?: string | null;
  challengeId?: string | null;
  /**
   * The media item's id. Seeds the disposable treatment's per-photo
   * randomisation — deliberately not the URI, which is a signed URL that
   * gets re-issued on expiry and would reshuffle the look each time.
   */
  id?: string;
  /**
   * `uri` stays the real image URL even while locked — this flag alone
   * drives the blur + lock icon (see `visiblePhotos`), so what's blurred is
   * genuinely the photo itself, not a substituted placeholder.
   */
  locked?: boolean;
  /** What the disposable treatment's date stamp reads. Absent for mock photos. */
  capturedAt?: string | null;
  /** True when this visible real media item belongs to the current guest token. */
  isMine?: boolean;
  isPinned?: boolean;
  is_pinned?: boolean;
  pinnedAt?: string | null;
  caption?: string | null;
  mediaType?: 'photo' | 'video';
  durationMs?: number | null;
  mimeType?: string | null;
  /**
   * A small stored poster frame for a video (see `video-thumbnail.ts` /
   * `20260815120000_video_thumbnails.sql`). Grid cells use this instead of
   * mounting a real video player. Undefined/null for a photo, or for a
   * video that has none yet (older items, or a thumbnail that failed to
   * generate/upload without blocking the post itself) — those fall back to
   * `VideoPoster`'s existing video-as-poster behaviour.
   */
  thumbnailUri?: string | null;
}

type PendingChallengePost = {
  challengeId: string;
  mediaItemId?: string | null;
  localUri?: string | null;
  mediaType?: 'photo' | 'video';
  postedAt?: string | null;
  caption?: string | null;
  durationMs?: number | null;
  mimeType?: string | null;
};

function parsePendingChallengePost(raw: string | null): PendingChallengePost | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingChallengePost;
    if (typeof parsed?.challengeId === 'string' && parsed.challengeId.length > 0) {
      return parsed;
    }
  } catch {
    // Older camera builds stored just the challenge id.
  }
  return { challengeId: raw };
}

type SavePhotoItem = {
  key: string;
  uri: string;
  source: ImageSourcePropType | null;
  takenBy: string;
  isChallenge: boolean;
  challengeLabel?: string;
  seedKey: string;
  capturedAt?: string | null;
  mediaType?: 'photo' | 'video';
  durationMs?: number | null;
};

type RecapSelectionItem = SavePhotoItem & {
  mediaId: string;
  challengeId?: string | null;
};

function getLimitedRecapSelectionKeys(items: RecapSelectionItem[]) {
  const keys: string[] = [];
  let videoCount = 0;
  for (const item of items) {
    if (keys.length >= RECAP_MAX_ITEMS) break;
    if (item.mediaType === 'video') {
      if (videoCount >= RECAP_MAX_VIDEOS) continue;
      videoCount += 1;
    }
    keys.push(item.key);
  }
  return keys;
}

type FilteredCaptureState = {
  item: SavePhotoItem;
  source: ImageSourcePropType;
  width: number;
  height: number;
  onReady: () => void;
  onError: (error: unknown) => void;
} | null;

// Stock briefs live in `@/features/celebrations/challenge-icons` and are read
// through `resolveChallengeBrief`, which also normalises legacy icon names and
// OpenMoji hexcodes. A second copy used to sit here and had drifted to a subset
// of the shared one, so the two surfaces disagreed about a challenge's brief.

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#FFFFFF"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Custom Back icon for edit modal
function BackIcon({ size = 24, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M19 12H5M12 19l-7-7 7-7" 
        stroke={color} 
        strokeWidth={2.5} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

// Custom Cog icon for edit modal
function CogIcon({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareTrayIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SettingsIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CameraFABIcon({ size = 26, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled camera body */}
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        fill={color}
      />
      {/* Outer lens cutout (matches warm ivory FAB background) */}
      <Circle
        cx={12}
        cy={13}
        r={4.2}
        fill="#EFE9E0"
      />
      {/* Inner lens center (black filled) */}
      <Circle
        cx={12}
        cy={13}
        r={2.2}
        fill={color}
      />
    </Svg>
  );
}

// ─── Challenge icon SVG (monochrome warm ivory line art) ──────────────────────

const ICON_COLOR = '#EFE9E0';
const ICON_W = 1.5;

function ChallengeIconSVG({ type, size = 28 }: { type: string; size?: number }) {
  const c = ICON_COLOR;
  const w = ICON_W;
  const lc = 'round' as const;
  const lj = 'round' as const;

  const icons: Record<string, React.ReactNode> = {
    firstDance: (
      <>
        <Circle cx={8} cy={5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={16} cy={5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M8 7c-1.5.5-2 1.5-2 3L5 14l1.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 7c1.5.5 2 1.5 2 3l.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M16 7c1.5.5 2 1.5 2 3l1 4-1.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M16 7c-1.5.5-2 1.5-2 3l-.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M10 10l4 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    rings: (
      <>
        <Path d="M6 12a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M9 12a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    group: (
      <>
        <Circle cx={12} cy={5} r={2.2} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={5.5} cy={7.5} r={1.8} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={18.5} cy={7.5} r={1.8} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M8 21c0-3.5 1.8-5 4-5s4 1.5 4 5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M3 21c0-2.5 1-4 2.5-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M21 21c0-2.5-1-4-2.5-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    decor: (
      <>
        <Path d="M12 21V11" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M12 11c0 0-5-3.5-5-7a5 5 0 0 1 10 0c0 3.5-5 7-5 7z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 15c-3 1.5-5.5 0-5.5 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M12 15c3 1.5 5.5 0 5.5 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    candle: (
      <>
        <Path d="M12 3c0 0-1.5 1.5-1.5 3.5S11.2 9 12 9s1.5-.8 1.5-2.5S12 3 12 3z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Rect x={9} y={9} width={6} height={12} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M9.5 13.5h5" stroke={c} strokeWidth={0.8} strokeLinecap={lc} strokeDasharray="1 1.5" />
      </>
    ),
    champagne: (
      <>
        <Path d="M9 3h6L13 12h-2L9 3z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 12v7" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M8.5 19h7" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M11 7.5v.5M13 6v.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    cake: (
      <>
        <Rect x={7} y={6} width={10} height={5} rx={0.5} stroke={c} strokeWidth={w} fill="none" />
        <Rect x={4} y={11} width={16} height={8} rx={0.5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 3.5v2.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M11 3.5c0 0 .5-1 1-1s1 1 1 1" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 11v8M12 11v8M16 11v8" stroke={c} strokeWidth={0.6} strokeLinecap={lc} />
      </>
    ),
    bouquet: (
      <>
        <Circle cx={12} cy={6} r={2.5} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={7} cy={9.5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={17} cy={9.5} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 8.5V18M8.5 11.5V18M15.5 11.5V18" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M8 17.5h8" stroke={c} strokeWidth={1.5} fill="none" strokeLinecap={lc} />
      </>
    ),
    gift: (
      <>
        <Rect x={4} y={9} width={16} height={11} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 9v11" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M4 13h16" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M12 9c0 0-3-1.5-3-4a2 2 0 0 1 4 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 9c0 0 3-1.5 3-4a2 2 0 0 0-4 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    confetti: (
      <>
        <Path d="M12 3l1 4-3.5-2.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M20 8l-3.5 1.5 1-3.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M18 16l-4-1 2.5-3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 20l-.5-4 3.5 2" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M4 13l3-2.5-.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Circle cx={12} cy={12} r={2} stroke={c} strokeWidth={w} fill="none" />
      </>
    ),
    birthday: (
      <>
        <Path d="M12 3c0 0-1.5 1.5-1.5 3.5S11.2 9 12 9s1.5-.8 1.5-2.5S12 3 12 3z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Circle cx={12} cy={14} r={6} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 10v4M8 14h8" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    babyShower: (
      <>
        <Path d="M12 3c-3 2-4 5-4 8 0 4 2 6 4 8s4-4 4-8c0-3-1-6-4-8z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 7v4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Circle cx={12} cy={11} r={1} fill={c} />
      </>
    ),
    bridalShower: (
      <>
        <Circle cx={12} cy={5} r={2.5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 7.5v3L8 14l8 2 2-4v-3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M9 18h6" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    engagement: (
      <>
        <Circle cx={10} cy={12} r={3} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={14} cy={12} r={3} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={8} cy={12} r={0.8} fill={c} />
        <Circle cx={16} cy={12} r={0.8} fill={c} />
      </>
    ),
    graduation: (
      <>
        <Rect x={8} y={8} width={8} height={6} rx={0.5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 14v3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M8 8L6 5l2-1 10 0 2 1-2 3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    housewarming: (
      <>
        <Path d="M4 14h16" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M6 14v4c0 1 0 2 1 2h10c1 0 1-1 1-2v-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 4l-8 10h16z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M10 10h4v4h-4z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    bachelorette: (
      <>
        <Circle cx={12} cy={6} r={2} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M8 10c-1 1-1.5 2-1.5 4 0 2 1 3 1.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 9v9" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M16 10c1 1 1.5 2 1.5 4 0 2-1 3-1.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    anniversary: (
      <>
        <Path d="M6 12a6 6 0 1 0 12 0 6 6 0 0 0-12 0" stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 9v6l-3-3 6 0-3 3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    reunion: (
      <>
        <Circle cx={8} cy={7} r={1.5} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={12} cy={6} r={1.8} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={16} cy={7} r={1.5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M7 9c-1 1.5-1.5 3-1.5 5 0 3 1 4 5 4s5-1 5-4c0-2-.5-3.5-1.5-5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    cocktail: (
      <>
        <Path d="M9 4h6l-2 8H11l-2-8z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 12v4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M10 16h4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Circle cx={9.5} cy={5} r={0.6} fill={c} />
      </>
    ),
    conference: (
      <>
        <Rect x={5} y={7} width={14} height={10} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M5 10h14" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M12 12l-3-1 3 2 3-1" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 14v2M12 14v2M16 14v2" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    teamBuilding: (
      <>
        <Circle cx={6} cy={8} r={1.5} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={12} cy={7} r={1.8} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={18} cy={8} r={1.5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M6 10c-1 1.5-1.5 2.5-1.5 4 0 2 .5 3 1.5 3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 9c-2 1-2.5 3-2.5 5 0 2.5 1 4 2.5 4s2.5-1.5 2.5-4c0-2-.5-4-2.5-5" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M18 10c1 1.5 1.5 2.5 1.5 4 0 2-.5 3-1.5 3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    gala: (
      <>
        <Path d="M8 6l2-2 2 2 2-2 2 2" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Rect x={7} y={8} width={10} height={10} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 11l-2 4 2-2 2 2-2-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    awards: (
      <>
        <Path d="M12 3l2 4h4.5l-3.5 2.5 1 4.5L12 13l-3.5 2.5 1-4.5-3.5-2.5H10l2-4z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M12 15v3" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M10 18h4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    productLaunch: (
      <>
        <Rect x={6} y={9} width={12} height={8} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 5v4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M10 6l2-2 2 2" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M9 12h6M9 15h6" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    networking: (
      <>
        <Circle cx={8} cy={8} r={1.5} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={12} cy={6} r={1.5} stroke={c} strokeWidth={w} fill="none" />
        <Circle cx={16} cy={8} r={1.5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M8 10l2 2M12 8l0 4M16 10l-2 2" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M8 12h8" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
      </>
    ),
    retreat: (
      <>
        <Path d="M12 4l-6 4v8h12v-8l-6-4z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M9 12h6" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M10 12v4h4v-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    training: (
      <>
        <Rect x={6} y={8} width={12} height={9} rx={1} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M6 11h12" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M8 13l2 2 3-4M14 13l2 2 3-4" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    holiday: (
      <>
        <Path d="M12 3l2 4h4l-3 2 1 4-4-3-4 3 1-4-3-2h4l2-4z" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
        <Path d="M9 11c-1 0-2 1-2 2s1 2 2 2M15 11c1 0 2 1 2 2s-1 2-2 2" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} strokeLinejoin={lj} />
      </>
    ),
    sports: (
      <>
        <Circle cx={12} cy={12} r={5} stroke={c} strokeWidth={w} fill="none" />
        <Path d="M12 8v8M8 12h8" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} />
        <Path d="M9 9l6 6M15 9l-6 6" stroke={c} strokeWidth={0.8} fill="none" strokeLinecap={lc} />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icons[type] ?? icons.confetti}
    </Svg>
  );
}

function GuestbookIcon({ size = 24, color = '#EFE9E0' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 7h6M9 11h6M9 15h4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function formatMediaDuration(durationMs?: number | null): string | null {
  if (!durationMs || durationMs <= 0) return null;
  const totalSeconds = Math.ceil(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

function VideoPoster({
  uri,
  style,
  controls = false,
  autoPlay = false,
  muted = true,
  contentFit = 'cover',
  onEnd,
}: {
  uri: string;
  style?: any;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  contentFit?: 'contain' | 'cover';
  onEnd?: () => void;
}) {
  const containerRef = useRef<any>(null);
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = false;
    instance.muted = muted;
    if (autoPlay) {
      // The container ref is not attached yet on this very first call (it
      // fires before mount commits), so this attempt just falls through to
      // a plain `play()` — the `statusChange` listener below is what
      // actually lands the (sound-aware) attempt once the video is ready.
      playWithSoundFallback(containerRef.current, instance);
      return;
    }
    instance.pause();
  });

  // `player.play()` before the source has finished loading is a no-op with
  // no retry, so a video that was not already buffered — the common case for
  // a signed URL fetched fresh — would otherwise sit paused forever despite
  // `autoPlay`. This is what was making gallery videos fail to autoplay.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'readyToPlay' || !autoPlay) return;
    playWithSoundFallback(containerRef.current, player);
  });

  useEventListener(player, 'playToEnd', () => {
    player.pause();
    onEnd?.();
  });

  return (
    <View ref={containerRef} style={style}>
      <VideoView
        player={player}
        /**
         * Explicit 100%/100% rather than `absoluteFill`, for the same reason
         * `background-video.tsx` already does it.
         *
         * `absoluteFill` is `position: absolute` plus zeroed insets and no
         * width or height. A `<div>` stretches to fill under those rules, but
         * `<video>` is a *replaced* element, and CSS resolves an auto-sized
         * replaced element to its intrinsic dimensions and then ignores the
         * over-constrained insets. So on web the element laid itself out at
         * the video's full pixel size — 1080x1920 for a phone recording —
         * inside whatever box it was given, and the parent's `overflow:
         * hidden` cropped that down to the top-left corner. `contentFit` could
         * not help: `object-fit` only does anything when the element box
         * differs from the content, and here they were identical.
         *
         * Native was never affected — it does not lay out through CSS — and
         * full-screen looked right because the fullscreen API sizes the
         * element itself instead of leaving it auto.
         */
        style={{ width: '100%', height: '100%' }}
        contentFit={contentFit}
        nativeControls={controls}
      />
    </View>
  );
}

function RecapVideoModal({
  visible,
  uri,
  celebrationTitle,
  onClose,
}: {
  visible: boolean;
  uri: string;
  celebrationTitle?: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const title = celebrationTitle ? `${celebrationTitle} recap` : 'Event recap';
  const shareInput = {
    uri,
    id: 'event-recap',
    mediaType: 'video' as const,
    filename: 'event-recap.mp4',
    title,
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      {/*
        A plain flex column — header, stage, actions — rather than a stage with
        hardcoded padding and absolutely-positioned chrome on top of it. The
        previous version reserved 132pt at the bottom for an action block that
        actually stood 166pt tall once the home-indicator inset was added, and
        forced the video to a 9/16 box taller than the space left for it, so the
        buttons and the video overlapped on every standard iPhone. Sizing the
        stage with `flex: 1` between two natural-height siblings means the
        overlap cannot come back on a screen size nobody tested.
      */}
      <View style={S.recapViewerRoot}>
        <View style={[S.recapViewerHeader, { paddingTop: insets.top + spacing.md }]}>
          <View style={S.recapViewerHeaderText}>
            <AppText variant="eyebrow" tone="secondary">Recap</AppText>
            <AppText variant="titleLarge" numberOfLines={1}>
              {celebrationTitle ?? 'Event story'}
            </AppText>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close recap"
            style={({ pressed }) => [S.recapViewerCloseButton, pressed && { opacity: 0.7 }]}
          >
            <CloseXIcon size={20} color={colours.textPrimary} />
          </Pressable>
        </View>

        <View style={S.recapViewerStage}>
          {/*
            Fills the stage and lets `contentFit="contain"` letterbox inside it.
            The recap is always rendered 1080x1920 (see `api/recap-worker.ts`),
            but pinning the container to that ratio is what made it overflow —
            containing it inside whatever space is actually free is correct for
            any output ratio the worker might produce later.
          */}
          <VideoPoster
            uri={uri}
            style={S.recapViewerVideo}
            controls
            autoPlay
            muted={false}
            contentFit="contain"
          />
        </View>

        <View style={[S.recapViewerActions, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/*
            Native only. Instagram has no web share target and no way to accept
            a file from a browser, so on web this button ran exactly the same
            code as "Share" below — the Web Share API, then a download — and
            differed only in its wording. Offering it there promises a direct
            hand-off to Instagram that cannot exist, and reproduces the very
            "two buttons, one behaviour" problem this screen was fixed for.
            Mobile web still reaches Instagram if the guest picks it out of the
            OS share sheet, which is what "Share" already opens.
          */}
          {Platform.OS !== 'web' ? (
            <Pressable
              style={({ pressed }) => [
                S.recapViewerActionButton,
                S.recapViewerPrimaryButton,
                pressed && { backgroundColor: colours.brandPressed },
              ]}
              onPress={() => void shareMediaToInstagram(shareInput)}
              accessibilityRole="button"
              accessibilityLabel="Share recap to Instagram"
            >
              {/* Ink on ivory. This was white-on-ivory — about 1.1:1 — which is
                  why the primary button read as blank. */}
              <InstagramStoryIcon size={20} color={colours.textOnBrand} />
              <AppText variant="labelLarge" tone="onBrand">Share to Instagram</AppText>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              S.recapViewerActionButton,
              // With no Instagram button above it on web, Share is the only
              // action left, so it takes the primary treatment rather than
              // sitting there as a lone outlined secondary.
              Platform.OS === 'web' ? S.recapViewerPrimaryButton : S.recapViewerSecondaryButton,
              pressed && {
                backgroundColor:
                  Platform.OS === 'web' ? colours.brandPressed : colours.surfaceRaised,
              },
            ]}
            onPress={() => void shareMediaFile(shareInput)}
            accessibilityRole="button"
            accessibilityLabel="Share recap"
          >
            <ShareExportIcon
              size={20}
              color={Platform.OS === 'web' ? colours.textOnBrand : colours.textPrimary}
            />
            <AppText variant="labelLarge" tone={Platform.OS === 'web' ? 'onBrand' : 'primary'}>
              Share
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}


// ─── Route entry ──────────────────────────────────────────────────────────────

export default function CelebrationDashboard({ celebrationId: propCelebrationId }: { celebrationId?: string } = {}) {
  const { celebrationId: paramCelebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const celebrationId = propCelebrationId || paramCelebrationId;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
    refetchInterval: isBackendConfigured ? 10000 : false,
  });

  const archive = useMutation({
    mutationFn: () => archiveCelebration(String(celebrationId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
      router.replace('/home');
    },
  });

  if (isLoading) {
    return (
      <View style={S.loadingRoot}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <AppText variant="displayLarge">{copy.common.somethingWentWrong}</AppText>
          <AppText variant="bodySmall" tone="secondary">{(error as Error)?.message}</AppText>
          <Pressable style={S.fallbackBtn} onPress={() => void refetch()}>
            <AppText style={S.fallbackBtnText}>{copy.common.retry}</AppText>
          </Pressable>
          <Pressable onPress={() => router.replace('/home')} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <AppText variant="bodySmall" tone="secondary">Back to home</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <EventDetailView
      detail={data}
      onArchive={() => archive.mutate()}
      archiving={archive.isPending}
    />
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

/**
 * Renders this screen as a still, inert replica of itself.
 *
 * The creation reveal shows the host their event before they have paid for
 * it, and it has to be *this* screen — not a reconstruction of it. A separate
 * mock drifts the first time anyone changes a gutter here, and it did: the
 * hand-built version had its own stat strip, its own chip metrics and its own
 * grid, all of which stopped matching within a single session's work.
 *
 * So the reveal mounts this component and hands it one of these. It is the
 * single place preview behaviour is expressed:
 *
 *   - `photos` and `challenges` seed the state directly, and every loader
 *     that would otherwise overwrite them is skipped;
 *   - nothing reaches the network, the realtime channels, or AsyncStorage, so
 *     no demo content can be persisted and no fake event id is ever queried;
 *   - the tree is rendered `pointerEvents="none"`, which is what makes the
 *     preview non-interactive — one property rather than a disabled prop on
 *     every tile, chip and control that a later edit could forget.
 */
export interface EventPreviewMode {
  /** Stand-in gallery media. `GALLERY_PRESETS` ids resolve to bundled assets. */
  photos: PhotoItem[];
  /** Stand-in challenges, shown through the real chip row. */
  challenges: Challenge[];
  /**
   * Reports the date-and-title block's position in window coordinates once it
   * has laid out.
   *
   * The reveal animates that block from here into the paywall hero. Measuring
   * it means the starting point is wherever this screen actually puts it — if
   * the hero composition changes, the animation follows instead of starting
   * from a number someone copied across.
   */
  onHeroIdentityLayout?: (rect: { x: number; y: number; width: number; height: number }) => void;
  /**
   * Opacities the reveal drives, applied to parts of this hero.
   *
   * This is how the paywall is reached without ever touching the cover. The
   * photograph is never faded, moved, scaled or recropped — it is the same
   * `<Image>`, at the same size, for the whole sequence. What changes around
   * it is the scrim (this screen's vertical ramp fading out as the paywall's
   * horizontal one fades in over the top) and the chrome (nav row and hero
   * text) leaving so the purchase copy can take their place.
   */
  overlays?: {
    /** This screen's vertical cover ramp. Fades out as the paywall's fades in. */
    scrimOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
    /** Nav row and hero text — everything over the cover that is not the cover. */
    chromeOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
  };
  /**
   * Horizontal offset for the challenge strip, so the reveal can nudge it.
   *
   * The strip holds the guestbook tile and every challenge, and it scrolls —
   * but on a still preview nothing says so, and the tiles that run off the
   * right edge simply look cropped. A short slide and return shows there is
   * more there, which is the same thing the theme carousel and the treatment
   * carousel already do on arrival, with the same travel and the same timing.
   */
  chipStripNudge?: Animated.AnimatedInterpolation<number> | Animated.Value;
}

/**
 * The mark on a feature the host can see but has not bought.
 *
 * Deliberately small and unlabelled — a padlock reads instantly, where a
 * "Stories+" pill would put pricing into a row of event features. The
 * explanation belongs on the upgrade sheet the tap opens, not here.
 */
function LockedBadge() {
  return (
    <View style={S.lockedBadge} pointerEvents="none">
      <LockIcon size={11} color="#EFE9E0" />
    </View>
  );
}

export function EventDetailView({
  detail,
  onArchive,
  archiving,
  previewMode,
}: {
  detail: CelebrationDetail;
  onArchive: () => void;
  archiving: boolean;
  previewMode?: EventPreviewMode;
}) {
  const router = useRouter();
  const { openPhotoId, videoPostedAt, photoPostedAt, openChallengeId, openChallengeMediaId, challengePostedAt } = useLocalSearchParams<{
    openPhotoId?: string;
    videoPostedAt?: string;
    photoPostedAt?: string;
    openChallengeId?: string;
    openChallengeMediaId?: string;
    challengePostedAt?: string;
  }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { celebration, primarySession, metrics, viewerRole, mediaPhotos, recap } = detail;

  const handleGalleryBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/home');
  }, [navigation, router]);

  // The one cover for this event, shared with the dashboard card and the guest
  // invitation. Re-signs automatically when the host replaces it, because a
  // replacement writes a new storage path.
  const coverSource = useCoverSource(celebration.cover_storage_path);

  const { session } = useAuth();

  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
    enabled: isBackendConfigured && !!session,
  });
  
  // Dev Override Role check
  const [devRole, setDevRole] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [videoPostedToastVisible, setVideoPostedToastVisible] = useState(false);
  const [photoPostedToastVisible, setPhotoPostedToastVisible] = useState(false);
  const [recapVisible, setRecapVisible] = useState(false);
  const lastVideoPostedToastRef = useRef<string | null>(null);
  const lastPhotoPostedToastRef = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('__dev_role').then(setDevRole);
  }, []);

  // `viewerRole === 'guest'` is authoritative and wins over everything below:
  // it means this detail came from the guest RPC path (see
  // `fetchCelebrationDetail`), which never returns `celebration.created_by` —
  // so the `session.user.id === celebration.created_by` comparison further
  // down would otherwise default an anonymous guest to host on a `null`
  // mismatch it cannot reliably make either way.
  //
  // Declared before the effect below, which reads `isHost` in its dependency
  // array: that array is evaluated synchronously during render, so having it
  // declared later in the same scope was a real `ReferenceError` (temporal
  // dead zone), not just a lint complaint — it threw unconditionally, for
  // every viewer, on every render, with no error boundary to catch it. That
  // is the blank-screen bug a guest hit immediately after joining.
  const roleIsHost = viewerRole === 'guest'
    ? false
    : (devRole === 'guest'
        ? false
        : (devRole === 'host'
            ? true
            : (!isBackendConfigured
                ? true
                : (profile?.id ? profile.id === celebration.created_by : (session ? session.user.id === celebration.created_by : true))
              )
          )
      );

  // On web, never show host controls. On native, respect the user's role.
  const isHost = shouldShowHostControls(roleIsHost ? 'host' : 'guest');

  /*
   * What this event's package allows.
   *
   * Skipped in preview mode, which is the creation reveal selling the product
   * — it shows the full feature set on purpose, and a lock badge in the middle
   * of a sales pitch would be an odd thing to ship.
   */
  const liveEntitlements = useEventEntitlements(previewMode ? null : celebration.id);
  const entitlements = previewMode
    ? entitlementsForPlan(getPaywallPlan('stories_plus'))
    : liveEntitlements;

  /**
   * The upgrade the host has asked for, if any.
   *
   * `onUnlocked` is what makes an upgrade feel like a step rather than a
   * detour: it carries the thing the host was originally reaching for, so
   * buying Stories+ to add a challenge opens challenge creation instead of
   * dropping them back on the gallery to find it again.
   */
  const [upgradeRequest, setUpgradeRequest] = useState<{
    title: string;
    feature: FeatureKey;
    onUnlocked?: () => void;
  } | null>(null);

  const requestUpgrade = useCallback(
    (feature: FeatureKey, title: string, onUnlocked?: () => void) => {
      void Haptics.selectionAsync().catch(() => {});
      setUpgradeRequest({ feature, title, onUnlocked });
    },
    [],
  );

  // Load guest name if this device joined as a guest
  useEffect(() => {
    if (!celebration || isHost) return;
    void loadStoredGuestSession(celebration.public_slug ?? celebration.id).then((session) => {
      if (session?.displayName) {
        setGuestName(session.displayName);
      }
    });
  }, [celebration, isHost]);

  /*
   * Guestbook and Challenges are Stories+ features, and the two audiences are
   * treated oppositely on purpose.
   *
   * The host sees them whether or not the package includes them, because the
   * host is the person who can buy them — hiding a feature from the only
   * person able to unlock it is how it never gets sold. A guest sees them only
   * if the event actually has them: a guest has nothing to buy, so a lock is
   * pure noise, and it would also tell them what their host chose to spend,
   * which is none of their business.
   */
  const guestbookUnlocked = entitlements.has('guestbook');
  const challengesUnlocked = entitlements.has('challenges');
  const showGuestbook = isHost
    ? detail.hasAudioGuestbook !== false || !guestbookUnlocked
    : guestbookUnlocked && detail.hasAudioGuestbook !== false;
  /** True when the host is being shown something they cannot yet use. */
  const showingLockedFeatures = isHost && (!guestbookUnlocked || !challengesUnlocked);

  // Guests can't swipe back out of the event (see the `gestureEnabled` below)
  // — a guest who joins by mistake, or wants to switch events, needs an
  // explicit way out. Confirmed because it's easy to graze this control while
  // reaching for something else in a one-handed grip. Clearing the stored
  // session only forgets it locally: the guest's server-side row and their
  // photos are untouched, and re-entering the same code recognises this
  // device again — see `join_event_by_code`'s device-fingerprint reuse.
  function handleLeaveEvent() {
    Alert.alert('Leave this event?', 'You can rejoin any time with the same event code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          void clearStoredGuestSession(celebration.public_slug ?? celebration.id).then(() => {
            router.replace('/j');
          });
        },
      },
    ]);
  }

  // ── Dimensions Hook (Fully Reactive to Hot Reloads and Screen Orientations) ──
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Fit five selector tiles and leave a small preview of the next tile.
  const selectorTileSize = Math.max(
    56,
    Math.min(72, (screenWidth - GALLERY_PADDING - CHIP_GAP * 4 - CHIP_PEEK) / 5.35),
  );

  // Dynamic layout calculations inside component. The two figures the
  // creation reveal also needs are hoisted to module scope (see
  // `galleryHeroHeight`) so that screen cannot hold a second opinion about how
  // tall this hero is.
  const HERO_H = Math.round(screenHeight * GALLERY_HERO_RATIO);
  const HERO_TOTAL = galleryHeroHeight(screenHeight);
  const PARALLAX_RANGE = HERO_H * HERO_PARALLAX_FRACTION;
  const IMG_H = galleryHeroImageHeight(screenHeight);
  const IMG_TOP = -PARALLAX_RANGE / 2;
  const SCRIM_SOLID_AT = 1 - HERO_BLEED / HERO_TOTAL;

  // Scrim ramp stop builders using semantic color token
  const scrimStop = (alpha: number) => {
    const hex = colours.background.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const SCRIM_COLORS = [
    scrimStop(0),
    scrimStop(0),
    scrimStop(0.55),
    scrimStop(0.85),
    scrimStop(0.98),
    scrimStop(1),
    scrimStop(1),
  ] as const;

  const SCRIM_LOCATIONS = [
    0,
    0.30 * SCRIM_SOLID_AT,
    0.48 * SCRIM_SOLID_AT,
    0.64 * SCRIM_SOLID_AT,
    0.82 * SCRIM_SOLID_AT,
    SCRIM_SOLID_AT,
    1,
  ] as const;

  const CELL_W =
    (screenWidth - GALLERY_EDGE_INSET * 2 - GRID_GAP * (GALLERY_COLUMNS - 1)) /
    GALLERY_COLUMNS;
  // 4:5 — portrait, but the shallow kind a photo grid wants rather than the
  // 9:16 of a full phone screen. At 16/9 a cell stood 1.78x its own width, so
  // barely two rows cleared the fold and the grid read as a stack of slivers.
  // 1.25x is the ratio Instagram settled on for the same reason: still clearly
  // vertical, but short enough that a row of three scans as a row.
  //
  // Only the frame changes. Cells draw their media with `resizeMode="cover"`,
  // so a photo recrops to the new shape instead of squashing into it, and
  // nothing downstream reads the ratio — `getThumbBounds` and
  // `heroStartBounds` both derive from CELL_H, so the open animation keeps
  // starting from the cell the user actually tapped.
  const CELL_H = CELL_W * (5 / 4);

  // ── State ──
  const [photos, setPhotos] = useState<PhotoItem[]>(() => previewMode?.photos ?? []);
  /**
   * Which media type the grid currently shows. Photos carry a filter
   * (Original/Monochrome/Disposable) and videos never do, so a grid mixing
   * the two reads as inconsistent — a black-and-white photo beside an
   * unfiltered video looks like a bug. Splitting the grid into tabs, the way
   * Instagram separates Posts from Reels, keeps each visually coherent.
   *
   * The hero viewer respects the same split: opening a photo and swiping
   * only ever reaches other photos, and likewise for videos — see
   * `heroMediaTrack` below, which is what actually enforces that boundary
   * once the viewer is open.
   */
  const [galleryTab, setGalleryTab] = useState<'photos' | 'videos'>('photos');

  /**
   * The grid's contents: revealed-for-this-viewer and pinned-first, in the
   * same order the grid itself renders. Hoisted to component scope, rather
   * than recomputed inline where the grid draws, because the hero viewer
   * needs this same list to know what "the next photo" or "the last video"
   * means — see `heroPhotosOnly`/`heroVideosOnly` below.
   */
  const visibleGalleryItems = useMemo(
    () =>
      photos
        .filter((p) => {
          if (isHost) return true;
          if (p.isMine) return true;
          return !primarySession?.reveal_at || new Date(primarySession.reveal_at).getTime() <= Date.now();
        })
        .sort((a, b) => {
          const aPin = Boolean(a.isPinned || a.is_pinned);
          const bPin = Boolean(b.isPinned || b.is_pinned);
          if (aPin !== bPin) return aPin ? -1 : 1;
          const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
          const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
          if (aPin && bPin && aTime !== bTime) return bTime - aTime;
          return 0;
        }),
    [photos, isHost, primarySession?.reveal_at],
  );
  const heroPhotosOnly = useMemo(
    () => visibleGalleryItems.filter((p) => p.mediaType !== 'video'),
    [visibleGalleryItems],
  );
  const heroVideosOnly = useMemo(
    () => visibleGalleryItems.filter((p) => p.mediaType === 'video'),
    [visibleGalleryItems],
  );
  const showMediaTabs = heroVideosOnly.length > 0 && heroPhotosOnly.length > 0;
  /**
   * Which of the two lists above the hero viewer is currently paging
   * through. Set once, when a photo is tapped open (see `handlePhotoPress`),
   * from the media type of the item that was tapped — and never changed
   * afterwards for the life of that viewing session, which is exactly what
   * keeps a swipe from crossing from a photo into a video or back.
   */
  const [heroMediaTrack, setHeroMediaTrack] = useState<'photo' | 'video'>('photo');
  const heroNavPhotos = heroMediaTrack === 'video' ? heroVideosOnly : heroPhotosOnly;
  const [challenges, setChallenges] = useState<Challenge[]>(() => previewMode?.challenges ?? []);
  const [challengePacksIntroVisible, setChallengePacksIntroVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSaving, setSaveSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'original' | 'filtered'>('original');
  const [saveItems, setSaveItems] = useState<SavePhotoItem[]>([]);
  const [selectedSaveKeys, setSelectedSaveKeys] = useState<string[]>([]);
  const [recapSelectionVisible, setRecapSelectionVisible] = useState(false);
  const [recapCreating, setRecapCreating] = useState(false);
  const [recapMode, setRecapMode] = useState<'original' | 'filtered'>('original');
  const [recapItems, setRecapItems] = useState<RecapSelectionItem[]>([]);
  const [selectedRecapKeys, setSelectedRecapKeys] = useState<string[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [challengeMenuVisible, setChallengeMenuVisible] = useState(false);
  const [challengeDeleteConfirmVisible, setChallengeDeleteConfirmVisible] = useState(false);
  const filteredCaptureRef = useRef<View | null>(null);
  const [filteredCaptureState, setFilteredCaptureState] = useState<FilteredCaptureState>(null);
  const selectedChallengeRef = useRef<Challenge | null>(null);
  const challengeStoryCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const challengeViewerSessionRef = useRef(0);
  const pendingChallengePostRef = useRef<PendingChallengePost | null>(null);
  const lastChallengePostedAtRef = useRef<string | null>(null);
  const [guestAuth, setGuestAuth] = useState<{
    slug: string;
    guestToken: string;
    guestSessionId: string;
  } | null>(null);

  useEffect(() => {
    if (viewerRole !== 'guest') {
      setGuestAuth(null);
      return;
    }

    let cancelled = false;
    void loadStoredGuestSessionByCelebrationId(celebration.id)
      .then((found) => {
        if (cancelled) return;
        setGuestAuth(
          found
            ? {
                slug: found.slug,
                guestToken: found.session.guestToken,
                guestSessionId: found.session.guestSessionId,
              }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setGuestAuth(null);
      });

    return () => {
      cancelled = true;
    };
  }, [viewerRole, celebration.id]);

  useEffect(() => {
    selectedChallengeRef.current = selectedChallenge;
  }, [selectedChallenge]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [storySubmissions, setStorySubmissions] = useState<PhotoItem[]>([]);
  const [guestsJoined, setGuestsJoined] = useState(metrics.guestsJoined);

  // ── Countdown ──
  const [countdown, setCountdown] = useState({
    days: 0, hours: 0, minutes: 0,
    isCompleted: false, isOngoing: false,
  });

  // ── Parallax ──
  const scrollY = useRef(new Animated.Value(0)).current;


  /**
   * Bumping the viewer session invalidates any in-flight submission load, so a
   * response that lands after the story closed cannot re-populate it. The
   * swipe-out animation itself lives in `StoryViewer`, which only calls this
   * once it has finished playing.
   */
  const dismissStory = () => {
    challengeViewerSessionRef.current += 1;
    if (challengeStoryCloseTimerRef.current !== null) {
      clearTimeout(challengeStoryCloseTimerRef.current);
      challengeStoryCloseTimerRef.current = null;
    }
    setChallengeMenuVisible(false);
    setChallengeDeleteConfirmVisible(false);
    selectedChallengeRef.current = null;
    setSelectedChallenge(null);
  };
  useEffect(() => () => {
    if (challengeStoryCloseTimerRef.current !== null) clearTimeout(challengeStoryCloseTimerRef.current);
  }, []);

  const loadChallengeSubmissions = useCallback(async (challenge: Challenge) => {
    if (isBackendConfigured && detail?.challengePhotos) {
      const matching = detail.challengePhotos
        .filter((item) => item.challengeId === challenge.id)
        .sort((a, b) => {
          const aTime = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
          const bTime = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
          return bTime - aTime;
        });

      if (matching.length === 0) return [];

      // `challengePhotos` carries bucket paths, not URLs — the same shape
      // `mediaPhotos` arrives in. The grid signs those before rendering; this
      // list has to as well, or every submission renders as a blank frame with
      // its caption intact, which is exactly how the bug presented.
      const client = requireSupabase();
      const { data, error } = await client.storage
        .from('event-media')
        .createSignedUrls(matching.map((item) => item.storagePath), 3600);

      if (error || !data) {
        console.error('[gallery] failed to sign challenge photo URLs', error);
        return [];
      }

      const urlByPath = new Map(data.map((d) => [d.path, d.signedUrl]));

      return matching
        .map((item) => {
          const signedUrl = urlByPath.get(item.storagePath);
          if (!signedUrl) return null;
          return {
            id: item.id,
            uri: signedUrl,
            takenBy: item.displayName || 'Guest',
            postedAt: item.capturedAt,
            submissionId: item.id,
            challengeId: item.challengeId,
            caption: item.caption ?? null,
            isMine: item.isMine === true,
            mediaType: item.mediaType ?? 'photo',
            durationMs: item.durationMs ?? null,
            mimeType: item.mimeType ?? null,
            uploadedByUserId: item.uploadedByUserId ?? null,
            guestSessionId: item.guestSessionId ?? null,
            takenById: item.guestSessionId ?? item.uploadedByUserId ?? null,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    const key = `__mock_challenge_submissions_${celebration.id}_${challenge.id}`;
    const stored = await AsyncStorage.getItem(key);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed
          .map((item: any, index: number) => {
          if (typeof item === 'string') {
            return { uri: item, takenBy: 'Guest', postedAt: null, _sortIndex: index };
          }
          return { ...(item as PhotoItem), _sortIndex: index };
          })
          .sort((a: any, b: any) => {
            const aWeight = a.postedAt ? new Date(a.postedAt).getTime() : a._sortIndex ?? 0;
            const bWeight = b.postedAt ? new Date(b.postedAt).getTime() : b._sortIndex ?? 0;
            return bWeight - aWeight;
          })
          .map((item: any) => {
            const { _sortIndex: _ignored, ...rest } = item;
            return rest as PhotoItem;
          });
      } catch {
        return [];
      }
    }

    return [];
  }, [celebration.id, detail?.challengePhotos]);

  // Declared before the effect below that lists it as a dependency. A `const`
  // is in its temporal dead zone until this line runs, and a dependency array
  // is built during render — so referencing it from an earlier effect throws
  // `Cannot access 'updateChallengeStory' before initialization` and takes the
  // whole dashboard down with it.
  const updateChallengeStory = useCallback((
    challenge: Challenge,
    submissions: PhotoItem[],
    forceLatest = false,
    targetSubmissionId?: string | null,
  ) => {
    if (selectedChallengeRef.current?.id !== challenge.id) return;

    const pending = pendingChallengePostRef.current;
    let nextSubmissions = submissions;
    if (
      pending?.challengeId === challenge.id &&
      pending.mediaItemId &&
      pending.localUri &&
      !submissions.some((item) => item.id === pending.mediaItemId || item.submissionId === pending.mediaItemId)
    ) {
      nextSubmissions = [
        {
          id: pending.mediaItemId,
          submissionId: pending.mediaItemId,
          uri: pending.localUri,
          takenBy: guestName ?? firstNameFrom(profile) ?? 'You',
          postedAt: pending.postedAt ?? new Date().toISOString(),
          challengeId: challenge.id,
          caption: pending.caption ?? null,
          isMine: true,
          mediaType: pending.mediaType ?? 'photo',
          durationMs: pending.durationMs ?? null,
          mimeType: pending.mimeType ?? null,
          guestSessionId: guestAuth?.guestSessionId ?? null,
          uploadedByUserId: profile?.id ?? session?.user.id ?? null,
        },
        ...submissions,
      ];
    }

    setStorySubmissions(nextSubmissions);

    const targetId = targetSubmissionId ?? pending?.mediaItemId ?? null;
    if (targetId) {
      const targetIndex = nextSubmissions.findIndex(
        (item) => item.id === targetId || item.submissionId === targetId,
      );
      if (targetIndex >= 0) {
        setActiveSlideIndex(targetIndex + 1);
        if (pending?.mediaItemId === targetId && submissions.some((item) => item.id === targetId || item.submissionId === targetId)) {
          pendingChallengePostRef.current = null;
        }
        return;
      }
    }

    if (forceLatest && nextSubmissions.length > 0) {
      setActiveSlideIndex(1);
    }
  }, [guestAuth?.guestSessionId, guestName, profile, session?.user.id]);

  // Keeps an open challenge story in sync when fresh submissions arrive from
  // the server — the guest's own post included, which is what makes the photo
  // appear straight after it is posted.
  useEffect(() => {
    if (!selectedChallengeRef.current || !isBackendConfigured || !detail?.challengePhotos) {
      return;
    }

    const challenge = selectedChallengeRef.current;
    void loadChallengeSubmissions(challenge).then((submissions) => {
      if (selectedChallengeRef.current?.id !== challenge.id) return;
      const pending = pendingChallengePostRef.current;
      updateChallengeStory(
        challenge,
        submissions,
        false,
        pending?.challengeId === challenge.id ? pending.mediaItemId ?? null : null,
      );
    });
  }, [detail?.challengePhotos, loadChallengeSubmissions, updateChallengeStory]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (previewMode) return;
      void (async () => {
        const pendingRaw = await AsyncStorage.getItem(`__mock_pending_challenge_refresh_${celebration.id}`);
        const pending = parsePendingChallengePost(pendingRaw);
        if (!pending) {
          return;
        }
        pendingChallengePostRef.current = pending;

        const challenge =
          challenges.find((item) => item.id === pending.challengeId) ??
          selectedChallengeRef.current;
        if (!challenge) {
          await AsyncStorage.removeItem(`__mock_pending_challenge_refresh_${celebration.id}`);
          return;
        }

        const submissions = await loadChallengeSubmissions(challenge);
        if (cancelled) return;
        await AsyncStorage.removeItem(`__mock_pending_challenge_refresh_${celebration.id}`);
        selectedChallengeRef.current = challenge;
        setSelectedChallenge(challenge);
        if (selectedChallengeRef.current?.id === challenge.id) {
          updateChallengeStory(challenge, submissions, true, pending.mediaItemId ?? null);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [celebration.id, challenges, loadChallengeSubmissions, updateChallengeStory]),
  );

  useEffect(() => {
    if (!openChallengeId || !challengePostedAt || lastChallengePostedAtRef.current === challengePostedAt) {
      return;
    }

    lastChallengePostedAtRef.current = challengePostedAt;
    const existingPending = pendingChallengePostRef.current;
    const pending: PendingChallengePost = {
      ...(existingPending?.challengeId === String(openChallengeId) &&
      (!openChallengeMediaId || existingPending.mediaItemId === String(openChallengeMediaId))
        ? existingPending
        : null),
      challengeId: String(openChallengeId),
      mediaItemId: openChallengeMediaId ? String(openChallengeMediaId) : null,
    };
    pendingChallengePostRef.current = pending;

    const challenge =
      challenges.find((item) => item.id === pending.challengeId) ??
      selectedChallengeRef.current;
    if (!challenge) return;

    selectedChallengeRef.current = challenge;
    setSelectedChallenge(challenge);
    void loadChallengeSubmissions(challenge).then((submissions) => {
      if (selectedChallengeRef.current?.id !== challenge.id) return;
      updateChallengeStory(challenge, submissions, true, pending.mediaItemId ?? null);
    });
  }, [
    challengePostedAt,
    challenges,
    loadChallengeSubmissions,
    openChallengeId,
    openChallengeMediaId,
    updateChallengeStory,
  ]);

  const imageParallax = scrollY.interpolate({
    inputRange: [0, HERO_H],
    outputRange: [0, PARALLAX_RANGE],
    extrapolate: 'clamp',
  });
  const imageScale = scrollY.interpolate({
    inputRange: [-90, 0],
    outputRange: [1.1, 1],
    extrapolate: 'clamp',
  });

  const heroDate = formatEventHeroDate(celebration.ends_at, celebration.timezone);

  // ── Hero identity geometry, for the creation reveal ──
  //
  // Reported in window coordinates rather than computed by the reveal, so the
  // date and title it animates start from wherever this screen actually draws
  // them. `measureInWindow` rather than the `onLayout` rect because that rect
  // is relative to `heroInfo`, which is itself absolutely positioned inside
  // the hero — the reveal needs the number on screen, not the offset within a
  // parent it knows nothing about.
  const heroIdentityRef = useRef<View>(null);
  const onHeroIdentityLayout = previewMode?.onHeroIdentityLayout;
  const reportHeroIdentityRect = useCallback(() => {
    if (!onHeroIdentityLayout) return;
    heroIdentityRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onHeroIdentityLayout({ x, y, width, height });
    });
  }, [onHeroIdentityLayout]);

  // ── Theme ──
  const { data: themes } = useQuery({
    queryKey: themeKeys.all,
    queryFn: listThemes,
    enabled: !previewMode,
  });
  const accentColor =
    (themes?.find((t) => t.id === celebration.default_theme_id) as { accent_color_hex?: string } | undefined)?.accent_color_hex
    ?? colours.brandPrimary;

  // ── Load gallery (offline mock fallback) ──
  // Only when there's no real backend at all — matches every other screen's
  // convention for that mode. With a real backend, host and guest both load
  // real media below; there's no product reason for a host's own event to
  // show something different from what a guest sees.
  useEffect(() => {
    if (isBackendConfigured) return;
    // Preview: seeded content only. Loading here would overwrite it, and
    // this event id does not exist on the server yet.
    if (previewMode) return;
    (async () => {
      const key = `__mock_photos_${celebration.id}`;
      const stored = await AsyncStorage.getItem(key);
      const initial: PhotoItem[] = [
        { uri: 'preset_1', takenBy: 'James' },
        { uri: 'preset_2', takenBy: 'Sophia' },
        { uri: 'preset_3', takenBy: 'Liam' },
        { uri: 'preset_4', takenBy: 'Olivia' },
      ];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const migrated: PhotoItem[] = parsed.map((item: any) => {
            if (typeof item === 'string') {
              let name = 'Guest';
              if (item === 'preset_1') name = 'James';
              else if (item === 'preset_2') name = 'Sophia';
              else if (item === 'preset_3') name = 'Liam';
              else if (item === 'preset_4') name = 'Olivia';
              return { uri: item, takenBy: name };
            }
            return item as PhotoItem;
          });
          setPhotos(migrated);
          return;
        } catch {}
      }
      setPhotos(initial);
      await AsyncStorage.setItem(key, JSON.stringify(initial));
    })();
  }, [celebration.id]);

  // ── Load gallery (real media, host and guest alike) ──
  //
  // `mediaPhotos` carries raw private-bucket paths, not URLs. For a guest,
  // get_guest_gallery has already decided which ones they're allowed to see
  // (their own, always; others only once revealed — see that RPC's
  // comments); for a host, RLS already scoped the read to their own event.
  // Either way, signing here is just "turn an authorised path into a
  // fetchable URL," not a second visibility check.
  useEffect(() => {
    if (!isBackendConfigured) return;
    // Preview: seeded content only. Loading here would overwrite it, and
    // this event id does not exist on the server yet.
    if (previewMode) return;
    if (!mediaPhotos || mediaPhotos.length === 0) {
      setPhotos([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const client = requireSupabase();
      // Thumbnail paths batched into the same call as the originals — one
      // round trip either way, and a video with no thumbnail simply
      // contributes nothing extra to the path list.
      const thumbnailPaths = mediaPhotos
        .map((p) => p.thumbnailStoragePath)
        .filter((path): path is string => Boolean(path));
      const { data, error } = await client.storage
        .from('event-media')
        .createSignedUrls(
          [...mediaPhotos.map((p) => p.storagePath), ...thumbnailPaths],
          3600,
        );

      if (cancelled) return;

      if (error || !data) {
        console.error('[gallery] failed to sign photo URLs', error);
        setPhotos([]);
        return;
      }

      const urlByPath = new Map(data.map((d) => [d.path, d.signedUrl]));
      const resolved: PhotoItem[] = mediaPhotos
        .map((p): PhotoItem | null => {
          const signedUrl = urlByPath.get(p.storagePath);
          return signedUrl
            ? {
                uri: signedUrl,
                takenBy: p.displayName,
                capturedAt: p.capturedAt,
                id: p.id,
                isMine: p.isMine === true,
                isPinned: p.isPinned === true,
                pinnedAt: p.pinnedAt ?? null,
                caption: p.caption ?? null,
                uploadedByUserId: p.uploadedByUserId ?? null,
                guestSessionId: p.guestSessionId ?? null,
                takenById: p.guestSessionId ?? p.uploadedByUserId ?? null,
                mediaType: p.mediaType ?? 'photo',
                durationMs: p.durationMs ?? null,
                mimeType: p.mimeType ?? null,
                thumbnailUri: p.thumbnailStoragePath ? (urlByPath.get(p.thumbnailStoragePath) ?? null) : null,
              }
            : null;
        })
        .filter((p): p is PhotoItem => p !== null);

      setPhotos(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaPhotos]);

  useEffect(() => {
    if (!isBackendConfigured) return;
    // Preview: seeded content only. Loading here would overwrite it, and
    // this event id does not exist on the server yet.
    if (previewMode) return;
    if (!primarySession?.id) return;

    const client = requireSupabase();
    const channel = createUniqueChannel(client, `celebration-media-${celebration.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_items',
          filter: `event_session_id=eq.${primarySession.id}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: celebrationDetailKeys.detail(String(celebration.id)),
          });
          void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guest_sessions',
          filter: `event_session_id=eq.${primarySession.id}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: celebrationDetailKeys.detail(String(celebration.id)),
          });
          void queryClient.invalidateQueries({
            queryKey: celebrationDetailKeys.joinedGuests(String(primarySession.id)),
          });
          void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_recaps',
          filter: `event_session_id=eq.${primarySession.id}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: celebrationDetailKeys.detail(String(celebration.id)),
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [celebration.id, primarySession?.id, queryClient]);

  // ── Load challenges ──
  //
  // Declared before the realtime subscription below, which depends on it — see
  // the note on `updateChallengeStory` for why ordering matters here.
  const loadChallenges = useCallback(async () => {
    // Server first, for both roles. A guest reads the host's real list through
    // the guest RPC rather than inventing DEFAULT_CHALLENGES locally, which is
    // what used to hide the host's instructions from the people they were for.
    try {
      const remote = await listChallenges(celebration.id);
      if (remote) {
        setChallenges(remote.map(toScreenChallenge));
        return;
      }
    } catch (error) {
      console.error('[gallery] failed to load challenges', error);
    }

    // No backend configured: the offline development path.
    const stored = await AsyncStorage.getItem(legacyChallengesKey(celebration.id));
    if (stored) {
      try {
        setChallenges(JSON.parse(stored) as Challenge[]);
        return;
      } catch {}
    }
    setChallenges([]);
  }, [celebration.id]);

  useFocusEffect(
    useCallback(() => {
      if (previewMode) return;
      void loadChallenges();
    }, [loadChallenges, previewMode]),
  );

  // Challenge edits from another device. `postgres_changes` carries the
  // subscriber's own RLS, so this reaches hosts and collaborators — a host
  // editing on their phone sees it on the web dashboard without refreshing.
  // Guests have no policy on this table by design and pick edits up on their
  // next fetch instead.
  useEffect(() => {
    if (!isBackendConfigured) return;
    // Preview: seeded content only. Loading here would overwrite it, and
    // this event id does not exist on the server yet.
    if (previewMode) return;

    const client = requireSupabase();
    const channel = createUniqueChannel(client, `celebration-challenges-${celebration.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_challenges',
          filter: `celebration_id=eq.${celebration.id}`,
        },
        () => {
          void loadChallenges();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [celebration.id, loadChallenges]);

  // ── Sync server metrics ──
  useEffect(() => {
    setGuestsJoined(metrics.guestsJoined);
  }, [metrics.guestsJoined]);

  // ── Countdown clock ──
  useEffect(() => {
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
  }, [celebration.ends_at, primarySession?.ends_at]);

  // ── Helpers ──

  function getCoverSource() {
    return coverSource ?? FALLBACK_COVER;
  }

  function getPhotoSource(photo: string) {
    const preset = GALLERY_PRESETS.find((p) => p.id === photo);
    return preset ? preset.source : { uri: photo };
  }

  function resolvePhotoSourceForSaving(photoUri: string) {
    return getPhotoSource(photoUri);
  }

  function mergeSaveItem(
    itemsByUri: Map<string, SavePhotoItem>,
    item: SavePhotoItem,
  ) {
    const existing = itemsByUri.get(item.key);
    if (!existing) {
      itemsByUri.set(item.key, item);
      return;
    }

      itemsByUri.set(item.key, {
        ...existing,
        isChallenge: existing.isChallenge || item.isChallenge,
        challengeLabel: existing.challengeLabel ?? item.challengeLabel,
        takenBy: existing.takenBy || item.takenBy,
        mediaType: existing.mediaType ?? item.mediaType,
        durationMs: existing.durationMs ?? item.durationMs,
    });
  }

  function buildTimeLeftValue() {
    if (countdown.isOngoing) return 'Soon';
    if (countdown.isCompleted) return 'Ended';
    const { days, hours, minutes } = countdown;
    if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
    if (hours >= 1) return `${hours} hrs`;
    const safeMinutes = Math.max(1, minutes);
    return `${safeMinutes} mins`;
  }

  async function saveChallenges(next: Challenge[]) {
    setChallenges(next);

    if (isBackendConfigured) {
      // Only the cover thumbnail changes through this path (see
      // `removeDeletedPhotoFromMockChallengeData`), so patch that field alone
      // rather than rewriting rows the host may have edited elsewhere.
      await Promise.all(
        next.map((item) =>
          updateChallenge(item.id, { photoUri: item.photo ?? null }).catch((error) => {
            console.error('[gallery] failed to update challenge cover', error);
          }),
        ),
      );
      return;
    }

    await AsyncStorage.setItem(
      legacyChallengesKey(celebration.id),
      JSON.stringify(next),
    );
  }

  async function removeDeletedPhotoFromMockChallengeData(deletedPhotoUri: string) {
    const submissionsPrefix = `__mock_challenge_submissions_${celebration.id}_`;
    const allKeys = await AsyncStorage.getAllKeys();
    const submissionKeys = allKeys.filter((key) => key.startsWith(submissionsPrefix));
    const updatedByKey = new Map<string, PhotoItem[]>();

    for (const key of submissionKeys) {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) {
        updatedByKey.set(key, []);
        continue;
      }

      try {
        const parsed = JSON.parse(stored) as Array<PhotoItem | string>;
        const next = parsed.filter((entry) => {
          if (typeof entry === 'string') {
            return entry !== deletedPhotoUri;
          }
          return entry.uri !== deletedPhotoUri;
        }) as PhotoItem[];
        updatedByKey.set(key, next);
        await AsyncStorage.setItem(key, JSON.stringify(next));
      } catch {
        updatedByKey.set(key, []);
      }
    }

    // Any challenge whose cover was the deleted photo falls back to its next
    // submission. Works off the loaded list rather than re-reading local
    // storage, since challenges now live on the server.
    const affected = challenges.filter((item) => item.photo === deletedPhotoUri);
    if (affected.length > 0) {
      const nextChallenges = challenges.map((item) => {
        if (item.photo !== deletedPhotoUri) return item;
        const nextSubmissions = updatedByKey.get(`${submissionsPrefix}${item.id}`) ?? [];
        return { ...item, photo: nextSubmissions[0]?.uri ?? null };
      });
      await saveChallenges(nextChallenges);
    }

    return updatedByKey;
  }

  // Shared with the reveal modal and the photo viewer. Deriving it here inline
  // is how the modal ended up able to announce photos the gallery still hid.
  const isHostOnlyGallery = primarySession?.gallery_visibility === 'hosts_only';
  const viewerCanSeePhotos =
    viewerRole === 'host' ||
    (!isHostOnlyGallery &&
      canViewerSeePhotos({
        now: serverNow(),
        revealAt: primarySession?.reveal_at,
        revealMode: primarySession?.reveal_mode,
      }));
  const isGalleryLocked = !viewerCanSeePhotos;

  // Copy for the lock overlay — "3 days" / "5 hours" / "20 minutes" until
  // reveal. Null when there's nothing to count down to (e.g. manual reveal
  // with no time set yet), in which case the overlay falls back to the lock
  // icon alone.
  const revealCountdownWords = viewerCanSeePhotos
    ? null
    : (() => {
        const remainingMs = msUntilReveal({
          now: serverNow(),
          revealAt: primarySession?.reveal_at,
          revealMode: primarySession?.reveal_mode,
        });
        return remainingMs === null ? null : formatRevealCountdownWords(remainingMs);
      })();

  // For a guest, get_guest_gallery already applies the real rule
  // server-side: while locked, the only rows it ever returns are that
  // guest's own (see the RPC's WHERE clause — everyone else's are excluded
  // outright, not filtered here). For a host, RLS already scoped the read to
  // their own event, and seeing your own event's photos early is exactly
  // what being the host means. Either way, blurring the real image rather
  // than substituting a placeholder is correct and safe for both roles now
  // that both load real data — see the loader effect above.
  const visiblePhotos = isGalleryLocked
    ? photos.map((p) => ({ ...p, locked: true }))
    : photos;

  // ── End-of-event reveal ───────────────────────────────────────────

  // Scoped per viewer so a host and a guest on one device each get their own
  // reveal. Null until resolved — the modal stays down rather than writing an
  // acknowledgement against the wrong identity.
  const [viewerId, setViewerId] = useState<string | null>(null);
  useEffect(() => {
    if (profile?.id) {
      setViewerId(profile.id);
      return;
    }
    if (session?.user.id) {
      setViewerId(session.user.id);
      return;
    }
    if (guestAuth?.guestSessionId) {
      setViewerId(guestAuth.guestSessionId);
      return;
    }
    void loadStoredGuestSessionByCelebrationId(celebration.id)
      .then((guest) => setViewerId(guest?.session.guestSessionId ?? 'anon'))
      .catch(() => setViewerId('anon'));
  }, [profile?.id, session?.user.id, guestAuth?.guestSessionId, celebration.id]);

  const reveal = useRevealModal({
    celebrationId: celebration.id,
    viewerId,
    endsAt: primarySession?.ends_at ?? celebration.ends_at,
    revealAt: primarySession?.reveal_at,
    revealMode: primarySession?.reveal_mode,
    viewerCanSeePhotos,
    ready: Boolean(primarySession),
    refresh: () =>
      queryClient.refetchQueries({
        queryKey: celebrationDetailKeys.detail(celebration.id),
      }),
  });

  const activeChallengeSubmission = activeSlideIndex > 0 ? storySubmissions[activeSlideIndex - 1] : null;
  const activeChallengeMediaLabel = activeChallengeSubmission?.mediaType === 'video' ? 'video' : 'photo';
  const activeChallengeOwnerMatchesViewer =
    Boolean(activeChallengeSubmission) &&
    ((Boolean(activeChallengeSubmission?.guestSessionId) &&
      Boolean(guestAuth?.guestSessionId) &&
      activeChallengeSubmission?.guestSessionId === guestAuth?.guestSessionId) ||
      (Boolean(activeChallengeSubmission?.uploadedByUserId) &&
        Boolean(profile?.id ?? session?.user.id) &&
        activeChallengeSubmission?.uploadedByUserId === (profile?.id ?? session?.user.id)));
  const isLegacyOwnChallengeSubmission =
    viewerRole === 'guest' &&
    Boolean(activeChallengeSubmission) &&
    !activeChallengeSubmission?.takenById &&
    (activeChallengeSubmission?.takenBy === guestName || activeChallengeSubmission?.takenBy === 'You');
  const canDeleteActiveChallengeSubmission =
    Boolean(activeChallengeSubmission) &&
    (viewerRole === 'host' ||
      activeChallengeOwnerMatchesViewer ||
      activeChallengeSubmission?.isMine === true ||
      isLegacyOwnChallengeSubmission);

  // The real photographs, blurred by the modal rather than substituted. A
  // placeholder grid would undercut the whole point of the moment.
  const revealThumbnails = useMemo(
    () => photos.slice(0, 8).map((photo) => getPhotoSource(photo.uri)),
    [photos],
  );


  // ── Native iOS Shared-Element Hero Viewer State & Animations ──
  const [heroVisible, setHeroVisible] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroStartBounds, setHeroStartBounds] = useState({ x: 16, y: 300, width: CELL_W, height: CELL_H });
  /**
   * Whether the open animation has finished.
   *
   * The neighbouring pages each mount their own Skia canvas and render the
   * disposable pipeline into it. Mounting all three at once means three of
   * those renders land on the same frames as the open transition, which is
   * exactly when there is least budget for them. Waiting until the transition
   * has settled costs nothing — a neighbour cannot be seen until a drag starts
   * — and keeps the opening frames to the one page actually on screen.
   */
  const [heroSettled, setHeroSettled] = useState(false);
  /**
   * Where the pan must jump to, at the instant the index commits, for nothing
   * to appear to move. See the release handler and the layout effect below.
   */
  const heroCommitOffsetRef = useRef(0);
  const lastOpenedPhotoIdRef = useRef<string | null>(null);
  const [heroMenuVisible, setHeroMenuVisible] = useState(false);

  // Two independent reasons to disable the native swipe-back gesture here,
  // covering two different moments:
  //
  // 1. Guests, always. Below this screen in the stack sits the join/entry
  //    screen the guest replaced on their way in (see `j/[slug].tsx`'s
  //    `router.replace`). An accidental edge swipe would pop back onto it and
  //    read as having left the event with no warning — guests get an
  //    explicit "leave" control instead (`handleLeaveEvent`, in the header),
  //    which is the only way out.
  // 2. Everyone, while the hero photo viewer is open. It pages between photos
  //    with its own horizontal drag (`heroPanResponder` below), and
  //    `PanResponder` is pure JS — it cannot stop `react-native-screens`'
  //    native swipe-back recognizer from *also* seeing the same drag, since
  //    the two aren't part of the same gesture system. Left enabled, every
  //    attempt to page a photo also pops the screen.
  useEffect(() => {
    // In preview this component is a guest on someone else's route, and
    // `useNavigation` would hand it that screen's options to rewrite.
    if (previewMode) return;
    navigation.setOptions({
      gestureEnabled: isHost && !heroVisible && (!showMediaTabs || galleryTab === 'photos'),
    });
  }, [galleryTab, heroVisible, isHost, navigation, showMediaTabs, previewMode]);

  const heroAnimProgress = useRef(new Animated.Value(0)).current;
  const heroPanY = useRef(new Animated.Value(0)).current;
  const heroPanX = useRef(new Animated.Value(0)).current;

  /**
   * Caption visibility, independent of `chromeOpacity`.
   *
   * `chromeOpacity` is a there/gone binary tied to the open/close transition
   * — it does not fade on its own once the viewer is open. This value layers
   * on top of it: a fresh timer starts whenever a photo becomes active
   * (opening the viewer, or swiping to it), the caption shows for
   * `HERO_CAPTION_VISIBLE_MS`, and then fades. A single tap anywhere on the
   * page — see the per-page `Pressable` below — restarts the same timer, the
   * way a Story's caption reappears on tap.
   *
   * Both animations that touch it use `useNativeDriver: false` to match
   * `chromeOpacity`: the two are combined with `Animated.multiply` in the
   * caption's style, and mixing a natively-driven value into that graph with
   * a JS-driven one silently stops updating — the same failure mode the
   * carousel's own pan values hit earlier in this file.
   */
  const heroCaptionOpacity = useRef(new Animated.Value(1)).current;
  const heroCaptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function armHeroCaptionTimer() {
    if (heroCaptionTimerRef.current) clearTimeout(heroCaptionTimerRef.current);
    heroCaptionOpacity.stopAnimation();
    Animated.timing(heroCaptionOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    heroCaptionTimerRef.current = setTimeout(() => {
      heroCaptionTimerRef.current = null;
      Animated.timing(heroCaptionOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }, HERO_CAPTION_VISIBLE_MS);
  }

  useEffect(() => {
    if (!heroVisible) {
      if (heroCaptionTimerRef.current) clearTimeout(heroCaptionTimerRef.current);
      heroCaptionTimerRef.current = null;
      return undefined;
    }
    armHeroCaptionTimer();
    return () => {
      if (heroCaptionTimerRef.current) clearTimeout(heroCaptionTimerRef.current);
    };
    // `armHeroCaptionTimer` closes only over refs and an Animated.Value, both
    // stable across renders — including it would just restart the timer on
    // every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroVisible, heroIndex]);

  // Pages are laid out at offsets relative to `heroIndex`, so advancing the
  // index shifts every one of them by a page width. The pan has to give back
  // exactly that width in the same paint, or the carousel jumps a full page.
  //
  // `useLayoutEffect` rather than the animation's `.start()` callback: that
  // callback would reset the pan *before* React had re-rendered with the new
  // index, leaving one visible frame where the pages sat at their old offsets
  // with no pan to compensate. A layout effect runs after React commits the
  // new index and before the screen paints, so the two changes land together
  // and cancel out.
  //
  // `heroStartBounds` moves with it so that closing collapses back into the
  // cell the user is actually looking at, rather than the one they originally
  // tapped several swipes ago.
  useLayoutEffect(() => {
    // A committed swipe hands over the offset that cancels the layout shift,
    // so the pages move by one width and the pan gives back exactly the same
    // width in this one paint. Anything else changing the index (opening the
    // viewer, deleting a photo) hands over nothing and simply lands at rest.
    const offset = heroCommitOffsetRef.current;
    heroCommitOffsetRef.current = 0;
    heroPanX.setValue(offset);
    setHeroStartBounds(getThumbBounds(heroIndex));

    if (offset !== 0) {
      // Only now does the page actually travel. Running the settle *after*
      // the commit rather than before it is what lets a second swipe start
      // immediately: the index is already current, so the next gesture
      // advances from where the user actually is rather than recomputing
      // from an index that had not caught up yet — which is why quick
      // successive swipes used to be swallowed.
      Animated.spring(heroPanX, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 0,
        speed: 20,
      }).start();
    }
    // `getThumbBounds` is a plain function of the index and layout constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroIndex, heroPanX]);

  function getThumbBounds(idx: number) {
    const col = idx % GALLERY_COLUMNS;
    const row = Math.floor(idx / GALLERY_COLUMNS);
    const x = GALLERY_EDGE_INSET + col * (CELL_W + GRID_GAP);
    const y = 350 + row * (CELL_H + ROW_GAP);
    return { x, y, width: CELL_W, height: CELL_H };
  }

  /**
   * Opens the hero viewer on a specific photo or video.
   *
   * Takes the item itself rather than a grid position, because the position
   * that matters is not "which cell was tapped" but "where does this item
   * sit in the list the viewer will page through" — and that list depends on
   * the item's own media type. A photo resolves its index within
   * `heroPhotosOnly`, a video within `heroVideosOnly`, and `heroMediaTrack`
   * is set to match, so every subsequent swipe in this viewing session
   * pages through that same list and can never cross into the other type.
   */
  function handlePhotoPress(photo: PhotoItem, e?: any) {
    if (isGalleryLocked) {
      Alert.alert('Gallery is locked', 'Photos will be revealed automatically once the countdown ends!');
      return;
    }
    const track: 'photo' | 'video' = photo.mediaType === 'video' ? 'video' : 'photo';
    const list = track === 'video' ? heroVideosOnly : heroPhotosOnly;
    const index = list.indexOf(photo);
    if (index < 0) return;

    // Seeing the photographs IS the news. Someone who got here another way —
    // a deep link, a notification — should not be told about it afterwards.
    reveal.markRevealedSeen();
    setHeroMediaTrack(track);
    setHeroIndex(index);
    if (e?.currentTarget?.measure) {
      e.currentTarget.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
        setHeroStartBounds({ x: pageX, y: pageY, width: w, height: h });
        openHeroViewer();
      });
    } else {
      setHeroStartBounds(getThumbBounds(index));
      openHeroViewer();
    }
  }

  function openHeroViewer() {
    setHeroVisible(true);
    heroPanY.setValue(0);
    heroPanX.setValue(0);
    heroAnimProgress.setValue(0);
    setHeroSettled(false);
    Animated.spring(heroAnimProgress, {
      toValue: 1,
      useNativeDriver: false,
      bounciness: 4,
      speed: 12,
    }).start(() => setHeroSettled(true));
  }

  useEffect(() => {
    if (!openPhotoId || lastOpenedPhotoIdRef.current === openPhotoId) {
      return;
    }

    const photo = photos.find((p) => p.id === openPhotoId);
    if (!photo) {
      return;
    }

    lastOpenedPhotoIdRef.current = openPhotoId;
    handlePhotoPress(photo);
  }, [openPhotoId, photos]);

  useEffect(() => {
    if (!videoPostedAt || lastVideoPostedToastRef.current === videoPostedAt) {
      return;
    }

    lastVideoPostedToastRef.current = videoPostedAt;
    setVideoPostedToastVisible(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const timer = setTimeout(() => {
      setVideoPostedToastVisible(false);
    }, 2600);

    return () => clearTimeout(timer);
  }, [videoPostedAt]);

  // Same mechanism as the video toast above, kept as its own param/state/ref
  // rather than folded into one generic "media posted" version — matches how
  // this screen already keeps photo and video handling as parallel, not
  // shared, code (see `challengeCaption`/`galleryCaption` in camera.tsx).
  useEffect(() => {
    if (!photoPostedAt || lastPhotoPostedToastRef.current === photoPostedAt) {
      return;
    }

    lastPhotoPostedToastRef.current = photoPostedAt;
    setPhotoPostedToastVisible(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const timer = setTimeout(() => {
      setPhotoPostedToastVisible(false);
    }, 2600);

    return () => clearTimeout(timer);
  }, [photoPostedAt]);

  async function runGuestDelete(photo: PhotoItem, index: number) {
    if (!photo.id || !guestAuth) return;

    const result = await deleteGuestPhoto({
      mediaItemId: photo.id as string,
      guestToken: guestAuth.guestToken,
    });

    const nextPhotos = photos.filter((item) => item.id !== photo.id);
    setPhotos(nextPhotos);
    closeHeroViewer();

    const storedGuest = await guestSessionStorage.get(guestAuth.slug);
    if (storedGuest) {
      await guestSessionStorage.set(guestAuth.slug, {
        ...storedGuest,
        shotsUsed: result.shotsUsed,
      });
    }

    void removeDeletedPhotoFromMockChallengeData(photo.uri).catch((error) => {
      console.warn('[gallery] failed to clean mock challenge data after delete', error);
    });

    await queryClient.invalidateQueries({
      queryKey: celebrationDetailKeys.detail(celebration.id),
    });
    void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function confirmGuestDelete(
    photo: PhotoItem,
    index: number,
    mediaLabel: 'photo' | 'video',
  ) {
    const mediaLabelTitle = mediaLabel === 'video' ? 'Video' : 'Photo';
    const confirmDelete = async () => {
      try {
        await runGuestDelete(photo, index);
      } catch (error) {
        console.error(`[gallery] failed to delete guest ${mediaLabel}`, error);
        Alert.alert('Error', `Could not delete this ${mediaLabel}. Please try again.`);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Delete this ${mediaLabel}? This will remove it from the event gallery.`)) {
        void confirmDelete();
      }
      return;
    }

    Alert.alert(
      `Delete this ${mediaLabel}?`,
      'This will remove it from the event gallery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${mediaLabelTitle}`,
          style: 'destructive',
          onPress: () => {
            void confirmDelete();
          },
        },
      ],
    );
  }

  function deleteGuestGalleryPhoto(photo: PhotoItem, index: number) {
    if (!photo.id || !guestAuth) return;

    const mediaLabel = photo.mediaType === 'video' ? 'video' : 'photo';
    setHeroMenuVisible(false);
    confirmGuestDelete(photo, index, mediaLabel);
  }

  async function deleteHeroGalleryPhoto(photo: PhotoItem, index: number) {
    if (viewerRole === 'guest') {
      if (!photo.id || !guestAuth) return;
      await deleteGuestPhoto({
        mediaItemId: photo.id,
        guestToken: guestAuth.guestToken,
      });
    } else if (isBackendConfigured && photo.id) {
      await deleteHostPhoto({ mediaItemId: photo.id });
    } else {
      const key = `__mock_photos_${celebration.id}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as PhotoItem[];
        const updated = parsed.filter((_, idx) => idx !== index);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
    }

    await removeDeletedPhotoFromMockChallengeData(photo.uri).catch((error) => {
      console.warn('[gallery] failed to clean mock challenge data after delete', error);
    });

    const nextPhotos = photos.filter((item, idx) =>
      photo.id ? item.id !== photo.id : idx !== index,
    );
    setPhotos(nextPhotos);
    closeHeroViewer();

    await queryClient.invalidateQueries({
      queryKey: celebrationDetailKeys.detail(String(celebration.id)),
    });
    void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  // Warms the neighbouring photos' decodes while the viewer is open.
  //
  // Only the *decode* — that is the async, network-and-CPU-bound half, and the
  // half that would otherwise land the moment a swipe completes. Filtering
  // itself is synchronous GPU work an order of magnitude cheaper, and it needs
  // a settled size to render at, so it stays where it is. Runs after
  // interactions so it can never compete with the swipe that triggered it.
  useEffect(() => {
    if (!heroVisible) return undefined;
    if (normalisePhotoTreatment(primarySession?.photo_treatment) !== 'disposable') return undefined;

    const task = InteractionManager.runAfterInteractions(() => {
      for (const offset of [1, -1]) {
        const neighbour = heroNavPhotos[heroIndex + offset];
        if (neighbour && neighbour.mediaType !== 'video' && neighbour.uri) {
          void loadSourceImage(neighbour.uri);
        }
      }
    });
    return () => task.cancel();
  }, [heroVisible, heroIndex, heroNavPhotos, primarySession?.photo_treatment]);

  function closeHeroViewer() {
    Animated.timing(heroAnimProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setHeroVisible(false);
      setHeroSettled(false);
      heroPanY.setValue(0);
      heroPanX.setValue(0);
    });
  }

  // Keep responder stable via useRef to avoid jank on every swipe, but use
  // separate refs to keep handlers current. A responder built with
  // `useRef(...).current` captures stale state at init (heroIndex=0,
  // photos=[]); building only once means handlers can't navigate. But
  // rebuilding via `useMemo` on every state change causes the animation to
  // jank. Solution: refs for state, stable responder object.
  const heroIndexRef = useRef(heroIndex);
  const heroPhotosLengthRef = useRef(heroNavPhotos.length);

  useEffect(() => {
    heroIndexRef.current = heroIndex;
    heroPhotosLengthRef.current = heroNavPhotos.length;
  }, [heroIndex, heroNavPhotos.length]);

  const heroPageWidthRef = useRef(screenWidth);
  heroPageWidthRef.current = screenWidth;

  /**
   * The carousel gesture.
   *
   * Two things here are load-bearing and were each wrong before.
   *
   * **The responder is claimed in the capture phase.** The strip now spans the
   * whole viewer, so a finger landing on a photo is landing on a Skia canvas
   * nested several levels down. Asking for the responder on the way back *up*
   * meant competing with everything under the finger, and most drags were
   * simply never handed over. Capture runs top-down, so the strip claims a
   * drag before any child sees it — while a *tap* (no movement) still falls
   * straight through to the share and download buttons, because only the move
   * handler claims anything.
   *
   * **Everything driving `heroPanX`/`heroPanY` stays on the JS driver.** These
   * values are written with `setValue` on every frame of the gesture, and
   * `setValue` is a JS-side write. Animating the same value with
   * `useNativeDriver: true` hands ownership of it to the native side, after
   * which those per-frame writes no longer reach the view — the first swipe
   * worked and every one after it appeared dead. One driver, consistently.
   *
   * The performance that the native driver would have bought comes instead
   * from what these values feed: a `transform`, not `left`/`top`. Position is
   * layout, and animating it ran a full layout pass per frame; a transform
   * does not, which is where the cost actually was.
   */
  const heroPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      // Interrupting a settle should hand the page to the finger from exactly
      // where it is. Stopping the spring and folding its value into an offset
      // means the incoming gesture's delta is measured from there instead of
      // from zero, so grabbing a moving page does not make it jump.
      onPanResponderGrant: () => {
        heroPanX.stopAnimation((value: number) => {
          heroPanX.setOffset(value);
          heroPanX.setValue(0);
        });
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          heroPanY.setValue(gestureState.dy);
          return;
        }
        if (Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) return;

        // Resist dragging past either end, so the first and last photos feel
        // like the end of the carousel rather than a broken one.
        const atStart = heroIndexRef.current === 0 && gestureState.dx > 0;
        const atEnd =
          heroIndexRef.current === heroPhotosLengthRef.current - 1 && gestureState.dx < 0;
        heroPanX.setValue(atStart || atEnd ? gestureState.dx * 0.25 : gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        heroPanX.flattenOffset();
        if (gestureState.dy > 100 || (gestureState.dy > 50 && gestureState.vy > 0.5)) {
          closeHeroViewer();
          return;
        }
        Animated.spring(heroPanY, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 6,
        }).start();

        const pageWidth = heroPageWidthRef.current;
        const goingBack = gestureState.dx > 0;
        const committed =
          Math.abs(gestureState.dx) > pageWidth * 0.22 ||
          (Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.vx) > 0.3);
        const nextIndex = heroIndexRef.current + (goingBack ? -1 : 1);
        const canGo = committed && nextIndex >= 0 && nextIndex < heroPhotosLengthRef.current;

        if (canGo) {
          void Haptics.selectionAsync().catch(() => {});
          // The index commits now, not when an animation finishes. Advancing
          // the pages by one width would jump the carousel, so the pan is
          // handed the offset that exactly cancels it; the layout effect
          // applies both together and then springs the offset away, which is
          // the movement the user sees.
          heroCommitOffsetRef.current = gestureState.dx + (goingBack ? -pageWidth : pageWidth);
          heroIndexRef.current = nextIndex;
          setHeroIndex(nextIndex);
          return;
        }

        Animated.spring(heroPanX, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 4,
          speed: 16,
        }).start();
      },
    })
  ).current;

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add a moment.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const userName = firstNameFrom(profile) || 'You';
      const newPhotoItem: PhotoItem = { uri, takenBy: userName };
      const next = [newPhotoItem, ...photos];
      setPhotos(next);
      await AsyncStorage.setItem(
        `__mock_photos_${celebration.id}`, JSON.stringify(next),
      );
    }
  }

  async function handleChallengePhotoPress(challenge: Challenge) {
    const viewerSession = ++challengeViewerSessionRef.current;
    setChallengeMenuVisible(false);
    if (challengeStoryCloseTimerRef.current !== null) {
      clearTimeout(challengeStoryCloseTimerRef.current);
      challengeStoryCloseTimerRef.current = null;
    }
    selectedChallengeRef.current = challenge;
    setSelectedChallenge(challenge);
    setActiveSlideIndex(0);
    setStorySubmissions([]);

    void loadChallengeSubmissions(challenge).then((loadedSubmissions) => {
      if (challengeViewerSessionRef.current !== viewerSession) return;
      updateChallengeStory(challenge, loadedSubmissions);
    });
  }

  async function handleAddSubmission(challenge: Challenge) {
    setChallengeMenuVisible(false);
    if (challengeStoryCloseTimerRef.current !== null) {
      clearTimeout(challengeStoryCloseTimerRef.current);
      challengeStoryCloseTimerRef.current = null;
    }
    requestAnimationFrame(() => {
      router.push(({
        pathname: '/celebration/[celebrationId]/camera',
        params: {
          celebrationId: String(celebration.id),
          captureTarget: 'challenge',
          challengeId: challenge.id,
        },
      }) as never);
    });
  }

  async function deleteActiveChallengeSubmission() {
    const challenge = selectedChallengeRef.current;
    const activeSubmission = activeSlideIndex > 0 ? storySubmissions[activeSlideIndex - 1] : null;

    if (!challenge || !activeSubmission || !canDeleteActiveChallengeSubmission) {
      return;
    }

    try {
      const deletedPhotoUri = activeSubmission.uri;
      const deletedPhotoId = activeSubmission.id ?? activeSubmission.submissionId ?? null;
      const currentSlideIndex = activeSlideIndex;
      const submissionsPrefix = `__mock_challenge_submissions_${celebration.id}_`;
      let refreshed: PhotoItem[] | null = null;

      if (isBackendConfigured && deletedPhotoId) {
        if (viewerRole === 'guest') {
          if (!guestAuth) return;
          await deleteGuestPhoto({
            mediaItemId: deletedPhotoId,
            guestToken: guestAuth.guestToken,
          });
        } else {
          await deleteHostPhoto({ mediaItemId: deletedPhotoId });
        }

        refreshed = storySubmissions.filter((item) => {
          const itemId = item.id ?? item.submissionId ?? null;
          return itemId ? itemId !== deletedPhotoId : item.uri !== deletedPhotoUri;
        });
      } else {
        const updatedByKey = await removeDeletedPhotoFromMockChallengeData(deletedPhotoUri);
        refreshed = updatedByKey.get(`${submissionsPrefix}${challenge.id}`) ?? null;
      }

      const nextSubmissions = refreshed ?? await loadChallengeSubmissions(challenge);
      setStorySubmissions(nextSubmissions);
      setActiveSlideIndex(nextSubmissions.length === 0 ? 0 : Math.max(0, currentSlideIndex - 1));
      setChallengeMenuVisible(false);
      setChallengeDeleteConfirmVisible(false);
      void queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebration.id)),
      });
      void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
    } catch (error) {
      console.error(`[challenge-story] failed to delete ${activeChallengeMediaLabel}`, error);
      Alert.alert('Error', `Could not delete this challenge ${activeChallengeMediaLabel}.`);
    }
  }

  async function goToChallengePacks() {
    setChallengePacksIntroVisible(false);
    router.push(`/celebration/${celebration.id}/challenges/packs` as never);
  }

  async function handleAddChallenge() {
    if (await hasSeenChallengePacksIntro()) {
      void goToChallengePacks();
      return;
    }
    setChallengePacksIntroVisible(true);
  }

  async function handleChallengePacksGetStarted() {
    await markChallengePacksIntroSeen();
    void goToChallengePacks();
  }

  async function openSavePhotos() {
    try {
      setSaveLoading(true);
      setSaveVisible(true);
      setSaveMode('original');
      setSaveItems([]);
      setSelectedSaveKeys([]);

      const itemsByUri = new Map<string, SavePhotoItem>();
      const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));
      const challengeIdByMediaId = new Map(
        (detail.challengePhotos ?? []).map((item) => [item.id, item.challengeId]),
      );

      photos.forEach((photo) => {
        const challengeId = photo.challengeId ?? challengeIdByMediaId.get(photo.id ?? '') ?? null;
        mergeSaveItem(itemsByUri, {
          key: photo.id ?? photo.uri,
          uri: photo.uri,
          source: photo.mediaType === 'video' ? null : resolvePhotoSourceForSaving(photo.uri),
          takenBy: photo.takenBy || 'Guest',
          isChallenge: Boolean(challengeId),
          challengeLabel: challengeId
            ? challengeById.get(challengeId)?.label ?? 'Challenge photo'
            : undefined,
          seedKey: photo.id ?? photo.uri,
          capturedAt: photo.capturedAt ?? null,
          mediaType: photo.mediaType ?? 'photo',
          durationMs: photo.durationMs ?? null,
        });
      });

      const allKeys = await AsyncStorage.getAllKeys();
      const submissionKeys = allKeys.filter((key) =>
        key.startsWith(`__mock_challenge_submissions_${celebration.id}_`),
      );

      for (const key of submissionKeys) {
        const challengeId = key.slice(`__mock_challenge_submissions_${celebration.id}_`.length);
        const challenge = challengeById.get(challengeId);
        const stored = await AsyncStorage.getItem(key);
        if (!stored) continue;

        try {
          const parsed = JSON.parse(stored) as unknown[];
          parsed.forEach((entry, submissionIndex) => {
            const uri = typeof entry === 'string'
              ? entry
              : typeof entry === 'object' && entry && 'uri' in entry && typeof (entry as { uri?: unknown }).uri === 'string'
                ? (entry as { uri: string }).uri
                : null;

            if (!uri) return;

            mergeSaveItem(itemsByUri, {
              key: `${challengeId}:${submissionIndex}:${uri}`,
              uri,
              source: resolvePhotoSourceForSaving(uri),
              takenBy: typeof entry === 'object' && entry && 'takenBy' in entry && typeof (entry as { takenBy?: unknown }).takenBy === 'string'
                ? (entry as { takenBy: string }).takenBy
                : 'Guest',
              isChallenge: true,
              challengeLabel: challenge?.label ?? 'Challenge photo',
              seedKey: `${challengeId}:${submissionIndex}:${uri}`,
              mediaType: 'photo',
            });

            // Keep older data that only stored the current hero shot on the
            // challenge record itself from disappearing from the save picker.
            if (submissionIndex === 0 && challenge?.photo && !itemsByUri.has(`${challengeId}:hero:${challenge.photo}`)) {
              mergeSaveItem(itemsByUri, {
                key: `${challengeId}:hero:${challenge.photo}`,
                uri: challenge.photo,
                source: resolvePhotoSourceForSaving(challenge.photo),
                takenBy: 'Guest',
                isChallenge: true,
                challengeLabel: challenge.label,
                seedKey: `${challengeId}:hero:${challenge.photo}`,
                mediaType: 'photo',
              });
            }
          });
        } catch {}

        if (challenge?.photo && !itemsByUri.has(`${challengeId}:hero:${challenge.photo}`)) {
          mergeSaveItem(itemsByUri, {
            key: `${challengeId}:hero:${challenge.photo}`,
            uri: challenge.photo,
            source: resolvePhotoSourceForSaving(challenge.photo),
            takenBy: 'Guest',
            isChallenge: true,
            challengeLabel: challenge.label,
            seedKey: `${challengeId}:hero:${challenge.photo}`,
            mediaType: 'photo',
          });
        }
      }

      const nextItems = Array.from(itemsByUri.values());
      if (nextItems.length === 0) {
        Alert.alert('No photos', 'There are no photos available to save yet.');
        setSaveVisible(false);
        return;
      }

      setSaveItems(nextItems);
      setSelectedSaveKeys(nextItems.map((item) => item.key));
    } catch {
      Alert.alert('Error', 'Failed to prepare the photos for saving.');
      setSaveVisible(false);
    } finally {
      setSaveLoading(false);
    }
  }

  function setAllSaveSelections(nextSelected: boolean) {
    setSelectedSaveKeys(nextSelected ? saveItems.map((item) => item.key) : []);
  }

  function togglePhotoSelection(key: string) {
    setSelectedSaveKeys((current) =>
      current.includes(key)
        ? current.filter((itemKey) => itemKey !== key)
        : [...current, key],
    );
  }

  function selectChallengePhotos(shouldSelect: boolean) {
    const challengeKeys = saveItems.filter((item) => item.isChallenge).map((item) => item.key);
    setSelectedSaveKeys((current) => {
      const currentSet = new Set(current);
      if (shouldSelect) {
        challengeKeys.forEach((key) => currentSet.add(key));
        return Array.from(currentSet);
      }
      return current.filter((key) => !challengeKeys.includes(key));
    });
  }

  function setSaveVideoSelections(shouldSelect: boolean) {
    const videoKeys = saveItems.filter((item) => item.mediaType === 'video').map((item) => item.key);
    setSelectedSaveKeys((current) => {
      const currentSet = new Set(current);
      if (shouldSelect) {
        videoKeys.forEach((key) => currentSet.add(key));
        return Array.from(currentSet);
      }
      return current.filter((key) => !videoKeys.includes(key));
    });
  }

  function openRecapSelection() {
    if (!eventHasEnded) {
      Alert.alert('Recap unavailable', 'Recaps can be created after the event ends.');
      return;
    }
    if (!isHost) {
      Alert.alert('Host only', 'Only the host can choose media for the recap.');
      return;
    }
    if (!primarySession?.id) {
      Alert.alert('Recap unavailable', 'This event session is not ready yet.');
      return;
    }

    const challengeIdByMediaId = new Map(
      (detail.challengePhotos ?? []).map((item) => [item.id, item.challengeId]),
    );

    const items = photos
      .filter((photo): photo is PhotoItem & { id: string } =>
        Boolean(photo.id) && !photo.locked,
      )
      .map((photo) => {
        const challengeId = photo.challengeId ?? challengeIdByMediaId.get(photo.id) ?? null;
        return {
          key: photo.id,
          mediaId: photo.id,
          uri: photo.thumbnailUri ?? photo.uri,
          source: getPhotoSource(photo.thumbnailUri ?? photo.uri),
          takenBy: photo.takenBy,
          isChallenge: Boolean(challengeId),
          challengeId,
          challengeLabel: challengeId
            ? challenges.find((challenge) => challenge.id === challengeId)?.label
            : undefined,
          seedKey: photo.id,
          capturedAt: photo.capturedAt,
          mediaType: photo.mediaType ?? 'photo',
          durationMs: photo.durationMs ?? null,
        };
      });

    if (items.length === 0) {
      Alert.alert('No media yet', 'There are no photos or videos available for a recap.');
      return;
    }

    setRecapItems(items);
    setSelectedRecapKeys(items.map((item) => item.key));
    setRecapSelectionVisible(true);
  }

  function setAllRecapSelections(nextSelected: boolean) {
    if (!nextSelected) {
      setSelectedRecapKeys([]);
      return;
    }

    const nextKeys = getLimitedRecapSelectionKeys(recapItems);
    setSelectedRecapKeys(nextKeys);
    if (nextKeys.length < recapItems.length) {
      Alert.alert(
        'Recap limit reached',
        `A recap can include up to ${RECAP_MAX_ITEMS} items total and ${RECAP_MAX_VIDEOS} videos.`,
      );
    }
  }

  function toggleRecapSelection(key: string) {
    const item = recapItems.find((recapItem) => recapItem.key === key);
    setSelectedRecapKeys((current) => {
      if (current.includes(key)) return current.filter((itemKey) => itemKey !== key);
      if (current.length >= RECAP_MAX_ITEMS) {
        Alert.alert('Recap limit reached', `Choose up to ${RECAP_MAX_ITEMS} items for one recap.`);
        return current;
      }
      if (
        item?.mediaType === 'video' &&
        recapItems.filter((recapItem) => recapItem.mediaType === 'video' && current.includes(recapItem.key)).length >= RECAP_MAX_VIDEOS
      ) {
        Alert.alert('Video limit reached', `Choose up to ${RECAP_MAX_VIDEOS} videos for one recap.`);
        return current;
      }
      return [...current, key];
    });
  }

  function selectRecapChallengePhotos(shouldSelect: boolean) {
    const challengeKeys = recapItems.filter((item) => item.isChallenge).map((item) => item.key);
    setSelectedRecapKeys((current) => {
      const currentSet = new Set(current);
      if (shouldSelect) {
        let videoCount = recapItems.filter((item) => item.mediaType === 'video' && currentSet.has(item.key)).length;
        for (const key of challengeKeys) {
          if (currentSet.has(key)) continue;
          const item = recapItems.find((recapItem) => recapItem.key === key);
          if (currentSet.size >= RECAP_MAX_ITEMS) break;
          if (item?.mediaType === 'video') {
            if (videoCount >= RECAP_MAX_VIDEOS) continue;
            videoCount += 1;
          }
          currentSet.add(key);
        }
        return Array.from(currentSet);
      }
      return current.filter((key) => !challengeKeys.includes(key));
    });
  }

  function setRecapVideoSelections(shouldSelect: boolean) {
    const videoKeys = recapItems.filter((item) => item.mediaType === 'video').map((item) => item.key);
    setSelectedRecapKeys((current) => {
      const currentSet = new Set(current);
      if (shouldSelect) {
        for (const key of videoKeys) {
          if (currentSet.has(key)) continue;
          if (currentSet.size >= RECAP_MAX_ITEMS) break;
          if (recapItems.filter((item) => item.mediaType === 'video' && currentSet.has(item.key)).length >= RECAP_MAX_VIDEOS) break;
          currentSet.add(key);
        }
        return Array.from(currentSet);
      }
      return current.filter((key) => !videoKeys.includes(key));
    });
  }

  async function createSelectedRecap() {
    if (!primarySession?.id) {
      Alert.alert('Recap unavailable', 'This event session is not ready yet.');
      return;
    }
    if (selectedRecapKeys.length < RECAP_MIN_ITEMS) {
      Alert.alert('Add more moments', `Choose at least ${RECAP_MIN_ITEMS} photos or videos for the recap.`);
      return;
    }
    if (selectedRecapKeys.length > RECAP_MAX_ITEMS) {
      Alert.alert('Too many moments', `Choose up to ${RECAP_MAX_ITEMS} items for one recap.`);
      return;
    }

    const selectedItems = selectedRecapKeys
      .map((key) => recapItems.find((item) => item.key === key))
      .filter((item): item is RecapSelectionItem => Boolean(item));
    const selectedVideoCount = selectedItems.filter((item) => item.mediaType === 'video').length;
    if (selectedVideoCount > RECAP_MAX_VIDEOS) {
      Alert.alert('Too many videos', `Choose up to ${RECAP_MAX_VIDEOS} videos for one recap.`);
      return;
    }

    const selectedIds = selectedItems
      .map((item) => item.mediaId)
      .filter((id): id is string => Boolean(id));

    if (selectedIds.length < RECAP_MIN_ITEMS) {
      Alert.alert('Add more moments', `Choose at least ${RECAP_MIN_ITEMS} photos or videos for the recap.`);
      return;
    }

    try {
      setRecapCreating(true);
      await requestEventRecap(primarySession.id, selectedIds, { renderMode: recapMode });
      setRecapSelectionVisible(false);
      Alert.alert('Recap started', 'Your recap is being created now.');
      void queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebration.id)),
      });
      void queryClient.invalidateQueries({ queryKey: celebrationKeys.list() });
    } catch (error: any) {
      Alert.alert('Could not create recap', error?.message ?? 'Please try again.');
    } finally {
      setRecapCreating(false);
    }
  }

  async function ensureLocalSaveUri(item: SavePhotoItem) {
    if (typeof item.source === 'number') {
      const bundled = ExpoAsset.fromModule(item.source);
      await bundled.downloadAsync();
      return bundled.localUri ?? bundled.uri ?? item.uri;
    }

    const sourceUri = item.source && typeof item.source === 'object' && 'uri' in item.source && typeof item.source.uri === 'string'
      ? item.source.uri
      : item.uri;

    if (sourceUri.startsWith('file://') || sourceUri.startsWith('content://')) {
      return sourceUri;
    }

    const sourcePath = sourceUri.split(/[?#]/, 1)[0] ?? sourceUri;
    const fallbackExtension = item.mediaType === 'video' ? 'mp4' : 'jpg';
    const extension = sourcePath.split('.').pop()?.toLowerCase() ?? fallbackExtension;
    const safeExt = /^[a-z0-9]{1,5}$/.test(extension) ? extension : fallbackExtension;
    const destinationFile = new FileSystem.File(
      FileSystem.Paths.cache,
      `stories-save-${celebration.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`,
    );
    const downloaded = await FileSystem.File.downloadFileAsync(sourceUri, destinationFile);
    return downloaded.uri;
  }

  async function downloadPhoto(photo: PhotoItem) {
    if (Platform.OS === 'web') {
      try {
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo-${photo.id || 'download'}.jpg`;
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

      let localPath = photo.uri;
      if (photo.uri.startsWith('http://') || photo.uri.startsWith('https://')) {
        const filename = photo.uri.split('/').pop()?.split('?')[0] || 'photo.jpg';
        const file = new FileSystem.File(FileSystem.Paths.document, filename);
        const downloaded = await FileSystem.File.downloadFileAsync(photo.uri, file);
        localPath = downloaded.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localPath);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Success', 'Photo downloaded successfully.');
    } catch (err: any) {
      console.error('Failed to download photo:', err);
      Alert.alert('Download failed', 'Could not save photo to your device: ' + (err.message || String(err)));
    }
  }

  async function sharePhoto(photo: PhotoItem) {
    const eventCode = guestAuth?.slug || celebration?.public_slug || '';
    const photoIdVal = photo.id || photo.uri;
    const shareLink = `https://event-camera-app-navy.vercel.app/e/${eventCode}?photoId=${encodeURIComponent(photoIdVal)}`;

    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: `Check out this photo from ${celebration?.title || 'the event'}! View it here: ${shareLink}` }
          : { message: `Check out this photo from ${celebration?.title || 'the event'}! View it here: ${shareLink}`, url: shareLink }
      );
    } catch (err: any) {
      console.error('Failed to share photo:', err);
    }
  }

  async function shareGalleryMediaToInstagram(photo: PhotoItem) {
    await sharePhotoToInstagram(photo);
  }

  async function renderFilteredSave(item: SavePhotoItem) {
    if (item.mediaType === 'video') {
      return ensureLocalSaveUri(item);
    }
    const localUri = await ensureLocalSaveUri(item);

    // The disposable look renders straight into an offscreen Skia surface at
    // the photo's own resolution, from the same paint the gallery draws with.
    // Everything below is the older route: mount the treatment in a hidden
    // view, wait for it to lay out, and screenshot it. That caps the result at
    // the render surface's size and depends on a view existing at all, so it
    // is kept only for the treatments that have no offscreen renderer.
    if (normalisePhotoTreatment(primarySession?.photo_treatment) === 'disposable') {
      return renderDisposablePhotoToFile({
        uri: localUri,
        seedKey: item.seedKey,
        dateStampEnabled: primarySession?.date_stamp_enabled ?? true,
        capturedAt: item.capturedAt,
      });
    }

    const source = { uri: localUri };
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      Image.getSize(
        localUri,
        (width, height) => resolve({ width, height }),
        reject,
      );
    }).catch(() => ({ width: 1600, height: 1600 }));
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));

    let readyResolve: (() => void) | null = null;
    let readyReject: ((error: unknown) => void) | null = null;
    const readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const readyTimeout = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Timed out waiting for filtered photo to render.')), 8000);
    });

    setFilteredCaptureState({
      item,
      source,
      width,
      height,
      onReady: () => readyResolve?.(),
      onError: (error) => readyReject?.(error),
    });

    await Promise.race([readyPromise, readyTimeout]);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    try {
      const { captureRef } = await import('react-native-view-shot');
      return await captureRef(filteredCaptureRef, {
        format: 'jpg',
        quality: 0.98,
        result: 'tmpfile',
      });
    } finally {
      setFilteredCaptureState(null);
    }
  }

  async function saveSelectedPhotos() {
    if (selectedSaveKeys.length === 0) {
      Alert.alert('Nothing selected', 'Choose at least one photo to save.');
      return;
    }

    try {
      setSaveSaving(true);
      const MediaLibrary = await import('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access so we can save the selected photos.');
        return;
      }

      const selectedItems = saveItems.filter((item) => selectedSaveKeys.includes(item.key));
      let savedCount = 0;

      for (const item of selectedItems) {
        const localUri =
          saveMode === 'filtered'
            ? await renderFilteredSave(item)
            : await ensureLocalSaveUri(item);

        await MediaLibrary.Asset.create(localUri);
        savedCount += 1;
      }

      setSaveVisible(false);
      Alert.alert(
        'Saved',
        `Saved ${savedCount} item${savedCount === 1 ? '' : 's'} to your library.`,
      );
    } catch {
      Alert.alert('Error', 'Failed to save the selected photos.');
    } finally {
      setSaveSaving(false);
    }
  }

  // ── Derived ──
  const eventHasEnded = countdown.isCompleted;
  const timeLeftValue = buildTimeLeftValue();
  const showRecapBanner = ENABLE_EVENT_RECAP && eventHasEnded && (isHost || Boolean(recap && recap.status !== 'not_available'));
  const recapNeedsRetry = recap?.status === 'failed' || Boolean(recap?.lastErrorCode && recap.status !== 'ready');
  const recapPlaybackUri = recap?.playbackUrl
    ? `${recap.playbackUrl}${recap.playbackUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(recap.completedAt ?? '')}`
    : null;
  const selectedSaveCount = selectedSaveKeys.length;
  const allSaveChallengesSelected =
    saveItems.some((item) => item.isChallenge) &&
    saveItems.filter((item) => item.isChallenge).every((item) => selectedSaveKeys.includes(item.key));
  const allSaveVideosSelected =
    saveItems.some((item) => item.mediaType === 'video') &&
    saveItems.filter((item) => item.mediaType === 'video').every((item) => selectedSaveKeys.includes(item.key));
  const selectedRecapCount = selectedRecapKeys.length;
  const selectedRecapVideoCount = recapItems.filter((item) =>
    item.mediaType === 'video' && selectedRecapKeys.includes(item.key)
  ).length;
  const selectableRecapKeys = getLimitedRecapSelectionKeys(recapItems);
  const allSelectableRecapItemsSelected =
    selectableRecapKeys.length > 0 &&
    selectableRecapKeys.every((key) => selectedRecapKeys.includes(key)) &&
    selectedRecapKeys.every((key) => selectableRecapKeys.includes(key));
  const allRecapChallengesSelected =
    recapItems.some((item) => item.isChallenge) &&
    recapItems.filter((item) => item.isChallenge).every((item) => selectedRecapKeys.includes(item.key));
  const selectableRecapVideoCount = Math.min(
    recapItems.filter((item) => item.mediaType === 'video').length,
    RECAP_MAX_VIDEOS,
  );
  const allSelectableRecapVideosSelected =
    selectableRecapVideoCount > 0 && selectedRecapVideoCount === selectableRecapVideoCount;
  const recapSelectionError =
    selectedRecapCount === 0
      ? null
      : selectedRecapCount < RECAP_MIN_ITEMS
        ? `Choose at least ${RECAP_MIN_ITEMS} items.`
        : selectedRecapCount > RECAP_MAX_ITEMS
          ? `Choose up to ${RECAP_MAX_ITEMS} items.`
          : selectedRecapVideoCount > RECAP_MAX_VIDEOS
            ? `Choose up to ${RECAP_MAX_VIDEOS} videos.`
            : null;
  const recapCreateDisabled = recapCreating || selectedRecapCount < RECAP_MIN_ITEMS || Boolean(recapSelectionError);
  const recapStatusText =
    recap?.status === 'ready'
      ? 'Your event story is ready to watch.'
      : recapNeedsRetry
        ? 'Choose the photos and videos again to retry.'
        : recap?.status === 'queued' || recap?.status === 'processing'
          ? 'Creating your recap...'
          : 'Choose the photos and videos you want included.';

  const galleryPageX = useRef(new Animated.Value(0)).current;
  const galleryDragStartXRef = useRef(0);
  const galleryTabRef = useRef(galleryTab);
  const galleryGestureStartTabRef = useRef(galleryTab);
  const [galleryPageHeights, setGalleryPageHeights] = useState({ photos: 0, videos: 0 });

  useEffect(() => {
    galleryTabRef.current = galleryTab;
  }, [galleryTab]);

  const settleGalleryPager = useCallback(
    (next: 'photos' | 'videos', options: { haptic?: boolean } = {}) => {
      const changed = galleryTab !== next;
      setGalleryTab(next);
      Animated.spring(galleryPageX, {
        toValue: next === 'videos' ? screenWidth : 0,
        useNativeDriver: false,
        bounciness: 0,
        speed: 20,
      }).start();
      if (changed && options.haptic !== false) {
        void Haptics.selectionAsync().catch(() => {});
      }
    },
    [galleryPageX, galleryTab, screenWidth],
  );

  const selectGalleryTab = useCallback(
    (next: 'photos' | 'videos') => {
      if (!showMediaTabs || galleryTab === next) return;
      settleGalleryPager(next);
    },
    [galleryTab, settleGalleryPager, showMediaTabs],
  );

  const shouldClaimGallerySwipe = useCallback(
    (dx: number, dy: number) => {
      if (!showMediaTabs) return false;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 4 || absX < absY * 0.8) return false;

      // Dashboard <- Photos <-> Videos:
      // right from Photos belongs to the screen's normal back gesture, while
      // right from Videos first pages back to Photos.
      if (galleryTabRef.current === 'photos') return dx < 0;
      return dx > 0;
    },
    [showMediaTabs],
  );

  useEffect(() => {
    if (!showMediaTabs) {
      galleryPageX.setValue(0);
      return;
    }
    galleryPageX.setValue(galleryTabRef.current === 'videos' ? screenWidth : 0);
  }, [galleryPageX, screenWidth, showMediaTabs]);

  const galleryTabSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          shouldClaimGallerySwipe(gestureState.dx, gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          shouldClaimGallerySwipe(gestureState.dx, gestureState.dy),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          galleryGestureStartTabRef.current = galleryTabRef.current;
          galleryDragStartXRef.current = galleryTabRef.current === 'videos' ? screenWidth : 0;
          galleryPageX.stopAnimation((value: number) => {
            galleryDragStartXRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextX = Math.max(
            0,
            Math.min(screenWidth, galleryDragStartXRef.current - gestureState.dx),
          );
          galleryPageX.setValue(nextX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const startX = galleryDragStartXRef.current;
          const currentX = Math.max(0, Math.min(screenWidth, startX - gestureState.dx));
          const startTab = galleryGestureStartTabRef.current;
          const crossedDistance =
            startTab === 'photos'
              ? currentX > screenWidth * 0.06
              : currentX < screenWidth * 0.94;
          const flicked =
            startTab === 'photos'
              ? gestureState.vx < -0.08 && gestureState.dx < -2
              : gestureState.vx > 0.08 && gestureState.dx > 2;
          const next = crossedDistance || flicked
            ? startTab === 'photos' ? 'videos' : 'photos'
            : startTab;
          settleGalleryPager(next);
        },
        onPanResponderTerminate: () => {
          settleGalleryPager(galleryTab, { haptic: false });
        },
      }),
    [galleryPageX, galleryTab, screenWidth, settleGalleryPager, shouldClaimGallerySwipe],
  );

  const galleryIndicatorTranslateX = galleryPageX.interpolate({
    inputRange: [0, Math.max(1, screenWidth)],
    outputRange: [0, screenWidth / 2],
    extrapolate: 'clamp',
  });
  const galleryPagerHeight =
    showMediaTabs && galleryPageHeights.photos > 0 && galleryPageHeights.videos > 0
      ? galleryPageX.interpolate({
          inputRange: [0, Math.max(1, screenWidth)],
          outputRange: [galleryPageHeights.photos, galleryPageHeights.videos],
          extrapolate: 'clamp',
        })
      : null;
  const galleryTrackTranslateX = Animated.multiply(galleryPageX, -1);

  const recordGalleryPageHeight = useCallback((tab: 'photos' | 'videos', height: number) => {
    setGalleryPageHeights((current) => {
      if (Math.abs(current[tab] - height) < 1) return current;
      return { ...current, [tab]: height };
    });
  }, []);

  const renderGalleryGrid = (items: PhotoItem[], emptyLabel: string) => {
    if (items.length === 0) {
      return (
        <View style={S.emptyGallery}>
          <AppText variant="bodySmall" tone="secondary" align="center">
            {emptyLabel}
          </AppText>
        </View>
      );
    }

    return (
      <View style={S.gallery}>
        {Array.from({ length: GALLERY_COLUMNS }, (_, columnIndex) => (
          <View
            key={`gallery-column-${columnIndex}`}
            style={[S.galleryCol, columnIndex > 0 && { marginLeft: GRID_GAP }]}
          >
            {items
              .filter((_, photoIndex) => photoIndex % GALLERY_COLUMNS === columnIndex)
              .map((photo, rowIndex) => {
                const locked = Boolean(photo.locked);
                const isPinnedItem = Boolean(photo.isPinned || photo.is_pinned);
                return (
                  <Pressable
                    key={photo.id ?? `${columnIndex}-${rowIndex}`}
                    // `handlePhotoPress` resolves the item's own index within
                    // its media type's list itself, so there is nothing to
                    // compute here.
                    onPress={(e) => handlePhotoPress(photo, e)}
                    style={({ pressed }) => [
                      S.galleryCell,
                      { width: CELL_W, height: CELL_H },
                      pressed && !locked && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    {photo.mediaType === 'video' ? (
                      photo.thumbnailUri ? (
                        <Image
                          source={{ uri: photo.thumbnailUri }}
                          style={S.galleryCellImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <VideoPoster uri={photo.uri} style={S.galleryCellImg} />
                      )
                    ) : (
                      <TreatedPhoto
                        source={getPhotoSource(photo.uri)}
                        style={S.galleryCellImg}
                        resizeMode="cover"
                        blurRadius={locked ? 45 : 0}
                        treatment={primarySession?.photo_treatment}
                        dateStampEnabled={primarySession?.date_stamp_enabled}
                        capturedAt={photo.capturedAt}
                        seedKey={photo.id}
                      />
                    )}
                    {photo.mediaType === 'video' && !locked ? (
                      <View style={S.videoBadge}>
                        <AppText style={S.videoBadgeText}>
                          {formatMediaDuration(photo.durationMs) ?? 'Video'}
                        </AppText>
                      </View>
                    ) : null}
                    {!locked && isPinnedItem && (
                      <View style={S.pinBadge}>
                        <PinIcon size={12} color="#FFFFFF" />
                      </View>
                    )}
                    {locked && (
                      <View style={S.lockOverlay}>
                        <View style={S.lockCircle}>
                          <LockIcon size={18} color="#FFFFFF" />
                        </View>
                        {revealCountdownWords && (
                          <AppText style={S.lockCountdownText}>
                            Revealed in {revealCountdownWords}
                          </AppText>
                        )}
                      </View>
                    )}
                    {!locked && (
                      <View style={[S.photoNameTag, { maxWidth: Math.max(0, CELL_W - 24) }]}>
                        <AppText
                          style={S.photoNameText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {photo.takenBy || 'Guest'}
                        </AppText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View
      style={S.root}
      // The whole of preview-mode's inertness, in one place. Every tile, chip,
      // stat, tab and control below inherits it, so "the preview must look
      // real but not behave like the live event" cannot be broken by adding a
      // new control and forgetting to disable it.
      pointerEvents={previewMode ? 'none' : 'auto'}
      accessibilityElementsHidden={Boolean(previewMode)}
      importantForAccessibility={previewMode ? 'no-hide-descendants' : 'auto'}
    >

      {/* ══════════════════════════════════════════════════════
          SCROLLABLE BODY
          ══════════════════════════════════════════════════════ */}
      <Animated.ScrollView
        scrollEnabled={!previewMode}
        style={S.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        stickyHeaderIndices={showMediaTabs ? [1] : undefined}
        bounces
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        <View>

        {/* ── HERO ─────────────────────────────────────────── */}
        <View style={[S.hero, { height: HERO_TOTAL }]}>

          {/* Oversized image — transforms create parallax */}
          <Animated.View
            style={[
              S.heroImageWrapper,
              {
                height: IMG_H,
                top: IMG_TOP,
                transform: [
                  { translateY: imageParallax },
                  { scale: imageScale },
                ],
              },
            ]}
          >
            <Image
              source={getCoverSource()}
              style={S.heroImage}
              resizeMode="cover"
            />
          </Animated.View>

          {/* 6-stop cinematic gradient: top 58% untouched, dissolving naturally into solid black */}
          <Animated.View
            style={[S.heroScrim, previewMode?.overlays?.scrimOpacity
              ? { opacity: previewMode.overlays.scrimOpacity }
              : null]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={SCRIM_COLORS}
              locations={SCRIM_LOCATIONS}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Animated.View>

          {/* Floating nav icons */}
          <Animated.View
            style={[
              S.navBar,
              { paddingTop: insets.top + 6 },
              previewMode?.overlays?.chromeOpacity
                ? { opacity: previewMode.overlays.chromeOpacity }
                : null,
            ]}
          >
            {/* Hosts get a normal back button. Guests get an explicit "leave"
                control instead, since their swipe-back gesture is disabled
                below — this is the only way out of the event without it. */}
            <View style={S.navLeftGroup}>
              {isHost ? (
                <Pressable
                  style={S.navBtn}
                  onPress={handleGalleryBack}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <BackChevron />
                </Pressable>
              ) : Platform.OS === 'web' ? (
                <View style={[S.navBtn, { opacity: 0 }]} pointerEvents="none" />
              ) : (
                <Pressable
                  style={S.navBtn}
                  onPress={handleLeaveEvent}
                  accessibilityRole="button"
                  accessibilityLabel="Leave event"
                >
                  <CloseIcon size={20} color="#FFFFFF" />
                </Pressable>
              )}
              <Image
                source={GALLERY_NAV_MARK}
                accessibilityRole="image"
                accessibilityLabel={BRAND_CONFIG.appName}
                resizeMode="contain"
                style={S.navBrandMark}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                style={S.navBtn}
                onPress={() => setShareVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Share event"
              >
                <ShareTrayIcon />
              </Pressable>
              {/* Settings: only show for hosts */}
              {isHost && (
                <Pressable
                  style={S.navBtn}
                  onPress={() => router.push(`/celebration/${celebration.id}/edit` as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Event settings"
                >
                  <SettingsIcon />
                </Pressable>
              )}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              S.heroInfo,
              previewMode?.overlays?.chromeOpacity
                ? { opacity: previewMode.overlays.chromeOpacity }
                : null,
            ]}
          >
            {/*
              Date and title are one group, and are wrapped as one so the
              creation reveal can measure and carry them together — they read
              as a single piece of event information, not as two labels that
              happen to be stacked.
            */}
            <View
              ref={heroIdentityRef}
              onLayout={reportHeroIdentityRect}
              collapsable={false}
              style={S.heroIdentity}
            >
              <AppText variant="displayHero" align="center" style={S.heroTitle} numberOfLines={3}>
                {celebration.title}
              </AppText>
              {heroDate ? (
                <AppText variant="eyebrow" tone="secondary" align="center" style={S.heroDate}>
                  {heroDate}
                </AppText>
              ) : null}
            </View>

            <View style={S.galleryStatsRow}>
              <View style={S.galleryStatItem}>
                <AppText variant="titleMedium" style={S.galleryStatValue}>
                  {photos.length}
                </AppText>
                <AppText variant="eyebrow" tone="secondary" align="center">
                  Moments
                </AppText>
              </View>

              <AppText style={S.galleryStatDot}>•</AppText>

              <Pressable
                onPress={() => router.push(`/celebration/${celebration.id}/joined-guests`)}
                accessibilityRole="button"
                accessibilityLabel={`${guestsJoined} joined guests, open guest list`}
                hitSlop={8}
                style={({ pressed }) => [
                  S.galleryStatItem,
                  S.galleryStatPressable,
                  pressed && S.galleryStatPressed,
                ]}
              >
                <AppText variant="titleMedium" style={S.galleryStatValue}>
                  {guestsJoined}
                </AppText>
                <AppText variant="eyebrow" tone="secondary" align="center">
                  Joined
                </AppText>
              </Pressable>

              <AppText style={S.galleryStatDot}>•</AppText>

              <View style={S.galleryStatItem}>
                <AppText variant="titleMedium" style={S.galleryStatValue}>
                  {timeLeftValue}
                </AppText>
                <AppText variant="eyebrow" tone="secondary" align="center">
                  Time left
                </AppText>
              </View>
            </View>
          </Animated.View>
        </View>

        {showRecapBanner ? (
          <View style={S.recapBanner}>
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="titleMedium">Event recap</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {recapStatusText}
              </AppText>
            </View>
            {recap?.status === 'ready' && recapPlaybackUri ? (
              <View style={S.recapActionRow}>
                {isHost ? (
                  <Pressable
                    style={S.recapButtonSecondary}
                    onPress={openRecapSelection}
                    accessibilityRole="button"
                    accessibilityLabel="Change recap media"
                  >
                    <AppText style={S.recapButtonSecondaryText}>Change</AppText>
                  </Pressable>
                ) : null}
                <Pressable
                  style={S.recapButton}
                  onPress={() => setRecapVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Watch recap"
                >
                  <AppText style={S.recapButtonText}>Watch</AppText>
                </Pressable>
              </View>
            ) : !recapNeedsRetry && (recap?.status === 'queued' || recap?.status === 'processing') ? (
              <ActivityIndicator color={colours.textSecondary} />
            ) : isHost ? (
              <Pressable
                style={S.recapButton}
                onPress={openRecapSelection}
                accessibilityRole="button"
                accessibilityLabel={recapNeedsRetry ? 'Try recap again' : 'Create recap'}
              >
                <AppText style={S.recapButtonText}>
                  {recapNeedsRetry ? 'Try again' : 'Create'}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!isHost && guestName && (
          <View style={S.guestWelcome}>
            <AppText variant="eyebrow" tone="secondary" style={S.guestWelcomeEyebrow}>
              Welcome back
            </AppText>
            <AppText variant="displaySmall" style={S.guestWelcomeName}>
              {guestName}
            </AppText>
          </View>
        )}

        {isHost && challenges.length === 0 && !showGuestbook ? (
          <View style={S.challengesEmptyBannerWrap}>
            <ChallengesEmptyCard
              onPress={handleAddChallenge}
              hasSiblingChip={false}
              tileSize={selectorTileSize}
            />
          </View>
        ) : (showGuestbook || challenges.length > 0 || (isHost && challenges.length === 0)) ? (
          // Wraps the strip rather than its content: `contentContainerStyle`
          // is an ordinary style prop, so an animated value handed to it
          // arrives at the transform unresolved and throws at render.
          <Animated.View
            style={
              previewMode?.chipStripNudge
                ? { transform: [{ translateX: previewMode.chipStripNudge }] }
                : undefined
            }
          >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              S.chipsContent,
              isHost && challenges.length === 0 && { gap: GALLERY_PADDING },
            ]}
            style={S.chipsScroll}
          >
            {showGuestbook && (
              <Pressable
                style={({ pressed }) => [
                  S.chipWrap,
                  { width: selectorTileSize },
                  pressed && { opacity: 0.75 },
                  // Dimmed rather than greyed out: it is a real feature the
                  // host can have in two taps, not a broken one.
                  !guestbookUnlocked && S.chipLocked,
                ]}
                onPress={() => {
                  const open = () =>
                    router.push(`/celebration/${celebration.id}/guestbook` as never);
                  if (guestbookUnlocked) open();
                  else requestUpgrade('guestbook', 'Unlock Guestbook', open);
                }}
                accessibilityRole="button"
                accessibilityLabel={guestbookUnlocked ? 'Guestbook' : 'Guestbook, upgrade required'}
              >
                <LinearGradient
                  colors={['#C13584', '#E1306C', '#F77737', '#FCAF45']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    S.instagramGradientOuter,
                    {
                      width: selectorTileSize,
                      height: selectorTileSize,
                      borderRadius: CHIP_R,
                    },
                    { transform: [{ rotate: CHALLENGE_TILE_ROTATIONS[0] }] },
                  ]}
                >
                  <View style={[S.instagramInnerTile, {
                    width: selectorTileSize - 4.4,
                    height: selectorTileSize - 4.4,
                  }]}>
                    <View style={[S.instagramContentTile, {
                      width: selectorTileSize - 8.8,
                      height: selectorTileSize - 8.8,
                    }]}>
                      <GuestbookIcon size={24} color="#EFE9E0" />
                    </View>
                  </View>
                </LinearGradient>
                <AppText style={S.chipLabel} numberOfLines={2}>Guestbook</AppText>
                {!guestbookUnlocked ? <LockedBadge /> : null}
              </Pressable>
            )}

            {isHost && challenges.length === 0 && (
              <View style={!challengesUnlocked ? S.chipLocked : undefined}>
                <ChallengesEmptyCard
                  onPress={() => {
                    if (challengesUnlocked) handleAddChallenge();
                    else requestUpgrade('challenges', 'Unlock Challenges', handleAddChallenge);
                  }}
                  hasSiblingChip={showGuestbook}
                  tileSize={selectorTileSize}
                />
                {!challengesUnlocked ? <LockedBadge /> : null}
              </View>
            )}

            {challenges.map((challenge, index) => {
              const rotation =
                CHALLENGE_TILE_ROTATIONS[
                  (index + (showGuestbook ? 1 : 0)) % CHALLENGE_TILE_ROTATIONS.length
                ];

              return (
                <Pressable
                  key={challenge.id}
                  style={({ pressed }) => [S.chipWrap, { width: selectorTileSize }, pressed && { opacity: 0.75 }]}
                  onPress={() => handleChallengePhotoPress(challenge)}
                  accessibilityRole="button"
                  accessibilityLabel={`Challenge: ${challenge.label}`}
                  hitSlop={18}
                  pressRetentionOffset={18}
                >
                  <View style={[S.chipOuter, {
                    width: selectorTileSize,
                    height: selectorTileSize,
                    borderRadius: CHIP_R,
                    transform: [{ rotate: rotation }],
                  }]}>
                    {challenge.photo ? (
                      <Image
                        source={{ uri: challenge.photo }}
                        style={[S.chipPhoto, {
                          width: selectorTileSize,
                          height: selectorTileSize,
                          borderRadius: CHIP_R - 2,
                        }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[S.chipIconBg, {
                        width: selectorTileSize,
                        height: selectorTileSize,
                        borderRadius: CHIP_R,
                      }]}>
                        <SharedChallengeIconSVG type={challenge.icon} size={28} />
                      </View>
                    )}
                  </View>
                  <AppText style={S.chipLabel} numberOfLines={2}>
                    {challenge.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          {/*
            One line, only when something in the strip is locked, and only for
            the host. It answers the question a host would otherwise ask — "are
            my guests seeing a padlock?" — without a banner explaining the
            packaging, which is what the upgrade sheet is for.
          */}
          {showingLockedFeatures ? (
            <AppText variant="caption" style={S.hostOnlyNote}>
              Only you can see these
            </AppText>
          ) : null}
          </Animated.View>
        ) : null}
        </View>

        {showMediaTabs ? (
          <View style={S.galleryTabsSticky}>
            <View style={S.galleryTabsRow}>
              <Pressable
                onPress={() => selectGalleryTab('photos')}
                style={S.galleryTab}
                accessibilityRole="button"
                accessibilityLabel="Photos"
                accessibilityState={{ selected: galleryTab === 'photos' }}
                hitSlop={8}
              >
                <PhotoGridIcon
                  size={20}
                  color={galleryTab === 'photos' ? '#EFE9E0' : 'rgba(239, 233, 224, 0.4)'}
                />
              </Pressable>
              <Pressable
                onPress={() => selectGalleryTab('videos')}
                style={S.galleryTab}
                accessibilityRole="button"
                accessibilityLabel="Videos"
                accessibilityState={{ selected: galleryTab === 'videos' }}
                hitSlop={8}
              >
                <VideoTabIcon
                  size={20}
                  color={galleryTab === 'videos' ? '#EFE9E0' : 'rgba(239, 233, 224, 0.4)'}
                />
              </Pressable>
              <Animated.View
                pointerEvents="none"
                style={[
                  S.galleryTabIndicator,
                  {
                    width: screenWidth / 2,
                    transform: [{ translateX: galleryIndicatorTranslateX }],
                  },
                ]}
              />
            </View>
          </View>
        ) : null}

        <View {...(showMediaTabs ? galleryTabSwipeResponder.panHandlers : {})}>
          {visibleGalleryItems.length === 0 ? (
            <View style={S.emptyGallery}>
              <AppText variant="bodySmall" tone="secondary" align="center">
                No moments yet.{'\n'}Be the first to add one.
              </AppText>
            </View>
          ) : showMediaTabs ? (
            <Animated.View
              style={[
                S.galleryPagerViewport,
                galleryPagerHeight ? { height: galleryPagerHeight } : null,
              ]}
            >
              <Animated.View
                style={[
                  S.galleryPagerTrack,
                  {
                    width: screenWidth * 2,
                    transform: [{ translateX: galleryTrackTranslateX }],
                  },
                ]}
              >
                <View
                  style={{ width: screenWidth }}
                  onLayout={(event) => recordGalleryPageHeight('photos', event.nativeEvent.layout.height)}
                >
                  {renderGalleryGrid(heroPhotosOnly, 'No photos yet.')}
                </View>
                <View
                  style={{ width: screenWidth }}
                  onLayout={(event) => recordGalleryPageHeight('videos', event.nativeEvent.layout.height)}
                >
                  {renderGalleryGrid(heroVideosOnly, 'No videos yet.')}
                </View>
              </Animated.View>
            </Animated.View>
          ) : (
            renderGalleryGrid(
              heroPhotosOnly.length > 0 ? heroPhotosOnly : heroVideosOnly,
              heroPhotosOnly.length > 0 ? 'No photos yet.' : 'No videos yet.',
            )
          )}
        </View>

      </Animated.ScrollView>

      {/* ══════════════════════════════════════════════════════
          SHARED-ELEMENT HERO PHOTO VIEWER OVERLAY
          ══════════════════════════════════════════════════════ */}
      {heroVisible && (() => {
        // `heroNavPhotos`, not `photos` — scoped to whichever media type
        // this viewing session was opened on, so a swipe never crosses from
        // a photo into a video or back. See `heroMediaTrack` above.
        const activePhoto = heroNavPhotos[heroIndex] ?? null;
        if (!activePhoto) return null;
        const activeMediaLabel = activePhoto.mediaType === 'video' ? 'video' : 'photo';
        const activeMediaLabelTitle = activePhoto.mediaType === 'video' ? 'Video' : 'Photo';

        const pinnedCount = photos.filter((p) => p.isPinned === true || p.is_pinned === true).length;
        const isActivePinned = Boolean(activePhoto.isPinned || activePhoto.is_pinned);

        const handleToggleHeroPin = async () => {
          if (!isHost || !activePhoto || !celebration?.id) return;
          setHeroMenuVisible(false);
          const mediaItemId = activePhoto.id;
          if (!mediaItemId) {
            Alert.alert('Error', 'Cannot pin this item.');
            return;
          }

          try {
            if (isActivePinned) {
              await unpinHostPhoto({ mediaItemId, celebrationId: celebration.id });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } else {
              if (pinnedCount >= 2) {
                Alert.alert('Limit reached', 'Maximum of 2 pinned items allowed.');
                return;
              }
              await pinHostPhoto({ mediaItemId, celebrationId: celebration.id });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
            queryClient.invalidateQueries({
              queryKey: celebrationDetailKeys.detail(celebration.id),
            });
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not update pin status.');
          }
        };
        const canDeleteGuestPhoto =
          viewerRole === 'guest' &&
          Boolean(activePhoto.id) &&
          Boolean(guestAuth) &&
          (activePhoto.isMine === true ||
            (Boolean(activePhoto.guestSessionId) &&
              Boolean(guestAuth?.guestSessionId) &&
              activePhoto.guestSessionId === guestAuth?.guestSessionId));

        // Filtered treatments sit on the viewer's black stage. Only an
        // untouched original photo gets the blurred fill behind it.
        const heroUsesBlurredFill =
          normalisePhotoTreatment(primarySession?.photo_treatment) === 'original';

        const targetX = 16;
        const targetY = Math.max(insets.top + 48, 56);
        const targetW = screenWidth - 32;
        const targetH = screenHeight * 0.76;

        // Geometry for one page's media card. `heroPanX`/`heroPanY` are
        // deliberately absent: the strip below carries the gesture now, as a
        // transform, so the card itself only has to describe the open/close
        // animation.
        const boxY = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.y, targetY],
        });
        const boxW = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.width, targetW],
        });
        const boxH = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.height, targetH],
        });
        const boxX = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.x, targetX],
        });
        const boxRadius = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 24],
        });
        const bgOpacity = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.98],
        });
        const chromeOpacity = heroAnimProgress.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0, 0, 1],
        });

        /**
         * One page of the carousel: the media card and everything that
         * describes that particular photo.
         *
         * The caption, the author, the timestamp and the share actions live
         * *inside* the page rather than floating above the whole viewer. They
         * belong to one photo, so they travel with it — a caption that stayed
         * put while its photo slid away was a large part of what made the old
         * swipe feel like a slideshow rather than a carousel.
         */
        const renderHeroPage = (photo: PhotoItem) => {
          const mediaLabel = photo.mediaType === 'video' ? 'video' : 'photo';
          const caption = photo.caption?.trim();

          return (
            <>
              <Animated.View
                style={{
                  position: 'absolute',
                  left: boxX,
                  top: boxY,
                  width: boxW,
                  height: boxH,
                  borderRadius: boxRadius,
                  overflow: 'hidden',
                  backgroundColor: 'transparent',
                }}
              >
                {/*
                  What sits behind the sharp photo where its shape does not
                  fill the card.

                  For `original` that is a heavily blurred copy of the same
                  photo: showing photos at their true aspect ratio means the
                  card rarely matches the picture exactly, and a flat band
                  reads as a technical shortfall where the image softened
                  behind it reads as depth. Same URI as the sharp copy, so it
                  is the same cached bitmap and costs no extra decode.

                  For filtered photos it is plain black. Their treatments need
                  to blend into the viewer's own `#000000` stage, so the card
                  has no visible edge at all.

                  Either way the card's `overflow: hidden` clips it, so it
                  never reaches the surrounding viewer chrome.
                */}
                {heroUsesBlurredFill && photo.mediaType !== 'video' ? (
                  <>
                    <Image
                      source={getPhotoSource(photo.uri)}
                      style={ABSOLUTE_FILL}
                      resizeMode="cover"
                      blurRadius={HERO_MEDIA_FILL_BLUR}
                    />
                    <View style={[ABSOLUTE_FILL, { backgroundColor: 'rgba(11, 11, 12, 0.55)' }]} />
                  </>
                ) : (
                  <View style={[ABSOLUTE_FILL, { backgroundColor: '#000000' }]} />
                )}

                {photo.mediaType === 'video' ? (
                  <VideoPoster
                    uri={photo.uri}
                    style={{ width: '100%', height: '100%' }}
                    controls
                    autoPlay={photo.id === activePhoto.id}
                    muted={false}
                    contentFit="contain"
                  />
                ) : (
                  <TreatedPhoto
                    source={getPhotoSource(photo.uri)}
                    style={{ width: '100%', height: '100%' }}
                    /*
                      `contain`, not `cover`. The card is a fixed portrait
                      shape that is not the shape of any particular photo;
                      `cover` filled it by cropping and upscaling whatever did
                      not fit, which read as zoomed and soft. `contain` fits
                      the photo at its own aspect ratio instead.
                    */
                    resizeMode="contain"
                    treatment={primarySession?.photo_treatment}
                    dateStampEnabled={primarySession?.date_stamp_enabled}
                    capturedAt={photo.capturedAt}
                    seedKey={photo.id}
                  />
                )}
              </Animated.View>

              {caption ? (
                <Animated.View
                  style={[
                    S.heroCaptionBoxWrap,
                    // `chromeOpacity` still gates it during open/close, same
                    // as every other piece of chrome; `heroCaptionOpacity` is
                    // the caption's own timed fade on top of that.
                    { opacity: Animated.multiply(chromeOpacity, heroCaptionOpacity) },
                  ]}
                  pointerEvents="none"
                >
                  <View style={S.captionBoxInner}>
                    <AppText style={S.captionBoxText}>{caption}</AppText>
                  </View>
                </Animated.View>
              ) : null}

              <Animated.View
                style={{
                  position: 'absolute',
                  bottom: Math.max(insets.bottom + 12, 24),
                  left: 20,
                  right: 20,
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  opacity: chromeOpacity,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontFamily: 'InstrumentSans_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>
                    {photo.takenBy || 'Riya Sharma'}
                  </AppText>
                  {formatStoryTimestamp(photo.capturedAt) ? (
                    <AppText style={{ fontFamily: 'InstrumentSans_400Regular', fontSize: 13, color: 'rgba(255, 255, 255, 0.55)' }}>
                      {formatStoryTimestamp(photo.capturedAt)}
                    </AppText>
                  ) : null}
                  {photo.mediaType === 'video' ? (
                    <AppText style={{ fontFamily: 'InstrumentSans_400Regular', fontSize: 13, color: 'rgba(255, 255, 255, 0.55)' }}>
                      {formatMediaDuration(photo.durationMs) ?? 'Video'}
                    </AppText>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  <Pressable
                    onPress={() => void shareGalleryMediaToInstagram(photo)}
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${mediaLabel} to Instagram`}
                  >
                    <InstagramStoryIcon />
                  </Pressable>
                  <Pressable
                    onPress={() => void sharePhoto(photo)}
                    accessibilityRole="button"
                    accessibilityLabel="Share link to photo"
                  >
                    <ShareExportIcon />
                  </Pressable>
                  {photo.mediaType !== 'video' && (
                    <Pressable
                      onPress={() => void downloadPhoto(photo)}
                      accessibilityRole="button"
                      accessibilityLabel="Download photo"
                    >
                      <DownloadTrayIcon />
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            </>
          );
        };

        // The neighbours on either side, so a swipe reveals a page that is
        // already rendered rather than one that starts loading when it becomes
        // visible. Three keeps the mounted cost flat however long the gallery
        // is — and they join only once the open transition has settled, so
        // their renders never compete with it.
        const pageIndices = (heroSettled
          ? [heroIndex - 1, heroIndex, heroIndex + 1]
          : [heroIndex]
        ).filter((i) => i >= 0 && i < heroNavPhotos.length);

        return (
          <View style={ABSOLUTE_FILL}>
            {/*
              The page behind the viewer stays solid black, and stays put while
              the pages slide over it. The blurred fill belongs to the media
              area alone, so chrome always reads against one flat ground.
            */}
            <Animated.View
              style={[ABSOLUTE_FILL, { backgroundColor: '#000000', opacity: bgOpacity }]}
            />

            {/*
              The carousel.

              Every page is laid out at its own offset and the whole strip is
              moved by one transform, so a drag reveals the adjacent page
              because it is genuinely there — not because one image was
              swapped for another once the gesture finished, which is what the
              viewer used to do and what read as flashing.

              `translateX`/`translateY` rather than `left`/`top` is the other
              half of it: position is layout, and animating it ran a layout
              pass on the JS thread for every frame of the drag. A transform
              runs on the native thread and touches no layout at all.
            */}
            <Animated.View
              {...heroPanResponder.panHandlers}
              style={[
                ABSOLUTE_FILL,
                Platform.OS === 'web' ? S.webHeroViewerGestureLock : null,
                { transform: [{ translateX: heroPanX }, { translateY: heroPanY }] },
              ]}
            >
              {pageIndices.map((i) => {
                const photo = heroNavPhotos[i];
                if (!photo) return null;
                return (
                  <Pressable
                    key={photo.id ?? `hero-${i}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: screenWidth,
                      // Offsets are relative to the current page, so when the
                      // index advances the pages re-lay-out by exactly one
                      // width in the same commit that resets `heroPanX` by the
                      // same amount. The two cancel and nothing moves.
                      left: (i - heroIndex) * screenWidth,
                    }}
                    pointerEvents={i === heroIndex ? 'auto' : 'none'}
                    // A tap that isn't a drag — `heroPanResponder`'s capture
                    // handler only engages once the touch moves past its
                    // threshold, so a stationary tap reaches this Pressable
                    // untouched, exactly as it already does for the share and
                    // download buttons nested inside `renderHeroPage`. Those
                    // claim the touch themselves and never reach here, so
                    // pressing one of them does not also restart the caption
                    // timer.
                    onPress={() => armHeroCaptionTimer()}
                  >
                    {renderHeroPage(photo)}
                  </Pressable>
                );
              })}
            </Animated.View>

            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: Math.max(insets.top, 12),
                  left: 16,
                  right: 16,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  zIndex: 30,
                  opacity: chromeOpacity,
                },
              ]}
            >
              <Pressable onPress={() => closeHeroViewer()} style={S.circleHeaderBtn}>
                <CloseXIcon />
              </Pressable>
              <Pressable onPress={() => setHeroMenuVisible(true)} style={S.circleHeaderBtn}>
                <OverflowDotsIcon />
              </Pressable>
            </Animated.View>

            <Modal
              visible={heroMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setHeroMenuVisible(false)}
            >
              <Pressable style={S.modalOverlay} onPress={() => setHeroMenuVisible(false)}>
                <View style={S.menuSheet}>
                  {activePhoto.mediaType !== 'video' && (
                    <Pressable
                      style={S.menuOption}
                      onPress={() => {
                        setHeroMenuVisible(false);
                        void downloadPhoto(activePhoto);
                      }}
                    >
                      <AppText style={S.menuOptionText}>Save Original</AppText>
                    </Pressable>
                  )}
                  {isHost && (
                    <>
                      {isActivePinned ? (
                        <Pressable
                          style={[S.menuOption, S.menuOptionBorder]}
                          onPress={() => void handleToggleHeroPin()}
                        >
                          <AppText style={S.menuOptionText}>Unpin</AppText>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[
                            S.menuOption,
                            S.menuOptionBorder,
                            pinnedCount >= 2 && S.menuOptionDisabled,
                          ]}
                          onPress={pinnedCount >= 2 ? undefined : () => void handleToggleHeroPin()}
                          disabled={pinnedCount >= 2}
                        >
                          <AppText style={[S.menuOptionText, pinnedCount >= 2 && S.menuOptionDisabledText]}>
                            Pin to top
                          </AppText>
                        </Pressable>
                      )}

                      <Pressable
                        style={[S.menuOption, S.menuOptionBorder]}
                        onPress={() => {
                          setHeroMenuVisible(false);
                          Alert.alert(
                            `Delete this ${activeMediaLabel}?`,
                            'This will permanently remove it from the event gallery.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: `Delete ${activeMediaLabelTitle}`,
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    await deleteHeroGalleryPhoto(activePhoto, heroIndex);
                                  } catch (error) {
                                    console.error(`[gallery] failed to delete ${activeMediaLabel}`, error);
                                    Alert.alert('Error', `Could not delete this ${activeMediaLabel}. Please try again.`);
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <AppText style={S.menuDeleteText}>Delete {activeMediaLabelTitle}</AppText>
                      </Pressable>
                    </>
                  )}
                  {canDeleteGuestPhoto && (
                    <Pressable
                      style={[S.menuOption, S.menuOptionBorder]}
                      onPress={() => deleteGuestGalleryPhoto(activePhoto, heroIndex)}
                    >
                      <AppText style={S.menuDeleteText}>Delete {activeMediaLabelTitle}</AppText>
                    </Pressable>
                  )}
                  <Pressable style={[S.menuOption, S.menuCancelOption]} onPress={() => setHeroMenuVisible(false)}>
                    <AppText style={S.menuCancelText}>Cancel</AppText>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          </View>
        );
      })()}

      {/* ══════════════════════════════════════════════════════
          FLOATING CAMERA PILL FAB
          ══════════════════════════════════════════════════════ */}
      {(!heroVisible) && (
        <View style={[S.fabWrap, { bottom: insets.bottom + 28 }]}>
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
            onPress={eventHasEnded ? openSavePhotos : () => router.push(`/celebration/${celebration.id}/camera` as never)}
            accessibilityRole="button"
            accessibilityLabel={eventHasEnded ? 'Save photos' : 'Add a photo'}
          >
            {/* Outermost white border wrapper */}
            <View style={S.fabOutermostWhiteBorder}>
              {/* Inner black border wrapper */}
              <View style={S.fabOuterBlackBorder}>
                <View style={S.fabContentCircle}>
                  {eventHasEnded ? (
                    <View style={S.fabLabelRow}>
                      <DownloadTrayIcon size={20} color="#000000" />
                      <AppText style={S.fabLabelText}>Save</AppText>
                    </View>
                  ) : (
                    <CameraFABIcon size={26} color="#000000" />
                  )}
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          SHARE MODAL
          ══════════════════════════════════════════════════════ */}
      <InviteShareSheet
        visible={shareVisible}
        eventName={celebration.title}
        eventCode={celebration.event_code}
        bottomInset={insets.bottom}
        onClose={() => setShareVisible(false)}
      />

      {/* ══════════════════════════════════════════════════════
          INSTAGRAM STORY CHALLENGE VIEWER
          ══════════════════════════════════════════════════════ */}
      {selectedChallenge ? (() => {
          // The intro slide's backdrop is a blurred still, so it has to come
          // from a photo. A video URI handed to `Image` decodes to nothing and
          // renders black, so fall back through the photo submissions and then
          // to the event cover.
          const backdropSubmission = [...storySubmissions]
            .reverse()
            .find((item) => item.mediaType !== 'video');
          const coverPhoto = backdropSubmission
            ? { uri: backdropSubmission.uri }
            : getCoverSource();

          return (
            <StoryViewer
              backdrop={{ kind: 'blurredImage', source: coverPhoto }}
              icon={<SharedChallengeIconSVG type={selectedChallenge.icon} size={32} />}
              title={selectedChallenge.label}
              /* The host's saved instructions first. The icon's stock brief is
                 only the fallback for a challenge that has never been edited —
                 reading the preset unconditionally is what made custom
                 instructions look like they were never saved.
                 `resolveChallengeBrief` (rather than a raw map lookup) is what
                 the edit form pre-fills with, so an untouched challenge reads
                 identically in both. */
              description={
                selectedChallenge.instructions?.trim() ||
                resolveChallengeBrief(selectedChallenge.icon)?.instr ||
                'Locate the subject, frame your shot carefully, and tap Submit to complete this challenge.'
              }
              submissions={storySubmissions}
              activeSlideIndex={activeSlideIndex}
              onChangeSlideIndex={(index) => {
                setChallengeMenuVisible(false);
                setActiveSlideIndex(index);
              }}
              onDismiss={dismissStory}
              cta={{
                label: '📸 Add Yours',
                onPress: () => handleAddSubmission(selectedChallenge),
              }}
              canDeleteActive={canDeleteActiveChallengeSubmission}
              onPressOverflow={() => setChallengeMenuVisible(true)}
            />
          );
        })() : null}

      <Modal
        visible={challengeMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChallengeMenuVisible(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setChallengeMenuVisible(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[S.menuSheet, { minWidth: 240 }]}
          >
            <Pressable
              style={[S.menuOption, S.menuOptionBorder]}
              onPress={() => {
                setChallengeMenuVisible(false);
                setChallengeDeleteConfirmVisible(true);
              }}
            >
              <AppText style={S.menuDeleteText}>Delete {activeChallengeMediaLabel}</AppText>
            </Pressable>
            <Pressable style={[S.menuOption, S.menuCancelOption]} onPress={() => setChallengeMenuVisible(false)}>
              <AppText style={S.menuCancelText}>Cancel</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={challengeDeleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChallengeDeleteConfirmVisible(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setChallengeDeleteConfirmVisible(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[S.menuSheet, S.deleteConfirmSheet]}
          >
            <View style={S.deleteConfirmCopy}>
              <AppText style={S.deleteConfirmTitle}>Delete this {activeChallengeMediaLabel}?</AppText>
              <AppText style={S.deleteConfirmBody}>
                This will permanently remove it from the challenge story.
              </AppText>
            </View>
            <Pressable
              style={[S.menuOption, S.menuOptionBorder]}
              onPress={() => void deleteActiveChallengeSubmission()}
            >
              <AppText style={S.menuDeleteText}>Delete {activeChallengeMediaLabel}</AppText>
            </Pressable>
            <Pressable
              style={[S.menuOption, S.menuCancelOption]}
              onPress={() => setChallengeDeleteConfirmVisible(false)}
            >
              <AppText style={S.menuCancelText}>Cancel</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          SAVE PHOTOS MODAL
          ══════════════════════════════════════════════════════ */}
      <Modal
        visible={saveVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saveSaving) setSaveVisible(false);
        }}
      >
        <View style={S.saveOverlay}>
          <Pressable
            style={S.saveBackdrop}
            onPress={() => {
              if (!saveSaving) setSaveVisible(false);
            }}
          />

          <View style={[S.saveSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={S.sheetHandle} />

            <View style={S.saveHeaderRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="titleLarge">Save photos</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Pick original or filtered, then choose the photos to save.
                </AppText>
              </View>
              <Pressable
                onPress={() => {
                  if (!saveSaving) setSaveVisible(false);
                }}
                style={S.saveCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close save sheet"
              >
                <CloseIcon size={18} color={colours.textSecondary} />
              </Pressable>
            </View>

            {saveLoading ? (
              <View style={S.saveLoadingWrap}>
                <ActivityIndicator />
              </View>
            ) : (
              <>
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="bodyLarge">Save with original or filter?</AppText>
                  <SegmentedControl
                    accessibilityLabel="Save with original or filter?"
                    value={saveMode}
                    onChange={(value) => setSaveMode(value)}
                    options={[
                      { value: 'original', label: 'Original' },
                      { value: 'filtered', label: 'Filter' },
                    ]}
                  />
                </View>

                <View style={S.saveSelectionRow}>
                  <Pressable
                    style={S.saveCheckboxAction}
                    onPress={() => setAllSaveSelections(selectedSaveKeys.length !== saveItems.length)}
                  >
                    <View style={[S.saveCheckboxBox, selectedSaveKeys.length === saveItems.length && S.saveCheckboxBoxSelected]}>
                      {selectedSaveKeys.length === saveItems.length ? <CheckIcon size={12} color="#000000" /> : null}
                    </View>
                    <AppText style={S.saveCheckboxLabel}>Select All</AppText>
                  </Pressable>
                  <Pressable
                    style={S.saveCheckboxAction}
                    onPress={() => selectChallengePhotos(!allSaveChallengesSelected)}
                  >
                    <View
                      style={[
                        S.saveCheckboxBox,
                        allSaveChallengesSelected && S.saveCheckboxBoxSelected,
                      ]}
                    >
                      {allSaveChallengesSelected ? (
                        <CheckIcon size={12} color="#000000" />
                      ) : null}
                    </View>
                    <AppText style={S.saveCheckboxLabel}>Challenges</AppText>
                  </Pressable>
                  {saveItems.some((item) => item.mediaType === 'video') ? (
                    <Pressable
                      style={S.saveCheckboxAction}
                      onPress={() => setSaveVideoSelections(!allSaveVideosSelected)}
                    >
                      <View
                        style={[
                          S.saveCheckboxBox,
                          allSaveVideosSelected && S.saveCheckboxBoxSelected,
                        ]}
                      >
                        {allSaveVideosSelected ? <CheckIcon size={12} color="#000000" /> : null}
                      </View>
                      <AppText style={S.saveCheckboxLabel}>Videos</AppText>
                    </Pressable>
                  ) : null}
                </View>

                <FlatList
                  data={saveItems}
                  keyExtractor={(item) => item.key}
                  numColumns={3}
                  columnWrapperStyle={S.saveGridRow}
                  contentContainerStyle={S.saveGrid}
                  renderItem={({ item }) => {
                    const isSelected = selectedSaveKeys.includes(item.key);
                    return (
                      <Pressable
                        onPress={() => togglePhotoSelection(item.key)}
                        style={({ pressed }) => [
                          S.saveGridItem,
                          isSelected && S.saveGridItemSelected,
                          pressed && { opacity: 0.92 },
                        ]}
                      >
                        {item.mediaType === 'video' ? (
                          <VideoPoster uri={item.uri} style={S.saveGridImage} />
                        ) : (
                          <TreatedPhoto
                            source={item.source as ImageSourcePropType}
                            style={S.saveGridImage}
                            resizeMode="cover"
                            treatment={saveMode === 'filtered' ? primarySession?.photo_treatment : 'original'}
                            dateStampEnabled={primarySession?.date_stamp_enabled}
                            capturedAt={item.capturedAt}
                            seedKey={item.seedKey}
                            compact
                          />
                        )}
                        <View style={[S.saveCheckBadge, isSelected && S.saveCheckBadgeSelected]}>
                          {isSelected ? <CheckIcon size={14} color="#000000" /> : null}
                        </View>
                        {item.mediaType === 'video' ? (
                          <View style={S.saveVideoBadge}>
                            <AppText style={S.saveVideoBadgeText}>
                              {formatMediaDuration(item.durationMs) ?? 'Video'}
                            </AppText>
                          </View>
                        ) : null}
                        {item.isChallenge ? (
                          <View style={S.saveChallengeBadge}>
                            <AppText style={S.saveChallengeBadgeText} numberOfLines={1}>
                              {item.challengeLabel ?? 'Challenge'}
                            </AppText>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  }}
                />

                <Pressable
                  style={[
                    S.sheetBtnPrimary,
                    {
                      backgroundColor: colours.brandPrimary,
                      opacity: saveSaving || selectedSaveCount === 0 ? 0.65 : 1,
                    },
                  ]}
                  disabled={saveSaving || selectedSaveCount === 0}
                  onPress={() => void saveSelectedPhotos()}
                >
                  <AppText style={{ color: colours.textOnBrand, fontWeight: '700', fontSize: 15 }}>
                    {saveSaving ? 'Saving...' : `Save Photos (${selectedSaveCount})`}
                  </AppText>
                </Pressable>
              </>
            )}
          </View>

          {filteredCaptureState ? (
            <View
              ref={filteredCaptureRef}
              collapsable={false}
              style={[
                S.hiddenCaptureHost,
                {
                  width: filteredCaptureState.width,
                  height: filteredCaptureState.height,
                },
              ]}
            >
              <TreatedPhoto
                source={filteredCaptureState.source}
                style={[S.hiddenCaptureFrame, { width: filteredCaptureState.width, height: filteredCaptureState.height }]}
                resizeMode="cover"
                treatment={primarySession?.photo_treatment}
                dateStampEnabled={primarySession?.date_stamp_enabled}
                capturedAt={filteredCaptureState.item.capturedAt}
                seedKey={filteredCaptureState.item.seedKey}
                onReady={filteredCaptureState.onReady}
              />
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={recapSelectionVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!recapCreating) setRecapSelectionVisible(false);
        }}
      >
        <View style={S.saveOverlay}>
          <Pressable
            style={S.saveBackdrop}
            onPress={() => {
              if (!recapCreating) setRecapSelectionVisible(false);
            }}
          />

          <View style={[S.saveSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={S.sheetHandle} />

            <View style={S.saveHeaderRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="titleLarge">Create recap</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Pick {RECAP_MIN_ITEMS}-{RECAP_MAX_ITEMS} moments, including up to {RECAP_MAX_VIDEOS} videos.
                </AppText>
              </View>
              <Pressable
                onPress={() => {
                  if (!recapCreating) setRecapSelectionVisible(false);
                }}
                style={S.saveCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close recap selector"
              >
                <CloseIcon size={18} color={colours.textSecondary} />
              </Pressable>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyLarge">Use original or filter?</AppText>
              <SegmentedControl
                accessibilityLabel="Use original or filter?"
                value={recapMode}
                onChange={(value) => setRecapMode(value)}
                options={[
                  { value: 'original', label: 'Original' },
                  { value: 'filtered', label: 'Filter' },
                ]}
              />
            </View>

            <View style={S.saveSelectionRow}>
              <Pressable
                style={S.saveCheckboxAction}
                onPress={() => setAllRecapSelections(!allSelectableRecapItemsSelected)}
              >
                <View style={[S.saveCheckboxBox, allSelectableRecapItemsSelected && S.saveCheckboxBoxSelected]}>
                  {allSelectableRecapItemsSelected ? <CheckIcon size={12} color="#000000" /> : null}
                </View>
                <AppText style={S.saveCheckboxLabel}>Select All</AppText>
              </Pressable>
              <Pressable
                style={S.saveCheckboxAction}
                onPress={() => selectRecapChallengePhotos(!allRecapChallengesSelected)}
              >
                <View
                  style={[
                    S.saveCheckboxBox,
                    allRecapChallengesSelected && S.saveCheckboxBoxSelected,
                  ]}
                >
                  {allRecapChallengesSelected ? (
                    <CheckIcon size={12} color="#000000" />
                  ) : null}
                </View>
                <AppText style={S.saveCheckboxLabel}>Challenges</AppText>
              </Pressable>
              {recapItems.some((item) => item.mediaType === 'video') ? (
                <Pressable
                  style={S.saveCheckboxAction}
                  onPress={() => setRecapVideoSelections(!allSelectableRecapVideosSelected)}
                >
                  <View
                    style={[
                      S.saveCheckboxBox,
                      allSelectableRecapVideosSelected && S.saveCheckboxBoxSelected,
                    ]}
                  >
                    {allSelectableRecapVideosSelected ? <CheckIcon size={12} color="#000000" /> : null}
                  </View>
                  <AppText style={S.saveCheckboxLabel}>Videos</AppText>
                </Pressable>
              ) : null}
            </View>
            {recapSelectionError ? (
              <AppText variant="bodySmall" tone="secondary">
                {recapSelectionError}
              </AppText>
            ) : null}

            <FlatList
              data={recapItems}
              keyExtractor={(item) => item.key}
              numColumns={3}
              columnWrapperStyle={S.saveGridRow}
              contentContainerStyle={S.saveGrid}
              renderItem={({ item }) => {
                const isSelected = selectedRecapKeys.includes(item.key);
                return (
                  <Pressable
                    onPress={() => toggleRecapSelection(item.key)}
                    style={({ pressed }) => [
                      S.saveGridItem,
                      isSelected && S.saveGridItemSelected,
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    {item.mediaType === 'video' ? (
                      <VideoPoster uri={item.uri} style={S.saveGridImage} />
                    ) : (
                      <TreatedPhoto
                        source={item.source as ImageSourcePropType}
                        style={S.saveGridImage}
                        resizeMode="cover"
                        treatment={recapMode === 'filtered' ? primarySession?.photo_treatment : 'original'}
                        dateStampEnabled={recapMode === 'filtered' ? primarySession?.date_stamp_enabled : false}
                        capturedAt={item.capturedAt}
                        seedKey={item.seedKey}
                        compact
                      />
                    )}
                    <View style={[S.saveCheckBadge, isSelected && S.saveCheckBadgeSelected]}>
                      {isSelected ? <CheckIcon size={14} color="#000000" /> : null}
                    </View>
                    {item.mediaType === 'video' ? (
                      <View style={S.saveVideoBadge}>
                        <AppText style={S.saveVideoBadgeText}>
                          {formatMediaDuration(item.durationMs) ?? 'Video'}
                        </AppText>
                      </View>
                    ) : null}
                    {item.isChallenge ? (
                      <View style={S.saveChallengeBadge}>
                        <AppText style={S.saveChallengeBadgeText} numberOfLines={1}>
                          {item.challengeLabel ?? 'Challenge'}
                        </AppText>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />

            <Pressable
              style={[
                S.sheetBtnPrimary,
                {
                  backgroundColor: colours.brandPrimary,
                  opacity: recapCreateDisabled ? 0.65 : 1,
                },
              ]}
              disabled={recapCreateDisabled}
              onPress={() => void createSelectedRecap()}
            >
              <AppText style={{ color: colours.textOnBrand, fontWeight: '700', fontSize: 15 }}>
                {recapCreating ? 'Creating...' : `Create Recap (${selectedRecapCount})`}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ChallengePacksIntroModal
        visible={challengePacksIntroVisible}
        onGetStarted={() => void handleChallengePacksGetStarted()}
      />

      {/*
        One upgrade surface for every locked feature on this screen. Which
        tiers it offers comes from the entitlement layer, so it can only ever
        list packages that would actually unlock what was tapped.
      */}
      {upgradeRequest ? (
        <UpgradeSheet
          visible
          celebrationId={celebration.id}
          currentPlan={entitlements.plan}
          options={upgradesForFeature(entitlements.plan, upgradeRequest.feature)}
          title={upgradeRequest.title}
          onClose={() => setUpgradeRequest(null)}
          onUpgraded={() => {
            const resume = upgradeRequest.onUnlocked;
            setUpgradeRequest(null);
            // Straight into what they were reaching for. Landing back on the
            // gallery to hunt for it again is the thing this avoids.
            resume?.();
          }}
        />
      ) : null}

      <EventRevealModal
        visible={reveal.visible}
        state={reveal.state}
        eventName={celebration.title}
        photoCount={photos.length}
        countdownLabel={reveal.countdownLabel}
        thumbnails={revealThumbnails}
        confirming={reveal.confirming}
        onDismiss={reveal.dismiss}
        onViewPhotos={() => {
          reveal.dismiss();
        }}
      />

      {recap?.status === 'ready' && recapPlaybackUri ? (
        <RecapVideoModal
          visible={recapVisible}
          uri={recapPlaybackUri}
          celebrationTitle={celebration.title}
          onClose={() => setRecapVisible(false)}
        />
      ) : null}

      {videoPostedToastVisible ? (
        <View
          pointerEvents="none"
          style={[
            S.videoPostedToast,
            { top: Math.max(insets.top + spacing.base, spacing.xl) },
          ]}
        >
          <AppText style={S.videoPostedToastText}>Video posted to the gallery</AppText>
        </View>
      ) : null}

      {photoPostedToastVisible ? (
        <View
          pointerEvents="none"
          style={[
            S.videoPostedToast,
            { top: Math.max(insets.top + spacing.base, spacing.xl) },
          ]}
        >
          <AppText style={S.videoPostedToastText}>Photo posted to the gallery</AppText>
        </View>
      ) : null}
    </View>
  );
}


// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root ──
  root: { flex: 1, backgroundColor: colours.background },
  scroll: { flex: 1 },
  loadingRoot: {
    flex: 1,
    backgroundColor: colours.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPostedToast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 320,
    elevation: 320,
    backgroundColor: 'rgba(239, 233, 224, 0.96)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(11, 11, 12, 0.08)',
  },
  videoPostedToastText: {
    color: '#0B0B0C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },

  // ── Hero ──
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colours.background,
  },
  heroImageWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ── Nav bar ──
  navBar: {
    position: 'absolute',
    top: 0,
    left: layout.gutter,
    right: layout.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(11,11,12,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeftGroup: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Square, so it keeps the wordmark's height without its width. */
  navBrandMark: {
    width: 26,
    height: 26,
    opacity: 0.9,
  },

  // ── Hero info (overlaid on gradient) ──
  heroInfo: {
    position: 'absolute',
    bottom: 14,                       // Sits gracefully at the base of the cover image
    left: layout.gutter,
    right: layout.gutter,
    alignItems: 'center',
    gap: 8,
  },
  /** Title + date as one centered block, measured together for the creation reveal. */
  heroIdentity: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 2,
  },
  heroTitle: {
    color: colours.textPrimary,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  heroDate: {
    alignSelf: 'stretch',
    fontSize: 12,
    lineHeight: 15,
  },
  // ── Challenge chips (Instagram Story Highlights Style) ──
  chipsScroll: {
    marginTop: GALLERY_STRIP_GAP,
    overflow: 'visible',
  },
  challengesEmptyBannerWrap: {
    paddingHorizontal: GALLERY_PADDING,
    marginTop: 20,
    paddingBottom: spacing.xs,
  },
  chipsContent: {
    paddingLeft: GALLERY_PADDING,     // Aligns first tile with left edge of gallery below
    paddingRight: GALLERY_PADDING,
    gap: CHIP_GAP,
    paddingTop: 6,
    paddingBottom: 0,
    overflow: 'visible',
  },
  chipWrap: {
    alignItems: 'center',
    width: CHIP_D,
    gap: 9,
    overflow: 'visible',
  },

  // Add Challenge chip: dashed ring
  chipAddOuter: {
    width: CHIP_D,
    height: CHIP_D,
    borderRadius: CHIP_R,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,27,25,0.4)',
  },
  chipAddPlus: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 24,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 26,
    marginTop: -2,
  },

  // Challenge selector tile
  chipOuter: {
    width: CHIP_D,
    height: CHIP_D,
    borderRadius: CHIP_R,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPhoto: {
    width: CHIP_D,
    height: CHIP_D,
    borderRadius: CHIP_R - 2,
  },
  chipIconBg: {
    width: CHIP_D,
    height: CHIP_D,
    borderRadius: CHIP_R,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151515',
  },
  /** A locked feature is quieter, not disabled — it is two taps from working. */
  chipLocked: { opacity: 0.42 },
  hostOnlyNote: {
    color: colours.textSecondary,
    paddingHorizontal: GALLERY_PADDING,
    paddingTop: spacing.xs,
  },
  lockedBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.72)',
  },
  chipLabel: {
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 14,
  },
  instagramGradientOuter: {
    width: CHIP_D,
    height: CHIP_D,
    borderRadius: CHIP_R,
    padding: 2.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instagramInnerTile: {
    width: CHIP_D - 4.4,
    height: CHIP_D - 4.4,
    borderRadius: CHIP_R - 2,
    backgroundColor: '#0B0B0C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.2,
  },
  instagramContentTile: {
    width: CHIP_D - 8.8,
    height: CHIP_D - 8.8,
    borderRadius: CHIP_R - 4,
    backgroundColor: 'rgba(28,27,25,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Gallery stats ──
  galleryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'stretch',
  },
  galleryStatItem: {
    gap: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryStatPressable: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    marginVertical: -spacing.xs,
  },
  galleryStatPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  galleryStatValue: {
    color: colours.textPrimary,
    textAlign: 'center',
  },
  galleryStatDot: {
    color: 'rgba(255,255,255,0.24)',
    fontSize: 12,
    marginHorizontal: 2,
  },

  // ── Gallery ──
  gallery: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingHorizontal: GALLERY_EDGE_INSET,
  },
  galleryTabsSticky: {
    backgroundColor: colours.background,
    paddingTop: GALLERY_STRIP_GAP,
    zIndex: 30,
    elevation: 30,
  },
  galleryTabsRow: {
    flexDirection: 'row',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  galleryTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 13,
  },
  galleryTabIndicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 1.5,
    backgroundColor: '#EFE9E0',
  },
  galleryPagerViewport: {
    overflow: 'hidden',
  },
  galleryPagerTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  galleryCol: {
    flex: 1,
    gap: ROW_GAP,
  },
  galleryCell: {
    borderRadius: 22,                 // Softer 22px rounded corners for a premium appearance
    overflow: 'hidden',
    backgroundColor: colours.surface,
  },
  galleryCellImg: {
    width: '100%',
    height: '100%',
  },
  photoNameTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(11, 11, 12, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 5, 6, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCountdownText: {
    marginTop: 10,
    paddingHorizontal: 10,
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  photoNameText: {
    // Same face as the event title (`displayHero`/`titleLarge` in
    // src/design/typography.ts) rather than the
    // Instrument Sans used elsewhere in the grid's chrome.
    fontFamily: fontFamilies.display,
    fontSize: 13,
    color: '#EFE9E0',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  videoBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(11, 11, 12, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  emptyGallery: {
    marginTop: spacing.xxl,
    paddingVertical: spacing.huge,
    paddingHorizontal: layout.gutter,
    alignItems: 'center',
  },

  // ── Floating pill FAB ──
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  fabOutermostWhiteBorder: {
    height: 56,
    width: 140,
    borderRadius: 28,
    backgroundColor: '#EFE9E0', // matches warm ivory, outer white outline border
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1.5, // 1.5px white border thickness
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabOuterBlackBorder: {
    height: 56 - 3,
    width: 140 - 3,
    borderRadius: (56 - 3) / 2,
    backgroundColor: '#0B0B0C', // black border outline
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3, // 3px black border thickness
  },
  fabContentCircle: {
    height: 56 - 3 - 6,
    width: 140 - 3 - 6,
    borderRadius: (56 - 3 - 6) / 2,
    backgroundColor: '#EFE9E0', // warm ivory background for button fill
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabLabelText: {
    color: '#000000',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 16,
  },

  // The viewer owns the touch stream on web so horizontal drags cannot leak
  // into the page scroll view or browser navigation gesture.
  webHeroViewerGestureLock: {
    touchAction: 'none',
    overscrollBehavior: 'contain',
  } as any,

  // ── Share modal ──
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
    borderColor: colours.borderStrong,
  },

  // ── Save modal ──
  saveOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,5,6,0.88)',
  },
  saveBackdrop: {
    ...ABSOLUTE_FILL,
  },
  saveSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 80,
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
    gap: spacing.md,
    overflow: 'hidden',
  },
  saveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  saveCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
  },
  saveLoadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSelectionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveCheckboxAction: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    paddingHorizontal: spacing.sm,
  },
  saveCheckboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colours.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  saveCheckboxBoxSelected: {
    backgroundColor: colours.brandPrimary,
    borderColor: colours.brandPrimary,
  },
  saveCheckboxLabel: {
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 13,
    color: colours.textPrimary,
    textAlign: 'center',
  },
  saveMetaRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
  },
  saveGrid: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  saveGridRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  saveGridItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colours.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  saveGridItemSelected: {
    borderColor: colours.brandPrimary,
  },
  saveGridImage: {
    width: '100%',
    height: '100%',
  },
  saveCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(11, 11, 12, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCheckBadgeSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  saveChallengeBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 11, 12, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveChallengeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  saveEmptyWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  saveFooter: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  hiddenCaptureHost: {
    position: 'absolute',
    left: -10_000,
    top: -10_000,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  hiddenCaptureFrame: {
    width: 1,
    height: 1,
  },

  // ── Fallback ──
  fallbackBtn: {
    backgroundColor: colours.brandPrimary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.base,
  },
  fallbackBtnText: {
    color: colours.textOnBrand,
    fontWeight: '700',
  },

  // ── Story Viewer styles ──
  circleHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSheet: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  deleteConfirmSheet: {
    alignSelf: 'center',
    width: '86%',
    maxWidth: 340,
  },
  deleteConfirmCopy: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  deleteConfirmTitle: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  deleteConfirmBody: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.64)',
    textAlign: 'center',
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
  saveVideoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(11, 11, 12, 0.76)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  saveVideoBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 10,
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
  guestWelcome: {
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  recapBanner: {
    marginHorizontal: layout.gutter,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colours.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colours.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recapButton: {
    backgroundColor: colours.brandPrimary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recapActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recapButtonSecondary: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colours.borderSubtle,
  },
  recapButtonSecondaryText: {
    color: colours.textPrimary,
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 13,
  },
  recapButtonText: {
    color: colours.textOnBrand,
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 13,
  },
  // Semantic tokens throughout: the canvas is the app's near-black, not pure
  // `#000`, and type is the warm off-white, not `#FFF` — see the "nothing is
  // pure" note in `src/design/colours.ts`.
  recapViewerRoot: {
    flex: 1,
    backgroundColor: colours.background,
  },
  recapViewerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.md,
  },
  recapViewerHeaderText: {
    flex: 1,
    gap: spacing.xxs,
  },
  recapViewerCloseButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.pill,
    backgroundColor: colours.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapViewerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
  },
  recapViewerVideo: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colours.surfaceMuted,
  },
  recapViewerActions: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  recapViewerActionButton: {
    minHeight: 52,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // Ivory fill, ink label — the same primary treatment as the recap banner
  // this viewer opens from, and the pairing the palette mandates.
  recapViewerPrimaryButton: {
    backgroundColor: colours.brandPrimary,
    borderColor: colours.brandPrimary,
  },
  recapViewerSecondaryButton: {
    backgroundColor: 'transparent',
    borderColor: colours.borderStrong,
  },
  guestWelcomeEyebrow: {
    color: colours.textSecondary,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  guestWelcomeName: {
    color: colours.textPrimary,
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
  menuOptionDisabled: {
    opacity: 0.4,
  },
  menuOptionDisabledText: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  heroCaptionBoxWrap: {
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
