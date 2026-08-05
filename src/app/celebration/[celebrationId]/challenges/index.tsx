import { useCallback, useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Alert,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { colours, layout, radii, spacing } from '@/design';
import { celebrationDetailKeys } from '@/services/celebration-detail';
import { IS_APP_CLIP } from '@/config/app-config';

// ── Models & Presets ──

type Challenge = {
  id: string;
  label: string;
  icon: string;
  instructions?: string;
  photo?: string | null;
};

/** Card pitch, shared by the layout and the drag maths so they cannot drift. */
const CARD_HEIGHT = 74;
const CARD_GAP = spacing.sm;

const DEFAULT_CHALLENGES: Challenge[] = [
  { id: 'c1', label: 'First Dance',      icon: 'firstDance' },
  { id: 'c2', label: 'Wedding Rings',    icon: 'rings' },
  { id: 'c3', label: 'Best Group Photo', icon: 'group' },
  { id: 'c4', label: 'Decor Details',    icon: 'decor' },
  { id: 'c5', label: 'Candlelight',      icon: 'candle' },
  { id: 'c6', label: 'Cake Moment',      icon: 'cake' },
  { id: 'c7', label: 'Bouquet Toss',     icon: 'bouquet' },
  { id: 'c8', label: 'Toasts & Cheers',  icon: 'champagne' },
  { id: 'c9', label: 'Gift Moment',      icon: 'gift' },
  { id: 'c10', label: 'Confetti Exit',   icon: 'confetti' },
];

const CHALLENGE_BRIEFS: Record<string, { desc: string; instr: string }> = {
  // Wedding challenges
  firstDance: { desc: '', instr: "Wait for the music to slow, find a clear angle of the dancefloor, and snap a candid reaction or wide frame of their dip!" },
  rings: { desc: '', instr: "Look for a moment when they rest their hands together on a table, or ask to snap a macro shot of the rings catching the light." },
  group: { desc: '', instr: "Squeeze everyone close together, make sure all faces are visible and well-lit, and capture the joy of the celebration!" },
  decor: { desc: '', instr: "Shoot from a low angle to emphasize the candle arrangements, or frame the menu cards and place cards in soft focus." },
  candle: { desc: '', instr: "Turn off your camera flash, steady your hands, and capture the flickering flames lighting up the guests' smiles." },
  champagne: { desc: '', instr: "Snap the glasses clinking mid-air, or capture the bubbles in the glass offset by the background bokeh." },
  cake: { desc: '', instr: "Frame the entire cake showing the floral decorations, or snap the couple sharing the first bite!" },
  bouquet: { desc: '', instr: "Find the bridal party laughing together, or get a close-up of the delicate floral arrangements." },
  gift: { desc: '', instr: "Highlight the guest book, the envelope box, or the handwritten signs." },
  confetti: { desc: '', instr: "Pre-focus on the aisle, wait for the couple to walk through the shower of petals, and snap a high-energy shot!" },

  // Birthday & Party challenges
  birthday: { desc: '', instr: "Capture the birthday person blowing out the candles or the moment they see their cake for the first time!" },
  babyShower: { desc: '', instr: "Frame the mom-to-be opening gifts or playing games with the guests, with plenty of smiles and celebration." },
  bridalShower: { desc: '', instr: "Snap the bride laughing as she opens gifts, or capture the decorations with their personalized touches." },
  engagement: { desc: '', instr: "Focus on their hands together showing off the new ring, or capture their joy with close family." },
  graduation: { desc: '', instr: "Get the graduate in cap and gown, either posed or in candid moments with loved ones." },
  housewarming: { desc: '', instr: "Capture the home's special features, or snap guests enjoying the space and raising a toast." },
  bachelorette: { desc: '', instr: "Frame the group having fun together, silly moments, and the bride-to-be at the center of it all." },
  anniversary: { desc: '', instr: "Capture the couple together in a heartfelt moment, or with their loved ones celebrating milestones." },
  reunion: { desc: '', instr: "Get nostalgic moments—old friends embracing, group shots, and genuine laughter together." },
  cocktail: { desc: '', instr: "Frame the elegant drinks, guests mingling, and the ambient glow of the venue." },

  // Corporate & Formal challenges
  conference: { desc: '', instr: "Snap speakers at the podium, panel discussions, or attendees networking in the halls." },
  teamBuilding: { desc: '', instr: "Capture the team in action—activities, laughter, and moments of camaraderie." },
  gala: { desc: '', instr: "Frame elegantly dressed guests, the venue décor, and guests enjoying cocktails and conversation." },
  awards: { desc: '', instr: "Capture honorees on stage, acceptance moments, and champagne toasts celebrating achievements." },
  productLaunch: { desc: '', instr: "Frame the product reveal, audience reactions, and the team celebrating the launch." },
  networking: { desc: '', instr: "Snap meaningful conversations between attendees, business card exchanges, and group introductions." },
  retreat: { desc: '', instr: "Capture outdoor activities, team bonding moments, and the scenic venue backdrop." },
  training: { desc: '', instr: "Frame the instructor engaging with participants, hands-on activities, and group discussions." },
  holiday: { desc: '', instr: "Snap the festive decorations, group gatherings, and team members in holiday spirit." },
  sports: { desc: '', instr: "Capture action shots of the game or activity, team celebrations, and victory moments!" }
};

// ── SVG Icons ──

function DragHandleIcon({ size = 20, color = 'rgba(255, 255, 255, 0.4)' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={6} r={1.5} fill={color} />
      <Circle cx={16} cy={6} r={1.5} fill={color} />
      <Circle cx={8} cy={12} r={1.5} fill={color} />
      <Circle cx={16} cy={12} r={1.5} fill={color} />
      <Circle cx={8} cy={18} r={1.5} fill={color} />
      <Circle cx={16} cy={18} r={1.5} fill={color} />
    </Svg>
  );
}

function BackChevron({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChallengeIconSVG({ type, size = 24 }: { type: string; size?: number }) {
  const c = '#FFFFFF';
  const w = 1.6;
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
        <Path d="M12 9c0 0 3-1.5 3-4a2 2 0 0 0-4 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap={lc} fillRule="evenodd" clipRule="evenodd" />
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
    // Party icons
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
    // Corporate icons
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

// ── View All Challenges Screen Component ──

export default function ViewChallengesScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag and drop states
  const [activeDragIdx, setActiveDragIdx] = useState<number | null>(null);
  const [targetIdx, setTargetIdx] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const targetIdxRef = useRef<number | null>(null);
  const challengesRef = useRef<Challenge[]>([]);
  const offsets = useRef<Animated.Value[]>([]);

  // Keep ref in sync and maintain offsets array length
  useEffect(() => {
    challengesRef.current = challenges;
    const diff = challenges.length - offsets.current.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        offsets.current.push(new Animated.Value(0));
      }
    } else if (diff < 0) {
      offsets.current.splice(challenges.length);
    }
  }, [challenges]);

  const getOffset = (index: number) => {
    if (!offsets.current[index]) {
      offsets.current[index] = new Animated.Value(0);
    }
    return offsets.current[index];
  };

  // Load from AsyncStorage
  const loadChallenges = async () => {
    try {
      const key = `__mock_challenges_${celebrationId}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        setChallenges(JSON.parse(stored) as Challenge[]);
      } else {
        setChallenges([...DEFAULT_CHALLENGES]);
      }
    } catch {
      setChallenges([...DEFAULT_CHALLENGES]);
    } finally {
      setLoading(false);
    }
  };

  // Re-read on every focus, not just on mount.
  //
  // Pushing the form leaves this screen mounted underneath, so a mount-only
  // effect never ran again on the way back and a newly created challenge was
  // written to storage but never appeared in the list.
  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [celebrationId]),
  );

  // Save back to AsyncStorage
  const saveChallengesOrder = async (nextList: Challenge[]) => {
    try {
      const key = `__mock_challenges_${celebrationId}`;
      await AsyncStorage.setItem(key, JSON.stringify(nextList));
      // Invalidate dashboard details
      queryClient.invalidateQueries({
        queryKey: celebrationDetailKeys.detail(String(celebrationId)),
      });
    } catch {
      Alert.alert('Error', 'Failed to save reordered list.');
    }
  };

  // Drag handle PanResponder.
  //
  // Derived from the card metrics rather than approximated: the drag maps a
  // pixel offset onto a row count, so a stride that disagrees with the real
  // card pitch drifts further out of step the further the host drags.
  const ITEM_HEIGHT = CARD_HEIGHT + CARD_GAP;

  const makePanResponder = (index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveDragIdx(index);
        targetIdxRef.current = index;
        setTargetIdx(index);
        dragY.setValue(0);
        void Haptics.selectionAsync().catch(() => {});
      },
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(gestureState.dy);

        // Calculate potential index shifts
        const dragShift = Math.round(gestureState.dy / ITEM_HEIGHT);
        let newTargetIdx = index + dragShift;
        newTargetIdx = Math.max(0, Math.min(newTargetIdx, challengesRef.current.length - 1));

        if (newTargetIdx !== targetIdxRef.current) {
          targetIdxRef.current = newTargetIdx;
          setTargetIdx(newTargetIdx);
          void Haptics.selectionAsync().catch(() => {});

          // Animate other items to their new offsets
          for (let i = 0; i < challengesRef.current.length; i++) {
            if (i === index) continue;

            let expectedOffset = 0;
            if (newTargetIdx > index && i > index && i <= newTargetIdx) {
              expectedOffset = -ITEM_HEIGHT;
            } else if (newTargetIdx < index && i < index && i >= newTargetIdx) {
              expectedOffset = ITEM_HEIGHT;
            }

            Animated.spring(getOffset(i), {
              toValue: expectedOffset,
              useNativeDriver: true,
              tension: 60,
              friction: 9,
            }).start();
          }
        }
      },
      onPanResponderRelease: () => {
        const finalTargetIdx = targetIdxRef.current ?? index;

        // Animate the dragged item to align with its final slot
        Animated.spring(dragY, {
          toValue: (finalTargetIdx - index) * ITEM_HEIGHT,
          useNativeDriver: true,
          tension: 60,
          friction: 9,
        }).start(() => {
          // Perform the actual state swap
          const updated = [...challengesRef.current];
          const [draggedItem] = updated.splice(index, 1);
          updated.splice(finalTargetIdx, 0, draggedItem);

          saveChallengesOrder(updated);

          // Reset all animated values immediately
          offsets.current.forEach((val) => val.setValue(0));
          dragY.setValue(0);

          setChallenges(updated);
          setActiveDragIdx(null);
          setTargetIdx(null);
          targetIdxRef.current = null;
        });
      },
      onPanResponderTerminate: () => {
        // Revert offsets immediately on termination
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 9,
        }).start(() => {
          offsets.current.forEach((val) => {
            Animated.spring(val, {
              toValue: 0,
              useNativeDriver: true,
              tension: 60,
              friction: 9,
            }).start();
          });
          setActiveDragIdx(null);
          setTargetIdx(null);
          targetIdxRef.current = null;
        });
      },
    });
  };

  if (loading) {
    return (
      <Screen scrollable={false}>
        <View style={S.center}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  const countAdded = challenges.length;
  const progressRatio = Math.min(1, countAdded / 5);

  return (
    <Screen scrollable={false}>
      {/* Header bar */}
      <View style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backButton}>
          <BackChevron />
        </Pressable>
        <AppText variant="bodyLarge" style={S.headerTitle}>Challenges</AppText>
        <View style={{ width: 44 }} />
      </View>

      {/* Recommended progress card */}
      <View style={S.progressWrapper}>
        <View style={S.progressCard}>
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="titleMedium" style={S.progressTitle}>Make it more fun</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Add at least 5 challenges to give your guests plenty to capture.
            </AppText>
          </View>
          
          <View style={S.progressBarContainer}>
            <View style={[S.progressBar, { width: `${progressRatio * 100}%` }]} />
          </View>

          <AppText variant="caption" tone="secondary" style={S.progressLabel}>
            {countAdded} of 5 recommended challenges added
          </AppText>
        </View>
      </View>

      {/* Challenges list */}
      <ScrollView
        scrollEnabled={activeDragIdx === null}
        contentContainerStyle={S.listContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'relative' }}>
          {challenges.map((c, index) => {
            const isDragging = activeDragIdx === index;
            const pResponder = makePanResponder(index);

            return (
              <Animated.View
                key={c.id}
                style={[
                  S.card,
                  isDragging ? {
                    zIndex: 999,
                    backgroundColor: '#1E1E20',
                    transform: [{ translateY: dragY }],
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.45,
                    shadowRadius: 12,
                    elevation: 8,
                  } : {
                    transform: [{ translateY: getOffset(index) }],
                  },
                ]}
              >
                <Pressable
                  onPress={() => router.push(`/celebration/${celebrationId}/challenges/${c.id}`)}
                  style={S.cardContent}
                >
                  <View style={S.iconBox}>
                    <ChallengeIconSVG type={c.icon} size={22} />
                  </View>
                  <View style={S.textGroup}>
                    <AppText style={S.challengeTitle}>{c.label}</AppText>
                    <AppText style={S.challengeInstr} numberOfLines={2}>
                      {c.instructions || CHALLENGE_BRIEFS[c.icon]?.instr || 'No instructions provided.'}
                    </AppText>
                  </View>
                </Pressable>

                {/* Drag handle */}
                <View {...pResponder.panHandlers} style={S.dragHandle}>
                  <DragHandleIcon />
                </View>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky Bottom button */}
      <View style={S.footer}>
        <Button
          label="Add New Challenge"
          onPress={() => router.push(`/celebration/${celebrationId}/challenges/new`)}
          haptic
          fullWidth
        />
      </View>
    </Screen>
  );
}

const S = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0C',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F22',
    backgroundColor: '#0B0B0C',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  progressWrapper: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#0B0B0C',
  },
  progressCard: {
    backgroundColor: '#161617',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#242426',
  },
  progressTitle: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#EFE9E0',
    borderRadius: 3,
  },
  progressLabel: {
    fontFamily: 'InstrumentSans_500Medium',
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 110,
    backgroundColor: '#0B0B0C',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121213',
    borderRadius: radii.md,
    marginBottom: CARD_GAP,
    borderWidth: 1,
    borderColor: '#1F1F21',
    height: CARD_HEIGHT,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    height: '100%',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E1E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'InstrumentSans_600SemiBold',
  },
  challengeInstr: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'InstrumentSans_400Regular',
  },
  dragHandle: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: '#0B0B0C',
    borderTopWidth: 1,
    borderTopColor: '#1F1F22',
  },
});
