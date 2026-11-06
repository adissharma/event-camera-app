import { useEffect, useRef, type ComponentType } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { REVEAL_TRACK_GRADIENT, spacing, useMotion } from '@/design';
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
  Hero: ComponentType;
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

export const FEATURE_PITCHES: Partial<Record<FeatureKey, FeaturePitch>> = {
  guestbook: {
    heading: 'The words you’ll want to keep',
    summary: 'Guests record a video message just for you, the part of the day photos can’t hold.',
    highlights: ['Video messages from guests', 'Private, only you can watch'],
    Hero: GuestbookHero,
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
