import { useEffect, useRef, type ComponentType } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { REVEAL_TRACK_GRADIENT, spacing, useMotion } from '@/design';
import type { PaywallPlan } from '@/features/payments/plan-catalogue';
import type { FeatureKey } from './event-entitlements';

/**
 * What a locked feature looks like, for a host deciding whether to pay for it.
 *
 * Shown rather than described: these are the features a host has never seen, so a
 * paragraph about them sells nothing. The art is drawn here from the sample event's
 * photographs rather than being a screenshot, so it never shows an out-of-date
 * version of the feature's own screen.
 */
export interface FeaturePitch {
  heading: string;
  summary: string;
  /** Two short facts, ticked. */
  highlights: readonly string[];
  Hero: ComponentType<PitchHeroProps>;
}

/** The move on offer, for art that depends on which package is selected. */
export interface PitchHeroProps {
  from: PaywallPlan | null;
  to: PaywallPlan | null;
}

/** Matches the sheet, so the art dissolves into it. */
const SHEET_COLOUR = '#0D0D0F';
const SHEET_COLOUR_CLEAR = 'rgba(13, 13, 15, 0)';
const HERO_HEIGHT = 208;
const TILE_WIDTH = 118;
const TILE_HEIGHT = 158;
const GRADIENT = [REVEAL_TRACK_GRADIENT[1], REVEAL_TRACK_GRADIENT[2]] as const;

/** Runs once as the sheet opens. Decoration, so it never loops. */
function useEntrance() {
  const { reduceMotion } = useMotion();
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(entrance, {
      toValue: 1,
      duration: 620,
      delay: 180,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [entrance, reduceMotion]);
  return entrance;
}

/** A photograph fanning out from the centre as the sheet opens. */
function FannedTile({
  source,
  entrance,
  rotate,
  offsetX,
  offsetY = 0,
  front = false,
  children,
}: {
  source: ImageSourcePropType;
  entrance: Animated.Value;
  rotate: number;
  offsetX: number;
  offsetY?: number;
  front?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Animated.View
      style={[
        S.tile,
        front && S.tileFront,
        {
          transform: [
            {
              translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, offsetX] }),
            },
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [28, offsetY],
              }),
            },
            {
              rotate: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${rotate}deg`],
              }),
            },
          ],
        },
      ]}
    >
      <Image source={source} style={S.tileImage} resizeMode="cover" />
      {children}
    </Animated.View>
  );
}

function HeroBackdrop({
  source,
  children,
}: {
  source: ImageSourcePropType;
  children: React.ReactNode;
}) {
  return (
    <View style={S.hero}>
      <Image source={source} style={S.backdrop} resizeMode="cover" blurRadius={18} />
      <LinearGradient
        colors={[`${REVEAL_TRACK_GRADIENT[1]}66`, `${REVEAL_TRACK_GRADIENT[2]}33`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={S.tiles}>{children}</View>
      <LinearGradient
        colors={[SHEET_COLOUR_CLEAR, SHEET_COLOUR]}
        locations={[0.78, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

function PlayBadge() {
  return (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.play}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d="M8 5.5v13l11-6.5z" fill="#FFFFFF" />
      </Svg>
    </LinearGradient>
  );
}

function GuestbookHero() {
  const entrance = useEntrance();
  return (
    <HeroBackdrop source={require('../../../assets/sample-event/05.jpg')}>
      <FannedTile
        source={require('../../../assets/sample-event/07.jpg')}
        entrance={entrance}
        rotate={-9}
        offsetX={-92}
        offsetY={10}
      />
      <FannedTile
        source={require('../../../assets/sample-event/01.jpg')}
        entrance={entrance}
        rotate={9}
        offsetX={92}
        offsetY={10}
      />
      <FannedTile
        source={require('../../../assets/sample-event/05.jpg')}
        entrance={entrance}
        rotate={0}
        offsetX={0}
        front
      >
        <View style={S.playWrap}>
          <PlayBadge />
        </View>
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
          style={S.captionFade}
        >
          <AppText variant="bodySmall" style={S.caption} numberOfLines={1}>
            Priya · 0:24
          </AppText>
        </LinearGradient>
      </FannedTile>
    </HeroBackdrop>
  );
}

function ChallengeBadge({ emoji, label }: { emoji: string; label: string }) {
  return (
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
      style={S.captionFade}
    >
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.emoji}>
        <AppText style={S.emojiText}>{emoji}</AppText>
      </LinearGradient>
      <AppText variant="bodySmall" style={S.caption} numberOfLines={1}>
        {label}
      </AppText>
    </LinearGradient>
  );
}

function ChallengesHero() {
  const entrance = useEntrance();
  return (
    <HeroBackdrop source={require('../../../assets/sample-event/06.jpg')}>
      <FannedTile
        source={require('../../../assets/sample-event/02.jpg')}
        entrance={entrance}
        rotate={-9}
        offsetX={-92}
        offsetY={10}
      >
        <ChallengeBadge emoji="👶" label="Tiny Guest" />
      </FannedTile>
      <FannedTile
        source={require('../../../assets/sample-event/03.jpg')}
        entrance={entrance}
        rotate={9}
        offsetX={92}
        offsetY={10}
      >
        <ChallengeBadge emoji="🥹" label="Happy Tears" />
      </FannedTile>
      <FannedTile
        source={require('../../../assets/sample-event/06.jpg')}
        entrance={entrance}
        rotate={0}
        offsetX={0}
        front
      >
        <ChallengeBadge emoji="💃" label="Dance Floor Hero" />
      </FannedTile>
    </HeroBackdrop>
  );
}

function VideoTileCaption({ label }: { label: string }) {
  return (
    <>
      <View style={S.playWrap}>
        <PlayBadge />
      </View>
      <View style={S.duration}>
        <AppText style={S.durationText}>{label}</AppText>
      </View>
    </>
  );
}

function VideoHero() {
  const entrance = useEntrance();
  return (
    <HeroBackdrop source={require('../../../assets/sample-event/07.jpg')}>
      <FannedTile
        source={require('../../../assets/sample-event/06.jpg')}
        entrance={entrance}
        rotate={-9}
        offsetX={-92}
        offsetY={10}
      >
        <VideoTileCaption label="0:12" />
      </FannedTile>
      <FannedTile
        source={require('../../../assets/sample-event/03.jpg')}
        entrance={entrance}
        rotate={9}
        offsetX={92}
        offsetY={10}
      >
        <VideoTileCaption label="0:08" />
      </FannedTile>
      <FannedTile
        source={require('../../../assets/sample-event/07.jpg')}
        entrance={entrance}
        rotate={0}
        offsetX={0}
        front
      >
        <VideoTileCaption label="0:24" />
      </FannedTile>
    </HeroBackdrop>
  );
}

/** Tables on the floor plan, as fractions of it. The fourth is the guest's. */
const TABLES = [
  { x: 0.16, y: 0.3 },
  { x: 0.42, y: 0.22 },
  { x: 0.7, y: 0.3 },
  { x: 0.3, y: 0.7 },
  { x: 0.6, y: 0.72 },
] as const;
const PLAN_WIDTH = 250;
const PLAN_HEIGHT = 128;
const TABLE_SIZE = 34;
const SEAT_SIZE = 7;

function SeatingTable({ index, entrance }: { index: number; entrance: Animated.Value }) {
  const table = TABLES[index]!;
  const isYours = index === 3;
  // Each table arrives a little after the one before it.
  const start = index * 0.12;
  const scale = entrance.interpolate({
    inputRange: [start, Math.min(start + 0.4, 1)],
    outputRange: [0.4, 1],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      style={[
        S.table,
        {
          left: table.x * PLAN_WIDTH - TABLE_SIZE / 2,
          top: table.y * PLAN_HEIGHT - TABLE_SIZE / 2,
          opacity: scale,
          transform: [{ scale }],
        },
      ]}
    >
      {Array.from({ length: 6 }, (_, seat) => {
        const angle = (seat / 6) * Math.PI * 2;
        const r = TABLE_SIZE / 2 + SEAT_SIZE / 2 + 1;
        return (
          <View
            key={seat}
            style={[
              S.seat,
              isYours && S.seatYours,
              {
                left: TABLE_SIZE / 2 + Math.cos(angle) * r - SEAT_SIZE / 2,
                top: TABLE_SIZE / 2 + Math.sin(angle) * r - SEAT_SIZE / 2,
              },
            ]}
          />
        );
      })}
      {isYours ? (
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.tableTop}>
          <AppText style={S.tableNumber}>4</AppText>
        </LinearGradient>
      ) : (
        <View style={[S.tableTop, S.tableTopPlain]} />
      )}
    </Animated.View>
  );
}

function SeatingHero() {
  const entrance = useEntrance();
  return (
    <HeroBackdrop source={require('../../../assets/sample-event/04.jpg')}>
      <View style={S.plan}>
        {TABLES.map((_, index) => (
          <SeatingTable key={index} index={index} entrance={entrance} />
        ))}
      </View>
      <Animated.View
        style={[
          S.yourSeat,
          {
            opacity: entrance,
            transform: [
              { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
          },
        ]}
      >
        <AppText variant="bodySmall" style={S.yourSeatText}>
          Priya, you’re at Table 4
        </AppText>
      </Animated.View>
    </HeroBackdrop>
  );
}

/** A crowd around the new limit, as offsets from the middle of the art. */
const GUEST_FACES: readonly { x: number; y: number; size: number; source: ImageSourcePropType }[] = [
  { x: -78, y: -30, size: 54, source: require('../../../assets/sample-event/01.jpg') },
  { x: 78, y: -30, size: 54, source: require('../../../assets/sample-event/02.jpg') },
  { x: -70, y: 28, size: 46, source: require('../../../assets/sample-event/03.jpg') },
  { x: 72, y: 28, size: 46, source: require('../../../assets/sample-event/04.jpg') },
  { x: -140, y: 2, size: 46, source: require('../../../assets/sample-event/05.jpg') },
  { x: 140, y: 2, size: 46, source: require('../../../assets/sample-event/06.jpg') },
  { x: -186, y: -38, size: 38, source: require('../../../assets/sample-event/07.jpg') },
  { x: 186, y: -38, size: 38, source: require('../../../assets/sample-event/03.jpg') },
  { x: -190, y: 40, size: 34, source: require('../../../assets/sample-event/02.jpg') },
  { x: 190, y: 40, size: 34, source: require('../../../assets/sample-event/01.jpg') },
];
/** Lifted clear of the pill. */
const GUEST_CROWD_LIFT = -18;
const GUEST_LIMIT_SIZE = 88;

function GuestFace({ index, entrance }: { index: number; entrance: Animated.Value }) {
  const face = GUEST_FACES[index]!;
  // Nearest first, so the crowd spreads outwards from the number.
  const start = index * 0.06;
  const scale = entrance.interpolate({
    inputRange: [start, Math.min(start + 0.4, 1)],
    outputRange: [0.3, 1],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      style={[
        S.face,
        {
          width: face.size,
          height: face.size,
          borderRadius: face.size / 2,
          opacity: scale,
          transform: [
            { translateX: face.x },
            { translateY: face.y + GUEST_CROWD_LIFT },
            { scale },
          ],
        },
      ]}
    >
      <Image source={face.source} style={S.tileImage} resizeMode="cover" />
    </Animated.View>
  );
}

function guestAllowanceLabel(plan: PaywallPlan | null): string {
  return typeof plan?.guestLimit === 'number' ? String(plan.guestLimit) : '∞';
}

function GuestsHero({ from, to }: PitchHeroProps) {
  const entrance = useEntrance();
  const toLabel = to?.guestLimit === 'unlimited' ? 'Unlimited guests' : `${to?.guestLimit} guests`;
  const scale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <HeroBackdrop source={require('../../../assets/sample-event/05.jpg')}>
      {GUEST_FACES.map((_, index) => (
        <GuestFace key={index} index={index} entrance={entrance} />
      ))}
      <Animated.View
        style={[S.guestLimitWrap, { transform: [{ translateY: GUEST_CROWD_LIFT }, { scale }] }]}
      >
        <LinearGradient
          colors={GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.guestLimit}
        >
          <AppText style={S.guestLimitText}>{guestAllowanceLabel(to)}</AppText>
        </LinearGradient>
      </Animated.View>
      <Animated.View
        style={[
          S.yourSeat,
          {
            opacity: entrance,
            transform: [
              { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
          },
        ]}
      >
        <AppText variant="bodySmall" style={S.yourSeatText}>
          {typeof from?.guestLimit === 'number' ? `${from.guestLimit} → ${toLabel}` : toLabel}
        </AppText>
      </Animated.View>
    </HeroBackdrop>
  );
}

/** The art for an upgrade sold on room for more guests. */
export const GUESTS_PITCH_HERO = GuestsHero;

export const FEATURE_PITCHES: Partial<Record<FeatureKey, FeaturePitch>> = {
  guestbook: {
    heading: 'The words you’ll want to keep',
    summary: 'Guests record a video message just for you, the part of the day photos can’t hold.',
    highlights: ['Video messages from guests', 'Private, only you can watch'],
    Hero: GuestbookHero,
  },
  guestbookMessages: {
    heading: 'Let them leave you a message',
    summary: 'Your Guestbook is ready. Upgrade and every guest can record a video message on it, just for you.',
    highlights: ['Video messages from guests', 'Private, only you can watch'],
    Hero: GuestbookHero,
  },
  unlimitedVideos: {
    heading: 'Keep every moment moving',
    summary: 'Each guest gets one video for now. Upgrade and they can film as many as they like.',
    highlights: ['Unlimited videos from every guest', 'Their own tab in your gallery'],
    Hero: VideoHero,
  },
  video: {
    heading: 'Relive it in motion',
    summary: 'Guests film short clips too, so you keep the first dance, the speeches and the laughter, not just the stills.',
    highlights: ['Short videos from every guest', 'Their own tab in your gallery'],
    Hero: VideoHero,
  },
  seating: {
    heading: 'Everyone finds their seat',
    summary: 'Add your tables and floor plan, and every guest is shown where they’re sitting as they join.',
    highlights: ['Guests find their table by name', 'Upload your own floor plan'],
    Hero: SeatingHero,
  },
  challenges: {
    heading: 'Get the shots everyone misses',
    summary: 'Send guests on photo missions. They play along, and you get moments you’d never think to ask for.',
    highlights: ['Ready-made or write your own', 'Every entry in one place'],
    Hero: ChallengesHero,
  },
};

export function PitchHighlights({ items }: { items: readonly string[] }) {
  return (
    <View style={S.highlights}>
      {items.map((item) => (
        <View key={item} style={S.highlight}>
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.tick}>
            <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#FFFFFF"
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </LinearGradient>
          <AppText variant="bodySmall" style={S.highlightText}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  hero: { height: HERO_HEIGHT, overflow: 'hidden' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  tiles: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tile: {
    position: 'absolute',
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: '#1A1A1D',
  },
  tileFront: { zIndex: 1, borderColor: '#FFFFFF' },
  tileImage: { width: '100%', height: '100%' },
  playWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    alignItems: 'center',
    gap: 3,
  },
  caption: { color: '#FFFFFF', fontSize: 11, lineHeight: 14 },
  emoji: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 14, lineHeight: 18 },
  duration: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  durationText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14 },
  plan: {
    width: PLAN_WIDTH,
    height: PLAN_HEIGHT,
    // Lifted clear of the pill naming the guest's table.
    marginBottom: spacing.xxl,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(13,13,15,0.62)',
  },
  table: { position: 'absolute', width: TABLE_SIZE, height: TABLE_SIZE },
  tableTop: {
    width: TABLE_SIZE,
    height: TABLE_SIZE,
    borderRadius: TABLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableTopPlain: { backgroundColor: 'rgba(255,255,255,0.16)' },
  tableNumber: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  seat: {
    position: 'absolute',
    width: SEAT_SIZE,
    height: SEAT_SIZE,
    borderRadius: SEAT_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  seatYours: { backgroundColor: '#FFFFFF' },
  yourSeat: {
    position: 'absolute',
    bottom: spacing.xl + spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  yourSeatText: { color: '#0B0B0C', fontWeight: '600' },
  face: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: '#1A1A1D',
  },
  guestLimitWrap: {
    position: 'absolute',
    width: GUEST_LIMIT_SIZE,
    height: GUEST_LIMIT_SIZE,
    borderRadius: GUEST_LIMIT_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  guestLimit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guestLimitText: { color: '#FFFFFF', fontSize: 40, lineHeight: 48, fontWeight: '700' },
  highlights: { gap: spacing.xs },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tick: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: { color: '#FFFFFF' },
});
