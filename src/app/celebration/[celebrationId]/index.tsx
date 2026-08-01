/**
 * Event Detail Screen — 1:1 Pixel-Refined Editorial Layout
 *
 * Design language: "Ink & Ivory". Photography is the hero.
 * Inspired by Leica, Kinfolk Magazine, Apple Photos, and luxury wedding albums.
 */

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
  ScrollView,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { useAuth } from '@/features/auth/context';
import { isBackendConfigured } from '@/lib/supabase/client';
import { fetchMyProfile, profileKeys, firstNameFrom } from '@/services/profile';
import { BRAND_CONFIG } from '@/config/brand';
import { shouldShowHostControls } from '@/lib/platform-guards';
import { loadStoredGuestSession } from '@/services/guest-session';
import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { QrCodeIcon, CloseIcon, LockIcon } from '@/components/ui/icons';
import {
  archiveCelebration,
  celebrationDetailKeys,
  fetchCelebrationDetail,
  type CelebrationDetail,
} from '@/services/celebration-detail';
import { celebrationKeys } from '@/services/celebrations';
import { listThemes, themeKeys } from '@/services/themes';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, radii, spacing, layout } from '@/design';
import { copy } from '@/i18n';

// ─── Layout constants ─────────────────────────────────────────────────────────

const GALLERY_PADDING = 16;
const GRID_GAP = 16;
const ROW_GAP = 20;

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

const COVER_MAP: Record<string, ReturnType<typeof require>> = {
  modern:      require('../../../../assets/images/placeholders/christian_wedding.png'),
  classic:     require('../../../../assets/images/placeholders/christian_wedding.png'),
  retro:       require('../../../../assets/images/placeholders/treatment_preview_1.png'),
  film:        require('../../../../assets/images/placeholders/treatment_preview_1.png'),
  editorial:   require('../../../../assets/images/placeholders/treatment_preview_2.png'),
  documentary: require('../../../../assets/images/placeholders/gallery_blurred_half.png'),
  vibrant:     require('../../../../assets/images/placeholders/hindu_wedding.png'),
};

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
  photo?: string | null;
};

interface PhotoItem {
  uri: string;
  takenBy: string;
}

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
const CHALLENGE_BRIEFS: Record<string, { desc: string; instr: string }> = {
  firstDance: {
    desc: "Capture the couple's magical first dance as husband and wife.",
    instr: "Wait for the music to slow, find a clear angle of the dancefloor, and snap a candid reaction or wide frame of their dip!"
  },
  rings: {
    desc: "Get a close-up detail of the bride and groom's wedding bands.",
    instr: "Look for a moment when they rest their hands together on a table, or ask to snap a macro shot of the rings catching the light."
  },
  group: {
    desc: "Gather a group of friends or family for the ultimate group shot.",
    instr: "Squeeze everyone close together, make sure all faces are visible and well-lit, and capture the joy of the celebration!"
  },
  decor: {
    desc: "Capture the elegant table settings, flowers, and decorations.",
    instr: "Shoot from a low angle to emphasize the candle arrangements, or frame the menu cards and place cards in soft focus."
  },
  candle: {
    desc: "Snap a photo of the warm candlelit ambiance of the venue.",
    instr: "Turn off your camera flash, steady your hands, and capture the flickering flames lighting up the guests' smiles."
  },
  champagne: {
    desc: "Raise a glass and capture the sparkling champagne toast.",
    instr: "Snap the glasses clinking mid-air, or capture the bubbles in the glass offset by the background bokeh."
  },
  cake: {
    desc: "Document the detail or the cutting of the spectacular wedding cake.",
    instr: "Frame the entire cake showing the floral decorations, or snap the couple sharing the first bite!"
  },
  bouquet: {
    desc: "Capture the bridesmaids or the wedding bouquet in detail.",
    instr: "Find the bridal party laughing together, or get a close-up of the delicate floral arrangements."
  },
  gift: {
    desc: "Locate and snap the beautifully styled cards and gifts table.",
    instr: "Highlight the guest book, the envelope box, or the handwritten signs."
  },
  confetti: {
    desc: "Capture the explosive confetti or grand exit of the couple.",
    instr: "Pre-focus on the aisle, wait for the couple to walk through the shower of petals, and snap a high-energy shot!"
  }
};

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

function LiveDot() {
  return (
    <View style={S.liveDotCircle} />
  );
}

function PeopleSmall() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="rgba(255,255,255,0.65)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockSmall() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="rgba(255,255,255,0.65)" strokeWidth={1.8} />
      <Path
        d="M12 7v5l3 3"
        stroke="rgba(255,255,255,0.65)"
        strokeWidth={1.8}
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
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { celebration, primarySession, metrics } = detail;

  const { session } = useAuth();

  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
    enabled: isBackendConfigured && !!session,
  });
  
  // Dev Override Role check
  const [devRole, setDevRole] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('__dev_role').then(setDevRole);
  }, []);

  // Load guest name if this device joined as a guest
  useEffect(() => {
    if (!celebration || isHost) return;
    void loadStoredGuestSession(celebration.public_slug ?? celebration.id).then((session) => {
      if (session?.displayName) {
        setGuestName(session.displayName);
      }
    });
  }, [celebration, isHost]);

  const roleIsHost = devRole === 'guest'
    ? false
    : (devRole === 'host'
        ? true
        : (!isBackendConfigured
            ? true
            : (session ? session.user.id === celebration.created_by : false)
          )
      );

  // On web, never show host controls. On native, respect the user's role.
  const isHost = shouldShowHostControls(roleIsHost ? 'host' : 'guest');

  const showGuestbook = isHost || detail.hasAudioGuestbook !== false;

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
  ];

  const SCRIM_LOCATIONS = [
    0,
    0.30 * SCRIM_SOLID_AT,
    0.48 * SCRIM_SOLID_AT,
    0.64 * SCRIM_SOLID_AT,
    0.82 * SCRIM_SOLID_AT,
    SCRIM_SOLID_AT,
    1,
  ];

  const CELL_W = (screenWidth - GALLERY_PADDING * 2 - GRID_GAP) / 2;
  const CELL_H = CELL_W * (16 / 9);

  // ── State ──
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>(DEFAULT_CHALLENGES);
  const [shareVisible, setShareVisible] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const storyMountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedChallenge) {
      storyMountAnim.setValue(0);
      Animated.spring(storyMountAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedChallenge]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [storySubmissions, setStorySubmissions] = useState<PhotoItem[]>([]);
  const [guestsJoined, setGuestsJoined] = useState(
    Math.max(1, metrics.guestsJoined),
  );

  // ── Countdown ──
  const [countdown, setCountdown] = useState({
    days: 0, hours: 0, minutes: 0,
    isCompleted: false, isOngoing: false,
  });

  // ── Parallax ──
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Drag to Dismiss story ──
  const dragY = useRef(new Animated.Value(0)).current;

  /**
   * The PanResponder below is built once and kept for the life of the screen,
   * so its handlers close over the FIRST render's values permanently. Reading
   * `activeSlideIndex` and `storySubmissions` directly in there meant the tap
   * handler always saw `0` and `[]`: every right-tap computed "already on the
   * last slide" and closed the viewer, and every left-tap did nothing. These
   * refs are what let the handler see the current values.
   */
  const activeSlideRef = useRef(0);
  const submissionCountRef = useRef(0);
  useEffect(() => { activeSlideRef.current = activeSlideIndex; }, [activeSlideIndex]);
  useEffect(() => { submissionCountRef.current = storySubmissions.length; }, [storySubmissions]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      // Without this, a gesture stolen by another responder leaves the story
      // frozen part-way down the screen with no way to settle it.
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: false }).start();
      },
      onPanResponderRelease: (e, gestureState) => {
        // Read live, for the same stale-closure reason as the refs above.
        const { width, height } = Dimensions.get('window');
        const isTap = Math.abs(gestureState.dx) < 15 && Math.abs(gestureState.dy) < 15;

        if (isTap) {
          // Split the screen down the middle, as Instagram does: left goes
          // back, right goes forward. `x0` is where the finger landed.
          const totalSlides = 1 + submissionCountRef.current;
          const current = activeSlideRef.current;

          if (gestureState.x0 < width / 2) {
            if (current > 0) setActiveSlideIndex(current - 1);
          } else if (current < totalSlides - 1) {
            setActiveSlideIndex(current + 1);
          } else {
            // Past the final slide, the story is over.
            setSelectedChallenge(null);
          }
          dragY.setValue(0);
          return;
        }

        // Swipe down to dismiss, anywhere on the story.
        //
        // Every animation on `dragY` is JS-driven, matching the `setValue`
        // above. Running these two on the native driver moved the node across
        // to the native side, after which the drag's JS writes no longer
        // landed cleanly and the following swipe stuttered.
        if (gestureState.dy > 80 || gestureState.vy > 0.3) {
          Animated.timing(dragY, {
            toValue: height,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            // `dragY` is deliberately NOT reset here. The modal fades out over
            // roughly 300ms after `visible` flips, so zeroing it now snapped
            // the story back to centre and faded it out from there — the flash
            // at the end of the swipe. It is reset when the story next opens.
            setSelectedChallenge(null);
          });
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;
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
    themes?.find((t) => t.id === celebration.default_theme_id)?.accent_color_hex
    ?? colours.brandPrimary;

  // ── Load gallery ──
  useEffect(() => {
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

  // ── Load challenges & Pre-seed c3 (Best Group Photo) submissions ──
  useEffect(() => {
    (async () => {
      const submissionsKey = `__mock_challenge_submissions_${celebration.id}_c3`;
      const submissionsStored = await AsyncStorage.getItem(submissionsKey);
      
      let demoPhotos: PhotoItem[] = [];
      if (!submissionsStored) {
        const demoUris = [
          require('../../../../assets/images/placeholders/iphone_group_1.png'),
          require('../../../../assets/images/placeholders/iphone_group_2.png'),
          require('../../../../assets/images/placeholders/iphone_group_3.png'),
          require('../../../../assets/images/placeholders/iphone_group_4.png'),
          require('../../../../assets/images/placeholders/iphone_group_5.png'),
        ].map(req => Image.resolveAssetSource(req).uri);

        const names = ['Emma', 'Daniel', 'Chloe', 'Ryan', 'Zoe'];
        demoPhotos = demoUris.map((uri, idx) => ({
          uri,
          takenBy: names[idx % names.length],
        }));

        await AsyncStorage.setItem(submissionsKey, JSON.stringify(demoPhotos));
      } else {
        try {
          const parsed = JSON.parse(submissionsStored);
          demoPhotos = parsed.map((item: any) => {
            if (typeof item === 'string') {
              return { uri: item, takenBy: 'Guest' };
            }
            return item as PhotoItem;
          });
        } catch {}
      }

      const key = `__mock_challenges_${celebration.id}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        try {
          let parsed = JSON.parse(stored) as Challenge[];
          if (demoPhotos.length > 0) {
            parsed = parsed.map(c => c.id === 'c3' && !c.photo ? { ...c, photo: demoPhotos[demoPhotos.length - 1].uri } : c);
          }
          setChallenges(parsed);
        } catch {}
      } else {
        let def = [...DEFAULT_CHALLENGES];
        if (demoPhotos.length > 0) {
          def = def.map(c => c.id === 'c3' ? { ...c, photo: demoPhotos[demoPhotos.length - 1].uri } : c);
        }
        setChallenges(def);
      }
    })();
  }, [celebration.id]);

  // ── Sync server metrics ──
  useEffect(() => {
    setGuestsJoined(Math.max(1, metrics.guestsJoined));
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
    if (celebration.cover_storage_path && COVER_MAP[celebration.cover_storage_path]) {
      return COVER_MAP[celebration.cover_storage_path];
    }
    const sum = celebration.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return GALLERY_PRESETS[sum % GALLERY_PRESETS.length].source;
  }

  function getPhotoSource(photo: string) {
    if (photo === 'locked_photo') {
      return GALLERY_PRESETS[0].source;
    }
    const preset = GALLERY_PRESETS.find((p) => p.id === photo);
    return preset ? preset.source : { uri: photo };
  }

  function buildCountdownLabel() {
    if (countdown.isOngoing) return null;
    if (countdown.isCompleted) return 'EVENT ENDED';
    const { days, hours, minutes } = countdown;
    if (days >= 1) return `ENDS IN ${days} DAYS`;
    if (hours >= 1) return `ENDS IN ${hours} HOURS`;
    return `ENDS IN ${minutes} MIN`;
  }

  async function saveChallenges(next: Challenge[]) {
    setChallenges(next);
    await AsyncStorage.setItem(
      `__mock_challenges_${celebration.id}`,
      JSON.stringify(next),
    );
  }

  const isGalleryLocked = primarySession?.reveal_mode === 'scheduled' &&
                          primarySession?.reveal_at &&
                          new Date(primarySession.reveal_at).getTime() > Date.now();

  const visiblePhotos = isGalleryLocked
    ? photos.map((p) => ({ ...p, uri: 'locked_photo' }))
    : photos;

  // ── Native iOS Shared-Element Hero Viewer State & Animations ──
  const [heroVisible, setHeroVisible] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroStartBounds, setHeroStartBounds] = useState({ x: 16, y: 300, width: CELL_W, height: CELL_H });
  const [heroMenuVisible, setHeroMenuVisible] = useState(false);

  const heroAnimProgress = useRef(new Animated.Value(0)).current;
  const heroPanY = useRef(new Animated.Value(0)).current;
  const heroPanX = useRef(new Animated.Value(0)).current;

  function getThumbBounds(idx: number) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 16 : 16 + CELL_W + 16;
    const y = 350 + row * (CELL_H + 20);
    return { x, y, width: CELL_W, height: CELL_H };
  }

  function handlePhotoPress(index: number, e?: any) {
    if (isGalleryLocked) {
      Alert.alert('Gallery is locked', 'Photos will be revealed automatically once the countdown ends!');
      return;
    }
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
          if (heroIndex < photos.length - 1) {
            void Haptics.selectionAsync().catch(() => {});
            Animated.timing(heroPanX, {
              toValue: -400,
              duration: 150,
              useNativeDriver: false,
            }).start(() => {
              heroPanX.setValue(0);
              const nextIdx = heroIndex + 1;
              setHeroIndex(nextIdx);
              setHeroStartBounds(getThumbBounds(nextIdx));
            });
            return;
          }
        } else if (gestureState.dx > 50 || (gestureState.dx > 20 && gestureState.vx > 0.3)) {
          if (heroIndex > 0) {
            void Haptics.selectionAsync().catch(() => {});
            Animated.timing(heroPanX, {
              toValue: 400,
              duration: 150,
              useNativeDriver: false,
            }).start(() => {
              heroPanX.setValue(0);
              const prevIdx = heroIndex - 1;
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
    const key = `__mock_challenge_submissions_${celebration.id}_${challenge.id}`;
    const stored = await AsyncStorage.getItem(key);
    let loadedSubmissions: PhotoItem[] = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        loadedSubmissions = parsed.map((item: any) => {
          if (typeof item === 'string') {
            return { uri: item, takenBy: 'Guest' };
          }
          return item as PhotoItem;
        });
      } catch {}
    } else if (challenge.photo) {
      loadedSubmissions = [{ uri: challenge.photo, takenBy: 'Guest' }];
      await AsyncStorage.setItem(key, JSON.stringify(loadedSubmissions));
    }
    setStorySubmissions(loadedSubmissions);
    // Cleared on the way in rather than on the way out, so the dismissed story
    // can stay off-screen for the whole of the modal's fade-out.
    dragY.setValue(0);
    setSelectedChallenge(challenge);
    setActiveSlideIndex(0);
  }

  async function handleAddSubmission(challenge: Challenge) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload a submission.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const userName = firstNameFrom(profile) || 'You';
      const key = `__mock_challenge_submissions_${celebration.id}_${challenge.id}`;
      const newSubmission: PhotoItem = { uri, takenBy: userName };
      const nextSubmissions = [...storySubmissions, newSubmission];
      
      await AsyncStorage.setItem(key, JSON.stringify(nextSubmissions));
      setStorySubmissions(nextSubmissions);
      
      const updatedChallenges = challenges.map((c) => 
        c.id === challenge.id ? { ...c, photo: uri } : c
      );
      setChallenges(updatedChallenges);
      await saveChallenges(updatedChallenges);
      
      setActiveSlideIndex(nextSubmissions.length);
    }
  }

  function handleAddChallenge() {
    router.push(`/celebration/${celebration.id}/challenges/new` as never);
  }

  async function handleShareLink() {
    try {
      await Share.share({
        message: `Join "${celebration.title}" on Candidly → ${BRAND_CONFIG.guestDomain}/e/${celebration.public_slug}`,
      });
    } catch {}
  }

  async function handleCopyCode() {
    await Clipboard.setStringAsync(celebration.public_slug);
    Alert.alert('Copied', 'Event code copied to clipboard.');
  }

  // ── Derived ──
  const isLive = !countdown.isCompleted && !countdown.isOngoing;
  const countdownLabel = buildCountdownLabel();

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
            {/* Back button: only show for hosts */}
            {isHost ? (
              <Pressable
                style={S.navBtn}
                onPress={() => router.replace('/home')}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <BackChevron />
              </Pressable>
            ) : (
              <View style={S.navBtn} />
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

          {/* Event info overlaid on bottom of hero image */}
          <View style={S.heroInfo}>
            {/* End Date in cover style (eyebrow, tone secondary, uppercase) */}
            {celebration.ends_at ? (
              <AppText variant="eyebrow" tone="secondary">
                {new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: celebration.timezone,
                }).format(new Date(celebration.ends_at))}
              </AppText>
            ) : null}

            {/* Title — Instrument Serif display face */}
            <AppText variant="displayHero" style={S.heroTitle} numberOfLines={3}>
              {celebration.title}
            </AppText>

            {/* Status row: [ ● LIVE ] · 👥 1 GUEST JOINED · 🕒 ENDS IN 4 DAYS */}
            <View style={S.statusRow}>
              {isLive && (
                <View style={S.liveBadge}>
                  <LiveDot />
                  <AppText style={S.liveBadgeText}>LIVE</AppText>
                </View>
              )}
              {countdown.isCompleted && (
                <View style={S.liveBadge}>
                  <AppText style={S.liveBadgeText}>ENDED</AppText>
                </View>
              )}

              <AppText style={S.statusDot}>•</AppText>

              <View style={S.statusItem}>
                <PeopleSmall />
                <AppText style={S.statusText}>
                  {guestsJoined} {guestsJoined === 1 ? 'GUEST JOINED' : 'GUESTS JOINED'}
                </AppText>
              </View>

              {countdownLabel && (
                <>
                  <AppText style={S.statusDot}>•</AppText>
                  <View style={S.statusItem}>
                    <ClockSmall />
                    <AppText style={S.statusText}>{countdownLabel}</AppText>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── PERSONALIZED GUEST WELCOME ─── */}
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

        {/* ── CHALLENGE CHIPS (Instagram Highlights Style) ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.chipsContent}
          style={S.chipsScroll}
        >
          {/* "Add Challenge" chip — dashed ring + center "+" (visible to host only) */}
          {isHost && (
            <Pressable
              style={({ pressed }) => [S.chipWrap, pressed && { opacity: 0.75 }]}
              onPress={handleAddChallenge}
              accessibilityRole="button"
              accessibilityLabel="Add new challenge"
            >
              <View style={S.chipAddOuter}>
                <AppText style={S.chipAddPlus}>+</AppText>
              </View>
              <AppText style={S.chipLabel} numberOfLines={2}>Add new{'\n'}challenge</AppText>
            </Pressable>
          )}

          {/* "Guest Book" chip — pink/purple/yellow gradient border matching Instagram story highlights */}
          {showGuestbook && (
            <Pressable
              style={({ pressed }) => [S.chipWrap, pressed && { opacity: 0.75 }]}
              onPress={() => Alert.alert('Audio Guestbook', 'Welcome to the Guest Book! Leave warm messages and audio memories for the host. 🎙️')}
              accessibilityRole="button"
              accessibilityLabel="Guest Book"
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
              <AppText style={S.chipLabel} numberOfLines={2}>Guest Book</AppText>
            </Pressable>
          )}

          {/* Existing challenge chips */}
          {challenges.map((challenge) => (
            <Pressable
              key={challenge.id}
              style={({ pressed }) => [S.chipWrap, pressed && { opacity: 0.75 }]}
              onPress={() => handleChallengePhotoPress(challenge)}
              accessibilityRole="button"
              accessibilityLabel={`Challenge: ${challenge.label}`}
            >
              <View style={S.chipOuter}>
                {challenge.photo ? (
                  /* Real photo: circular highlight crop */
                  <Image
                    source={{ uri: challenge.photo }}
                    style={S.chipPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  /* Placeholder: line art SVG on dark ring background */
                  <View style={S.chipIconBg}>
                    <ChallengeIconSVG type={challenge.icon} size={28} />
                  </View>
                )}
              </View>
              <AppText style={S.chipLabel} numberOfLines={2}>
                {challenge.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── 9:16 PORTRAIT GALLERY GRID ───────────────────── */}
        {visiblePhotos.length > 0 ? (
          <View style={S.gallery}>
            {/* Left column */}
            <View style={S.galleryCol}>
              {visiblePhotos
                .filter((_, i) => i % 2 === 0)
                .map((photo, i) => {
                  const originalIndex = i * 2;
                  const locked = photo.uri === 'locked_photo';
                  return (
                    <Pressable
                      key={`L${i}`}
                      onPress={(e) => handlePhotoPress(originalIndex, e)}
                      style={({ pressed }) => [
                        S.galleryCell,
                        { width: CELL_W, height: CELL_H },
                        pressed && !locked && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <Image
                        source={getPhotoSource(photo.uri)}
                        style={S.galleryCellImg}
                        resizeMode="cover"
                        blurRadius={locked ? 20 : 0}
                      />
                      {locked && (
                        <View style={S.lockOverlay}>
                          <View style={S.lockCircle}>
                            <LockIcon size={18} color="#000000" />
                          </View>
                        </View>
                      )}
                      {!locked && (
                        <View style={S.photoNameTag}>
                          <AppText style={S.photoNameText}>{photo.takenBy || 'Guest'}</AppText>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
            </View>
            {/* Right column */}
            <View style={[S.galleryCol, { marginLeft: GRID_GAP }]}>
              {visiblePhotos
                .filter((_, i) => i % 2 === 1)
                .map((photo, i) => {
                  const originalIndex = i * 2 + 1;
                  const locked = photo.uri === 'locked_photo';
                  return (
                    <Pressable
                      key={`R${i}`}
                      onPress={(e) => handlePhotoPress(originalIndex, e)}
                      style={({ pressed }) => [
                        S.galleryCell,
                        { width: CELL_W, height: CELL_H },
                        pressed && !locked && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <Image
                        source={getPhotoSource(photo.uri)}
                        style={S.galleryCellImg}
                        resizeMode="cover"
                        blurRadius={locked ? 20 : 0}
                      />
                      {locked && (
                        <View style={S.lockOverlay}>
                          <View style={S.lockCircle}>
                            <LockIcon size={18} color="#000000" />
                          </View>
                        </View>
                      )}
                      {!locked && (
                        <View style={S.photoNameTag}>
                          <AppText style={S.photoNameText}>{photo.takenBy || 'Guest'}</AppText>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ) : (
          <View style={S.emptyGallery}>
            <AppText variant="bodySmall" tone="secondary" align="center">
              No moments yet.{'\n'}Be the first to add one.
            </AppText>
          </View>
        )}

      </Animated.ScrollView>

      {/* ══════════════════════════════════════════════════════
          FLOATING CAMERA PILL FAB
          ══════════════════════════════════════════════════════ */}
      {(!heroVisible) && (
        <View style={[S.fabWrap, { bottom: insets.bottom + 28 }]}>
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
            onPress={() => router.push(`/celebration/${celebration.id}/camera` as never)}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
          >
            {/* Outermost white border wrapper */}
            <View style={S.fabOutermostWhiteBorder}>
              {/* Inner black border wrapper */}
              <View style={S.fabOuterBlackBorder}>
                <View style={S.fabContentCircle}>
                  <CameraFABIcon size={26} color="#000000" />
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          SHARE MODAL
          ══════════════════════════════════════════════════════ */}
      <Modal
        visible={shareVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setShareVisible(false)}
      >
        <View style={S.modalOverlay}>
          <View style={[S.modalSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={S.sheetHandle} />

            <AppText variant="titleLarge" style={{ textAlign: 'center', marginTop: spacing.xs }}>
              Invite Guests
            </AppText>
            <AppText variant="bodySmall" tone="secondary" align="center">
              Share the link or code so your guests can start contributing.
            </AppText>

            {/* QR placeholder card */}
            <View style={S.qrCard}>
              <AppText
                variant="eyebrow"
                tone="secondary"
                align="center"
                style={{ letterSpacing: 1 }}
              >
                {celebration.title}
              </AppText>
              <View style={S.qrIconWrap}>
                <QrCodeIcon size={100} color={accentColor} />
              </View>
              <AppText style={[S.qrCode, { color: accentColor }]}>
                {celebration.public_slug}
              </AppText>
            </View>

            <Pressable
              style={[S.sheetBtnPrimary, { backgroundColor: accentColor }]}
              onPress={handleShareLink}
            >
              <AppText style={{ color: colours.textOnBrand, fontWeight: '700', fontSize: 15 }}>
                Share Link
              </AppText>
            </Pressable>
            <Pressable style={S.sheetBtnSecondary} onPress={handleCopyCode}>
              <AppText style={{ color: colours.textPrimary, fontWeight: '600', fontSize: 15 }}>
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

      {/* ══════════════════════════════════════════════════════
          INSTAGRAM STORY CHALLENGE VIEWER MODAL
          ══════════════════════════════════════════════════════ */}
      <Modal
        visible={selectedChallenge !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedChallenge(null)}
      >
        {selectedChallenge && (() => {
          const totalSlides = 1 + storySubmissions.length;
          const coverPhoto = storySubmissions.length > 0 
            ? { uri: storySubmissions[storySubmissions.length - 1].uri } 
            : getCoverSource();
            
          return (
            <Animated.View 
              style={[S.storyOverlay, { transform: [{ translateY: dragY }] }]}
            >
              {/* 1. Background Photo */}
              {activeSlideIndex === 0 ? (
                <Image
                  source={coverPhoto}
                  style={[ABSOLUTE_FILL, { width: '100%', height: '100%' }]}
                  resizeMode="cover"
                  blurRadius={35}
                />
              ) : (
                <Image
                  source={{ uri: storySubmissions[activeSlideIndex - 1].uri }}
                  style={[ABSOLUTE_FILL, { width: '100%', height: '100%' }]}
                  resizeMode="cover"
                />
              )}

              {/* 2. Scrim Overlay */}
              <View style={[ABSOLUTE_FILL, { backgroundColor: activeSlideIndex === 0 ? 'rgba(0, 0, 0, 0.40)' : 'rgba(11, 11, 12, 0.25)' }]} />

              {/* 3. Slide Content (Background layer relative to touch overlay) */}
              {activeSlideIndex === 0 ? (
                /* Slide 1: Challenge Brief (Centered Hero) */
                <Animated.View 
                  pointerEvents="none" 
                  style={[
                    S.storyHeroContainer,
                    {
                      opacity: storyMountAnim,
                      transform: [{
                        translateY: storyMountAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        })
                      }]
                    }
                  ]}
                >
                  <View style={S.storyHeroIconRing}>
                    <ChallengeIconSVG type={selectedChallenge.icon} size={32} />
                  </View>
                  <AppText style={S.storyHeroTitle}>
                    {selectedChallenge.label}
                  </AppText>
                  
                  <View style={S.storyHeroDividerRow}>
                    <View style={S.storyHeroDividerLine} />
                    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                      <Path d="M7 0C7 3.866 3.866 7 0 7C3.866 7 7 10.134 7 14C7 10.134 10.134 7 14 7C10.134 7 7 3.866 7 0Z" fill="rgba(255, 255, 255, 0.6)" />
                    </Svg>
                    <View style={S.storyHeroDividerLine} />
                  </View>
                  
                  <AppText style={S.storyHeroDesc}>
                    {CHALLENGE_BRIEFS[selectedChallenge.icon]?.instr || 'Locate the subject, frame your shot carefully, and tap Submit to complete this challenge.'}
                  </AppText>
                </Animated.View>
              ) : null}

              {/* 4. Touch Nav Areas (Handles both tap navigation and drag gestures) */}
              <Animated.View
                style={[ABSOLUTE_FILL, { backgroundColor: 'transparent', zIndex: 5 }]}
                collapsable={false}
                {...panResponder.panHandlers}
              />

              {/* 5. Safe Area Header Content (Sits on top of Touch Nav Pressable) */}
              <View style={[S.storyHeader, { paddingTop: insets.top + spacing.sm }]}>
                {/* Progress Indicators */}
                <View style={S.storyProgressBarRow}>
                  {Array.from({ length: totalSlides }).map((_, i) => (
                    <View key={i} style={S.storyProgressBarOuter}>
                      <View 
                        style={[
                          S.storyProgressBarInner, 
                          { width: i < activeSlideIndex ? '100%' : (i === activeSlideIndex ? '100%' : '0%') }
                        ]} 
                      />
                    </View>
                  ))}
                </View>

                {/* Header Row */}
                <View style={S.storyHeaderRowNew}>
                  <View style={{ flex: 1, paddingLeft: 4 }}>
                    {activeSlideIndex > 0 && (
                      <View style={{ gap: 2 }}>
                        <AppText style={{ fontFamily: 'InstrumentSans_600SemiBold', fontSize: 14, color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                          {storySubmissions[activeSlideIndex - 1].takenBy || 'Guest'}
                        </AppText>
                        <AppText style={{ fontFamily: 'InstrumentSans_400Regular', fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                          Today at 7:42 PM
                        </AppText>
                      </View>
                    )}
                  </View>
                  <Pressable 
                    onPress={() => setSelectedChallenge(null)}
                    style={S.storyCloseBtnNew}
                    accessibilityRole="button"
                    accessibilityLabel="Close story"
                  >
                    <CloseIcon size={24} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* 6. Bottom Action Bar (Sits on top of Touch Nav Pressable) */}
              {activeSlideIndex === 0 ? (
                <Animated.View 
                  style={[
                    S.storyHeroCTAWrap, 
                    { 
                      bottom: insets.bottom + 24,
                      opacity: storyMountAnim,
                      transform: [{
                        translateY: storyMountAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [40, 0],
                        })
                      }]
                    }
                  ]}
                >
                  <Pressable
                    onPress={() => handleAddSubmission(selectedChallenge)}
                    style={({ pressed }) => [S.storyHeroCTA, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                  >
                    <AppText style={S.storyHeroCTAText}>📸 Add Yours</AppText>
                  </Pressable>
                </Animated.View>
              ) : (
                <View style={[S.storyBottomBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
                  <Pressable
                    onPress={() => handleAddSubmission(selectedChallenge)}
                    style={({ pressed }) => [S.storyAddYoursBtn, pressed && { opacity: 0.8 }]}
                  >
                    <AppText style={S.storyAddYoursBtnText}>📸 Add Yours</AppText>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          );
        })()}
      </Modal>

      {/* ══════════════════════════════════════════════════════
          SHARED-ELEMENT HERO PHOTO VIEWER OVERLAY
          ══════════════════════════════════════════════════════ */}
      {heroVisible && (() => {
        const activePhoto = photos[heroIndex] ?? null;
        if (!activePhoto) return null;

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
            {/* 1. Backdrop */}
            <Animated.View
              style={[
                ABSOLUTE_FILL,
                { backgroundColor: '#000000', opacity: bgOpacity },
              ]}
            />

            {/* 2. Top Header Buttons */}
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

            {/* 3. Hero Shared Element Photo Container */}
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
              <Image
                source={getPhotoSource(activePhoto.uri)}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </Animated.View>

            {/* 4. Bottom Metadata Row */}
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
                <AppText style={{ fontFamily: 'InstrumentSans_400Regular', fontSize: 13, color: 'rgba(255, 255, 255, 0.55)' }}>
                  Today at 7:42 PM
                </AppText>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <Pressable onPress={() => { void Haptics.selectionAsync(); Alert.alert('Instagram Story', 'Exporting story...'); }}>
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

            {/* 5. Three-Dot Overflow Menu Modal */}
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
                    <Pressable
                      style={[S.menuOption, S.menuOptionBorder]}
                      onPress={() => {
                        setHeroMenuVisible(false);
                        Alert.alert(
                          'Delete this photo?',
                          'This will permanently remove it from the event gallery.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete Photo',
                              style: 'destructive',
                              onPress: async () => {
                                const key = `__mock_photos_${celebration.id}`;
                                const stored = await AsyncStorage.getItem(key);
                                if (stored) {
                                  const parsed = JSON.parse(stored) as PhotoItem[];
                                  const updated = parsed.filter((_, idx) => idx !== heroIndex);
                                  await AsyncStorage.setItem(key, JSON.stringify(updated));
                                  queryClient.invalidateQueries({
                                    queryKey: celebrationDetailKeys.detail(String(celebration.id)),
                                  });
                                  closeHeroViewer();
                                  Alert.alert('Photo deleted');
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <AppText style={S.menuDeleteText}>Delete Photo</AppText>
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

  // ── Status row ──
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: spacing.xxs,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDotCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5DFF8A',
  },
  liveBadgeText: {
    fontFamily: 'InstrumentSans_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.1,
    color: 'rgba(255,255,255,0.7)',
  },
  statusDot: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },

  // ── Challenge chips (Instagram Story Highlights Style) ──
  chipsScroll: {
    marginTop: 16,
  },
  chipsContent: {
    paddingLeft: GALLERY_PADDING,     // Aligns first circle perfectly with left edge of gallery below
    paddingRight: GALLERY_PADDING,
    gap: 14,                          // Fixed 14px gap between circles
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

  // ── Gallery ──
  gallery: {
    flexDirection: 'row',
    marginTop: 32,                    // 32px spacing between challenge row and gallery
    paddingHorizontal: GALLERY_PADDING,
  },
  galleryCol: {
    flex: 1,
    gap: ROW_GAP,                     // 20px vertical spacing between gallery rows
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  photoNameText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 10,
    color: '#EFE9E0',
    letterSpacing: 0.5,
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

  // ── Share modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,5,6,0.88)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colours.surfaceRaised,
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
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colours.borderSubtle,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  qrIconWrap: {
    backgroundColor: colours.textPrimary,
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
    borderColor: colours.borderStrong,
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
  storyOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  storyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    zIndex: 10,
  },
  storyProgressBarRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    marginBottom: spacing.sm,
  },
  storyProgressBarOuter: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  storyProgressBarInner: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  storyHeaderRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  storyCloseBtnNew: {
    padding: spacing.xs,
  },
  storyHeroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  storyHeroIconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  storyHeroTitle: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 40,
    lineHeight: 46,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  storyHeroDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
    width: 140,
  },
  storyHeroDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  storyHeroDesc: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
  },
  storyHeroCTAWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  storyHeroCTA: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyHeroCTAText: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 16,
    color: '#000000',
  },
  storyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 10,
  },
  storyAddYoursBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    height: 50,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    width: '100%',
  },
  storyAddYoursBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
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
});
