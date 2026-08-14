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
import * as Sharing from 'expo-sharing';
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
import { CloseIcon, LockIcon, PinIcon } from '@/components/ui/icons';
import { InviteShareSheet } from '@/features/sharing/invite-share-sheet';
import {
  archiveCelebration,
  celebrationDetailKeys,
  fetchCelebrationDetail,
  type CelebrationDetail,
} from '@/services/celebration-detail';
import { deleteGuestPhoto } from '@/services/guest-media-upload';
import { deleteHostPhoto } from '@/services/media-delete';
import { celebrationKeys } from '@/services/celebrations';
import { listThemes, themeKeys } from '@/services/themes';
import { EventRevealModal } from '@/components/feedback/event-reveal-modal';
import { TreatedPhoto } from '@/components/media/treated-photo';
import { canViewerSeePhotos, msUntilReveal, formatRevealCountdownWords } from '@/features/celebrations/reveal/state';
import { useRevealModal } from '@/features/celebrations/reveal/use-reveal-modal';
import { serverNow } from '@/services/server-time';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, radii, spacing, layout } from '@/design';
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
import { useCoverSource, FALLBACK_COVER } from '@/features/celebrations/cover-source';
import { createUniqueChannel } from '@/lib/supabase/realtime';
import { inferMimeTypeFromUri } from '@/features/media/storage-paths';

// ─── Layout constants ─────────────────────────────────────────────────────────

const GALLERY_PADDING = 16;
const GALLERY_EDGE_INSET = 0;
const GRID_GAP = 4;
const ROW_GAP = 4;
const GALLERY_COLUMNS = 3;

/** Challenge chips */
const CHIP_D = 68;  // outer circle diameter
const CHIP_R = CHIP_D / 2;

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

const GALLERY_PRESETS = [
  { id: 'preset_1', source: require('../../../../assets/images/placeholders/christian_wedding.png') },
  { id: 'preset_2', source: require('../../../../assets/images/placeholders/hindu_wedding.png') },
  { id: 'preset_3', source: require('../../../../assets/images/placeholders/treatment_preview_1.png') },
  { id: 'preset_4', source: require('../../../../assets/images/placeholders/treatment_preview_2.png') },
];

// ─── Challenge data ───────────────────────────────────────────────────────────

type Challenge = {
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

interface PhotoItem {
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
  mediaType?: 'photo' | 'video';
  durationMs?: number | null;
  mimeType?: string | null;
}

type PendingChallengePost = {
  challengeId: string;
  mediaItemId?: string | null;
  localUri?: string | null;
  mediaType?: 'photo' | 'video';
  postedAt?: string | null;
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

type FilteredCaptureState = {
  item: SavePhotoItem;
  source: ImageSourcePropType;
  width: number;
  height: number;
  onReady: () => void;
  onError: (error: unknown) => void;
} | null;

const DEFAULT_CHALLENGES: Challenge[] = [
  { id: 'c1', label: 'First Dance',      icon: 'firstDance' },
  { id: 'c2', label: 'Wedding Rings',    icon: 'rings' },
  { id: 'c3', label: 'Best Group Photo', icon: 'group' },
  { id: 'c4', label: 'Decor Details',    icon: 'decor' },
  { id: 'c5', label: 'Candlelight',      icon: 'candle' },
];

const EXTRA_CHALLENGES: Array<{ label: string; icon: string }> = [
  { label: 'Champagne Toast', icon: 'champagne' },
  { label: 'Wedding Cake',    icon: 'cake' },
  { label: 'Bridal Party',    icon: 'bouquet' },
  { label: 'Gifts & Cards',   icon: 'gift' },
  { label: 'Confetti',        icon: 'confetti' },
];
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
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls={controls}
      />
    </View>
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

function EventDetailView({
  detail,
  onArchive,
  archiving,
}: {
  detail: CelebrationDetail;
  onArchive: () => void;
  archiving: boolean;
}) {
  const router = useRouter();
  const { openPhotoId, videoPostedAt, openChallengeId, openChallengeMediaId, challengePostedAt } = useLocalSearchParams<{
    openPhotoId?: string;
    videoPostedAt?: string;
    openChallengeId?: string;
    openChallengeMediaId?: string;
    challengePostedAt?: string;
  }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { celebration, primarySession, metrics, viewerRole, mediaPhotos } = detail;

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
  const lastVideoPostedToastRef = useRef<string | null>(null);

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

  // Load guest name if this device joined as a guest
  useEffect(() => {
    if (!celebration || isHost) return;
    void loadStoredGuestSession(celebration.public_slug ?? celebration.id).then((session) => {
      if (session?.displayName) {
        setGuestName(session.displayName);
      }
    });
  }, [celebration, isHost]);

  const showGuestbook = isHost || detail.hasAudioGuestbook !== false;

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

  // Dynamic layout calculations inside component
  const HERO_H = Math.round(screenHeight * 0.49);
  const HERO_BLEED = 24;
  const HERO_TOTAL = HERO_H + HERO_BLEED;
  const PARALLAX_RANGE = HERO_H * 0.35;
  const IMG_H = HERO_TOTAL + PARALLAX_RANGE;
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
  const CELL_H = CELL_W * (16 / 9);

  // ── State ──
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>(DEFAULT_CHALLENGES);
  const [shareVisible, setShareVisible] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSaving, setSaveSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'original' | 'filtered'>('original');
  const [saveItems, setSaveItems] = useState<SavePhotoItem[]>([]);
  const [selectedSaveKeys, setSelectedSaveKeys] = useState<string[]>([]);
  const [saveVideosSelected, setSaveVideosSelected] = useState(true);
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

  // ── Theme ──
  const { data: themes } = useQuery({ queryKey: themeKeys.all, queryFn: listThemes });
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
    if (!mediaPhotos || mediaPhotos.length === 0) {
      setPhotos([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const client = requireSupabase();
      const { data, error } = await client.storage
        .from('event-media')
        .createSignedUrls(
          mediaPhotos.map((p) => p.storagePath),
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
                uploadedByUserId: p.uploadedByUserId ?? null,
                guestSessionId: p.guestSessionId ?? null,
                takenById: p.guestSessionId ?? p.uploadedByUserId ?? null,
                mediaType: p.mediaType ?? 'photo',
                durationMs: p.durationMs ?? null,
                mimeType: p.mimeType ?? null,
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
      const remote = await listChallenges(
        celebration.id,
        DEFAULT_CHALLENGES.map((item) => ({ label: item.label, icon: item.icon })),
      );
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
    setChallenges([...DEFAULT_CHALLENGES]);
  }, [celebration.id]);

  useFocusEffect(
    useCallback(() => {
      void loadChallenges();
    }, [loadChallenges]),
  );

  // Challenge edits from another device. `postgres_changes` carries the
  // subscriber's own RLS, so this reaches hosts and collaborators — a host
  // editing on their phone sees it on the web dashboard without refreshing.
  // Guests have no policy on this table by design and pick edits up on their
  // next fetch instead.
  useEffect(() => {
    if (!isBackendConfigured) return;

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
    // The host's own cover wins. Only an event that has never had one falls
    // through to the demo artwork — previously *every* event did, because this
    // consulted a theme-slug map that a real bucket path never matches.
    if (coverSource !== FALLBACK_COVER) return coverSource;
    if (celebration.cover_storage_path) return coverSource;
    const sum = celebration.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return GALLERY_PRESETS[sum % GALLERY_PRESETS.length].source;
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
    navigation.setOptions({ gestureEnabled: isHost && !heroVisible });
  }, [isHost, heroVisible, navigation]);

  const heroAnimProgress = useRef(new Animated.Value(0)).current;
  const heroPanY = useRef(new Animated.Value(0)).current;
  const heroPanX = useRef(new Animated.Value(0)).current;

  // There's only one image element for the hero viewer — it swaps to the new
  // photo when `heroIndex` changes, rather than sliding between two stacked
  // images. So resetting `heroPanX` back to 0 has to land in the same paint
  // as that swap, or the OLD photo flashes back into view at rest (fully
  // on-screen) for one frame before the new photo appears. Resetting it
  // inside the swipe animation's `.start()` callback was too early: that
  // callback calls `heroPanX.setValue(0)` synchronously, but `setHeroIndex`
  // alongside it is an async state update — React hasn't re-rendered with
  // the new photo yet, so the visible frame in between is the OLD photo
  // sitting at translateX: 0. `useLayoutEffect` runs synchronously right
  // after React commits the new `heroIndex` but before the screen paints, so
  // this reset lands in the same frame as the photo swap instead of before it.
  useLayoutEffect(() => {
    heroPanX.setValue(0);
  }, [heroIndex, heroPanX]);

  function getThumbBounds(idx: number) {
    const col = idx % GALLERY_COLUMNS;
    const row = Math.floor(idx / GALLERY_COLUMNS);
    const x = GALLERY_EDGE_INSET + col * (CELL_W + GRID_GAP);
    const y = 350 + row * (CELL_H + ROW_GAP);
    return { x, y, width: CELL_W, height: CELL_H };
  }

  function handlePhotoPress(index: number, e?: any) {
    if (isGalleryLocked) {
      Alert.alert('Gallery is locked', 'Photos will be revealed automatically once the countdown ends!');
      return;
    }
    // Seeing the photographs IS the news. Someone who got here another way —
    // a deep link, a notification — should not be told about it afterwards.
    reveal.markRevealedSeen();
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
    Animated.spring(heroAnimProgress, {
      toValue: 1,
      useNativeDriver: false,
      bounciness: 4,
      speed: 12,
    }).start();
  }

  useEffect(() => {
    if (!openPhotoId || lastOpenedPhotoIdRef.current === openPhotoId) {
      return;
    }

    const index = photos.findIndex((photo) => photo.id === openPhotoId);
    if (index < 0) {
      return;
    }

    lastOpenedPhotoIdRef.current = openPhotoId;
    handlePhotoPress(index);
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

  function closeHeroViewer() {
    Animated.timing(heroAnimProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setHeroVisible(false);
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
  const heroPhotosLengthRef = useRef(photos.length);

  useEffect(() => {
    heroIndexRef.current = heroIndex;
    heroPhotosLengthRef.current = photos.length;
  }, [heroIndex, photos.length]);

  const heroPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 5 || Math.abs(gestureState.dx) > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          heroPanY.setValue(gestureState.dy);
        } else if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
          heroPanX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Vertical dismissal threshold -> shrink back to thumbnail origin
        if (gestureState.dy > 100 || (gestureState.dy > 50 && gestureState.vy > 0.5)) {
          closeHeroViewer();
          return;
        }

        Animated.spring(heroPanY, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 6,
        }).start();

        // Horizontal gallery carousel swipe
        if (gestureState.dx < -50 || (gestureState.dx < -20 && gestureState.vx < -0.3)) {
          if (heroIndexRef.current < heroPhotosLengthRef.current - 1) {
            void Haptics.selectionAsync().catch(() => {});
            Animated.timing(heroPanX, {
              toValue: -400,
              duration: 150,
              useNativeDriver: false,
            }).start(() => {
              // heroPanX resets in the useLayoutEffect above, synchronized
              // with the photo swap — not here, or the old photo flashes back.
              const nextIdx = heroIndexRef.current + 1;
              setHeroIndex(nextIdx);
              setHeroStartBounds(getThumbBounds(nextIdx));
            });
            return;
          }
        } else if (gestureState.dx > 50 || (gestureState.dx > 20 && gestureState.vx > 0.3)) {
          if (heroIndexRef.current > 0) {
            void Haptics.selectionAsync().catch(() => {});
            Animated.timing(heroPanX, {
              toValue: 400,
              duration: 150,
              useNativeDriver: false,
            }).start(() => {
              // heroPanX resets in the useLayoutEffect above, synchronized
              // with the photo swap — not here, or the old photo flashes back.
              const prevIdx = heroIndexRef.current - 1;
              setHeroIndex(prevIdx);
              setHeroStartBounds(getThumbBounds(prevIdx));
            });
            return;
          }
        }

        Animated.spring(heroPanX, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 6,
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

  function handleAddChallenge() {
    router.push(`/celebration/${celebration.id}/challenges/new` as never);
  }

  async function openSavePhotos() {
    try {
      setSaveLoading(true);
      setSaveVisible(true);
      setSaveMode('original');
      setSaveItems([]);
      setSelectedSaveKeys([]);
      setSaveVideosSelected(true);

      const itemsByUri = new Map<string, SavePhotoItem>();
      const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));

      photos.forEach((photo) => {
        mergeSaveItem(itemsByUri, {
          key: photo.id ?? photo.uri,
          uri: photo.uri,
          source: photo.mediaType === 'video' ? null : resolvePhotoSourceForSaving(photo.uri),
          takenBy: photo.takenBy || 'Guest',
          isChallenge: false,
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
      `candidly-save-${celebration.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`,
    );
    const downloaded = await FileSystem.File.downloadFileAsync(sourceUri, destinationFile);
    return downloaded.uri;
  }

  async function shareGalleryMediaToInstagram(photo: PhotoItem) {
    void Haptics.selectionAsync().catch(() => {});
    const isVideo = photo.mediaType === 'video';
    const mediaLabel = isVideo ? 'video' : 'photo';

    try {
      if (Platform.OS === 'web') {
        await Share.share({
          title: `Share ${mediaLabel} to Instagram`,
          message: photo.uri,
          url: photo.uri,
        });
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }

      const localUri = await ensureLocalSaveUri({
        key: photo.id ?? photo.uri,
        uri: photo.uri,
        source: isVideo ? null : resolvePhotoSourceForSaving(photo.uri),
        takenBy: photo.takenBy,
        isChallenge: Boolean(photo.challengeId),
        seedKey: photo.id ?? photo.uri,
        capturedAt: photo.capturedAt,
        mediaType: photo.mediaType ?? 'photo',
        durationMs: photo.durationMs,
      });
      const mimeType = photo.mimeType ?? inferMimeTypeFromUri(localUri);

      await Sharing.shareAsync(localUri, {
        dialogTitle: `Share ${mediaLabel} to Instagram`,
        mimeType,
        UTI: isVideo ? 'public.movie' : 'public.image',
      });
    } catch (error) {
      console.error(`[gallery] failed to share ${mediaLabel} to Instagram`, error);
      Alert.alert(
        'Could not share',
        error instanceof Error
          ? error.message
          : `This ${mediaLabel} could not be shared. Please try again.`,
      );
    }
  }

  async function renderFilteredSave(item: SavePhotoItem) {
    if (item.mediaType === 'video') {
      return ensureLocalSaveUri(item);
    }
    const localUri = await ensureLocalSaveUri(item);
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

      const selectedItems = saveItems.filter((item) =>
        selectedSaveKeys.includes(item.key) && (saveVideosSelected || item.mediaType !== 'video'),
      );
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

  return (
    <View style={S.root}>

      {/* ══════════════════════════════════════════════════════
          SCROLLABLE BODY
          ══════════════════════════════════════════════════════ */}
      <Animated.ScrollView
        style={S.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        bounces
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >

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
          <LinearGradient
            colors={SCRIM_COLORS}
            locations={SCRIM_LOCATIONS}
            style={S.heroScrim}
            pointerEvents="none"
          />

          {/* Floating nav icons */}
          <View style={[S.navBar, { paddingTop: insets.top + 6 }]}>
            {/* Hosts get a normal back button. Guests get an explicit "leave"
                control instead, since their swipe-back gesture is disabled
                below — this is the only way out of the event without it. */}
            {isHost ? (
              <Pressable
                style={S.navBtn}
                onPress={() => router.replace('/home')}
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
          </View>

          <View style={S.heroInfo}>
            {celebration.ends_at ? (
              <AppText variant="eyebrow" tone="secondary" align="center">
                {new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: celebration.timezone,
                }).format(new Date(celebration.ends_at))}
              </AppText>
            ) : null}
            <AppText variant="displayHero" align="center" style={S.heroTitle} numberOfLines={3}>
              {celebration.title}
            </AppText>
          </View>
        </View>

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.chipsContent}
          style={S.chipsScroll}
        >
          {isHost && (
            <Pressable
              style={({ pressed }) => [S.chipWrap, pressed && { opacity: 0.75 }]}
              onPress={handleAddChallenge}
              accessibilityRole="button"
              accessibilityLabel="Add new challenge"
              hitSlop={10}
            >
              <View style={S.chipAddOuter}>
                <AppText style={S.chipAddPlus}>+</AppText>
              </View>
              <AppText style={S.chipLabel} numberOfLines={2}>Add new{'\n'}challenge</AppText>
            </Pressable>
          )}

            {showGuestbook && (
              <Pressable
                style={({ pressed }) => [S.chipWrap, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/celebration/${celebration.id}/guestbook` as never)}
                accessibilityRole="button"
                accessibilityLabel="Guestbook"
              >
                <LinearGradient
                  colors={['#C13584', '#E1306C', '#F77737', '#FCAF45']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={S.instagramGradientOuter}
                >
                  <View style={S.instagramInnerCircle}>
                    <View style={S.instagramContentCircle}>
                      <GuestbookIcon size={24} color="#EFE9E0" />
                    </View>
                  </View>
                </LinearGradient>
                <AppText style={S.chipLabel} numberOfLines={2}>Guestbook</AppText>
              </Pressable>
            )}

            {challenges.map((challenge) => (
              <Pressable
                key={challenge.id}
                style={({ pressed }) => [S.chipWrap, pressed && { opacity: 0.75 }]}
                onPress={() => handleChallengePhotoPress(challenge)}
                accessibilityRole="button"
                accessibilityLabel={`Challenge: ${challenge.label}`}
                hitSlop={18}
                pressRetentionOffset={18}
              >
                <View style={S.chipOuter}>
                  {challenge.photo ? (
                    <Image
                      source={{ uri: challenge.photo }}
                      style={S.chipPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={S.chipIconBg}>
                      <SharedChallengeIconSVG type={challenge.icon} size={28} />
                    </View>
                  )}
                </View>
                <AppText style={S.chipLabel} numberOfLines={2}>
                  {challenge.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>

          {(() => {
            const visiblePhotos = photos
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
              });

            if (visiblePhotos.length === 0) {
              return (
                <View style={S.emptyGallery}>
                  <AppText variant="bodySmall" tone="secondary" align="center">
                    No moments yet.{'\n'}Be the first to add one.
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
                    {visiblePhotos
                      .filter((_, photoIndex) => photoIndex % GALLERY_COLUMNS === columnIndex)
                      .map((photo, rowIndex) => {
                        const originalIndex = rowIndex * GALLERY_COLUMNS + columnIndex;
                        const locked = Boolean(photo.locked);
                        const isPinnedItem = Boolean(photo.isPinned || photo.is_pinned);
                        return (
                          <Pressable
                            key={photo.id ?? `${columnIndex}-${rowIndex}`}
                            onPress={(e) => handlePhotoPress(originalIndex, e)}
                            style={({ pressed }) => [
                              S.galleryCell,
                              { width: CELL_W, height: CELL_H },
                              pressed && !locked && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                            ]}
                          >
                            {photo.mediaType === 'video' ? (
                              <VideoPoster uri={photo.uri} style={S.galleryCellImg} />
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
          })()}

      </Animated.ScrollView>

      {/* ══════════════════════════════════════════════════════
          SHARED-ELEMENT HERO PHOTO VIEWER OVERLAY
          ══════════════════════════════════════════════════════ */}
      {heroVisible && (() => {
        const activePhoto = photos[heroIndex] ?? null;
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

        const targetX = 16;
        const targetY = Math.max(insets.top + 48, 56);
        const targetW = screenWidth - 32;
        const targetH = screenHeight * 0.76;

        const boxX = Animated.add(heroPanX, heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.x, targetX],
        }));

        const boxY = Animated.add(heroPanY, heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.y, targetY],
        }));

        const boxW = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.width, targetW],
        });

        const boxH = heroAnimProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [heroStartBounds.height, targetH],
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

        return (
          <View style={ABSOLUTE_FILL}>
            <Animated.View
              style={[
                ABSOLUTE_FILL,
                { backgroundColor: '#000000', opacity: bgOpacity },
              ]}
            />

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

            <Animated.View
              {...heroPanResponder.panHandlers}
              style={{
                position: 'absolute',
                left: boxX,
                top: boxY,
                width: boxW,
                height: boxH,
                borderRadius: boxRadius,
                overflow: 'hidden',
                backgroundColor: '#0D0D0E',
                zIndex: 20,
              }}
            >
              {activePhoto.mediaType === 'video' ? (
                <VideoPoster
                  uri={activePhoto.uri}
                  style={{ width: '100%', height: '100%' }}
                  controls
                  autoPlay
                  muted={false}
                  contentFit="contain"
                />
              ) : (
                <TreatedPhoto
                  source={getPhotoSource(activePhoto.uri)}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  treatment={primarySession?.photo_treatment}
                  dateStampEnabled={primarySession?.date_stamp_enabled}
                  capturedAt={activePhoto.capturedAt}
                  seedKey={activePhoto.id}
                />
              )}
            </Animated.View>

            <Animated.View
              style={[
                {
                  position: 'absolute',
                  bottom: Math.max(insets.bottom + 12, 24),
                  left: 20,
                  right: 20,
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  zIndex: 30,
                  opacity: chromeOpacity,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontFamily: 'InstrumentSans_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>
                  {activePhoto.takenBy || 'Riya Sharma'}
                </AppText>
                {formatStoryTimestamp(activePhoto.capturedAt) ? (
                  <AppText style={{ fontFamily: 'InstrumentSans_400Regular', fontSize: 13, color: 'rgba(255, 255, 255, 0.55)' }}>
                    {formatStoryTimestamp(activePhoto.capturedAt)}
                  </AppText>
                ) : null}
                {activePhoto.mediaType === 'video' ? (
                  <AppText style={{ fontFamily: 'InstrumentSans_400Regular', fontSize: 13, color: 'rgba(255, 255, 255, 0.55)' }}>
                    {formatMediaDuration(activePhoto.durationMs) ?? 'Video'}
                  </AppText>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <Pressable
                  onPress={() => void shareGalleryMediaToInstagram(activePhoto)}
                  accessibilityRole="button"
                  accessibilityLabel={`Share ${activeMediaLabel} to Instagram`}
                >
                  <InstagramStoryIcon />
                </Pressable>
                <Pressable onPress={() => { void Haptics.selectionAsync(); Share.share({ message: `Photo by ${activePhoto.takenBy || 'Guest'}` }); }}>
                  <ShareExportIcon />
                </Pressable>
                <Pressable onPress={() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert('Saved', 'Photo saved to Camera Roll.'); }}>
                  <DownloadTrayIcon />
                </Pressable>
              </View>
            </Animated.View>

            <Modal
              visible={heroMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setHeroMenuVisible(false)}
            >
              <Pressable style={S.modalOverlay} onPress={() => setHeroMenuVisible(false)}>
                <View style={S.menuSheet}>
                  <Pressable style={S.menuOption} onPress={() => { setHeroMenuVisible(false); Alert.alert('Saved', 'Photo saved to Camera Roll.'); }}>
                    <AppText style={S.menuOptionText}>Save Original</AppText>
                  </Pressable>
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
                    onPress={() => selectChallengePhotos(!saveItems.some((item) => item.isChallenge && selectedSaveKeys.includes(item.key)))}
                  >
                    <View
                      style={[
                        S.saveCheckboxBox,
                        saveItems.some((item) => item.isChallenge && selectedSaveKeys.includes(item.key)) && S.saveCheckboxBoxSelected,
                      ]}
                    >
                      {saveItems.some((item) => item.isChallenge && selectedSaveKeys.includes(item.key)) ? (
                        <CheckIcon size={12} color="#000000" />
                      ) : null}
                    </View>
                    <AppText style={S.saveCheckboxLabel}>Select Challenges</AppText>
                  </Pressable>
                  {saveItems.some((item) => item.mediaType === 'video') ? (
                    <Pressable
                      style={S.saveCheckboxAction}
                      onPress={() => setSaveVideosSelected((current) => !current)}
                    >
                      <View
                        style={[
                          S.saveCheckboxBox,
                          saveVideosSelected && S.saveCheckboxBoxSelected,
                        ]}
                      >
                        {saveVideosSelected ? <CheckIcon size={12} color="#000000" /> : null}
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
                    { backgroundColor: colours.brandPrimary, opacity: saveSaving ? 0.65 : 1 },
                  ]}
                  disabled={saveSaving}
                  onPress={() => void saveSelectedPhotos()}
                >
                  <AppText style={{ color: colours.textOnBrand, fontWeight: '700', fontSize: 15 }}>
                    {saveSaving ? 'Saving…' : 'Save Photos'}
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

  // ── Hero info (overlaid on gradient) ──
  heroInfo: {
    position: 'absolute',
    bottom: 4,                        // Lowered by ~25px so it sits squarely inside the dark portion of the gradient
    left: layout.gutter,
    right: layout.gutter,
    gap: 12,                          // Generous spacing between title and metadata row
  },
  heroTitle: {
    color: colours.textPrimary,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  // ── Challenge chips (Instagram Story Highlights Style) ──
  chipsScroll: {
    marginTop: 16,
  },
  chipsContent: {
    paddingLeft: GALLERY_PADDING,     // Aligns first circle perfectly with left edge of gallery below
    paddingRight: GALLERY_PADDING,
    gap: 8,                           // Tighter spacing so the challenge strip feels denser
    paddingBottom: spacing.xs,
  },
  chipWrap: {
    alignItems: 'center',
    width: CHIP_D + 6,
    gap: 8,
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

  // Existing challenge chip: double ring accent
  chipOuter: {
    width: CHIP_D,
    height: CHIP_D,
    borderRadius: CHIP_R,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    backgroundColor: 'rgba(28,27,25,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPhoto: {
    width: CHIP_D,
    height: CHIP_D,
  },
  chipIconBg: {
    width: CHIP_D,
    height: CHIP_D,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,27,25,0.95)',
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
  instagramInnerCircle: {
    width: CHIP_D - 4.4,
    height: CHIP_D - 4.4,
    borderRadius: (CHIP_D - 4.4) / 2,
    backgroundColor: '#0B0B0C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.2,
  },
  instagramContentCircle: {
    width: CHIP_D - 8.8,
    height: CHIP_D - 8.8,
    borderRadius: (CHIP_D - 8.8) / 2,
    backgroundColor: 'rgba(28,27,25,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Gallery stats ──
  galleryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GALLERY_PADDING,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  galleryStatItem: {
    gap: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryStatPressable: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
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
    top: 12,
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
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 10,
    color: '#EFE9E0',
    letterSpacing: 0.5,
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
});
