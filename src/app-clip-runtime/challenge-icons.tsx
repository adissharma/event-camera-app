import { StyleSheet, Text, View } from 'react-native';

export interface ChallengeIconOption {
  type: string;
  label: string;
  emoji: string;
  group: string;
  keywords: string[];
  searchText: string;
}

export type ChallengeBrief = { desc: string; instr: string };
export type ChallengeIconSection = { key: string; title: string; data: ChallengeIconOption[] };

export const CHALLENGE_ICON_OPTIONS: readonly ChallengeIconOption[] = [];
export const RECOMMENDED_ICON_OPTIONS: readonly ChallengeIconOption[] = [];
export const OPENMOJI_SECTIONS: readonly ChallengeIconSection[] = [];
export const CHALLENGE_ICON_SECTIONS: readonly ChallengeIconSection[] = [];
export const OPENMOJI_LIBRARY_COUNT = 0;
export const CHALLENGE_BRIEFS: Record<string, ChallengeBrief> = {};

const LEGACY_EMOJI: Record<string, string> = {
  firstDance: '💃', rings: '💍', group: '👥', decor: '🎀',
  candle: '🕯️', champagne: '🍾', cake: '🎂', bouquet: '💐',
  gift: '🎁', confetti: '🎉', birthday: '🎈', babyShower: '👶',
  bridalShower: '👰', engagement: '💍', graduation: '🎓', housewarming: '🏠',
  bachelorette: '💃', anniversary: '💓', reunion: '🤝', cocktail: '🍸',
  conference: '🗣️', teamBuilding: '🤝', gala: '🎩', awards: '🏆',
  productLaunch: '🚀', networking: '🗣️', retreat: '🏖️', training: '📚',
  holiday: '🎄', sports: '🏅', ceremony: '⛪', vows: '💌', kiss: '💋',
  music: '🎵', dj: '🎧', microphone: '🎤', dinner: '🍽️', brunch: '🥞',
  coffee: '☕', bbq: '🍖', beach: '🏖️', sunset: '🌅', fireworks: '🎆',
  campfire: '🔥', selfie: '🤳', camera: '📷', kids: '🧒', pets: '🐶',
  travel: '✈️', games: '🎲', pool: '🏊', food: '🍔', balloons: '🎈', stars: '⭐',
};

export function normalizeChallengeIconValue(value: string): string {
  return value?.trim() || 'camera';
}

export function resolveChallengeEmoji(value: string): string {
  const normalized = normalizeChallengeIconValue(value);
  return LEGACY_EMOJI[normalized] ?? normalized;
}

export function resolveChallengeLabel(value: string): string {
  return normalizeChallengeIconValue(value).replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function resolveChallengeBrief(): ChallengeBrief {
  return { desc: '', instr: '' };
}

export function ChallengeIconSVG({
  type,
  size = 24,
  color = '#FFFFFF',
}: {
  type: string;
  size?: number;
  color?: string;
}) {
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Text style={{ fontSize: Math.max(12, Math.round(size * 0.86)), lineHeight: size, color }}>
        {resolveChallengeEmoji(type)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
});
