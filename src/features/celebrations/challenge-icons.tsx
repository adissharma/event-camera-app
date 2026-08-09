import { StyleSheet, Text, View } from 'react-native';

import { colours } from '@/design';

type OpenMojiRawEntry = {
  emoji: string;
  hexcode: string;
  group: string;
  annotation: string;
  tags: string;
};

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

const OPENMOJI_GROUP_ORDER = [
  'smileys-emotion',
  'people-body',
  'animals-nature',
  'food-drink',
  'travel-places',
  'activities',
  'objects',
  'symbols',
  'extras-openmoji',
  'extras-unicode',
  'component',
] as const;

const OPENMOJI_GROUP_TITLES: Record<string, string> = {
  recommended: 'Recommended',
  'smileys-emotion': 'Smileys & Emotion',
  'people-body': 'People & Body',
  'animals-nature': 'Animals & Nature',
  'food-drink': 'Food & Drink',
  'travel-places': 'Travel & Places',
  activities: 'Activities',
  objects: 'Objects',
  symbols: 'Symbols',
  'extras-openmoji': 'Extras OpenMoji',
  'extras-unicode': 'Extras Unicode',
  component: 'Component',
  flags: 'Flags',
};

const LEGACY_ICON_TO_HEXCODE: Record<string, string> = {
  firstDance: '1F483',
  rings: '1F48D',
  group: '1F465',
  decor: '1F380',
  candle: '1F56F-FE0F',
  champagne: '1F37E',
  cake: '1F382',
  bouquet: '1F490',
  gift: '1F381',
  confetti: '1F389',
  birthday: '1F388',
  babyShower: '1F476',
  bridalShower: '1F470',
  engagement: '1F48D',
  graduation: '1F393',
  housewarming: '1F3E0',
  bachelorette: '1F483',
  anniversary: '1F493',
  reunion: '1F91D',
  cocktail: '1F378',
  conference: '1F5E3-FE0F',
  teamBuilding: '1F91D',
  gala: '1F3A9',
  awards: '1F3C6',
  productLaunch: '1F680',
  networking: '1F5E3-FE0F',
  retreat: '1F3D6',
  training: '1F4DA',
  holiday: '1F384',
  sports: '1F3C5',
  ceremony: '26EA',
  vows: '1F48C',
  kiss: '1F48B',
  music: '1F3B5',
  dj: '1F3A7',
  microphone: '1F3A4',
  dinner: '1F37D-FE0F',
  brunch: '1F95E',
  coffee: '2615',
  bbq: '1F356',
  beach: '1F3D6',
  sunset: '1F305',
  fireworks: '1F386',
  campfire: '1F525',
  selfie: '1F933',
  camera: '1F4F7',
  kids: '1F9D2',
  pets: '1F436',
  travel: '2708-FE0F',
  games: '1F3B2',
  pool: '1F3CA',
  food: '1F354',
  balloons: '1F388',
  stars: '2B50',
};

const RECOMMENDED_HEX_CODES = [
  '1F389', // party popper
  '1F38A', // confetti ball
  '1F388', // balloon
  '1F381', // wrapped gift
  '1F973', // partying face
  '1F970', // smiling face with hearts
  '1F60D', // smiling face with heart-eyes
  '1F929', // star-struck
  '1F602', // face with tears of joy
  '1F923', // rolling on the floor laughing
  '1F609', // winking face
  '1F60E', // smiling face with sunglasses
  '1F917', // hugging face
  '1F44F', // clapping hands
  '1F64C', // raising hands
  '1F4AF', // hundred points
  '1F4A5', // collision
  '1F525', // fire
  '1F31F', // glowing star
  '2B50', // star
  '1F31E', // sun with face
  '1F386', // fireworks
  '1F387', // sparkler
  '1F941', // drum
  '1F3C6', // trophy
  '1F3C5', // sports medal
  '1F4AA', // flexed biceps
  '1F91D', // handshake
  '1F48B', // kiss mark
  '1F48D', // ring
  '1F370', // shortcake
  '1F382', // birthday cake
  '1F36D', // lollipop
  '1F36A', // cookie
  '1F9C1', // cupcake
  '1F37E', // bottle with popping cork
  '1F378', // cocktail glass
  '1F379', // tropical drink
  '1F37A', // beer mug
  '1F36B', // chocolate bar
  '1F36C', // candy
  '1F36E', // custard
  '1F9E8', // firecracker
  '1F4F7', // camera
  '1F3A4', // microphone
  '1F3B5', // musical note
  '1F3A7', // headphones
  '1F3B2', // game die
  '1F380', // ribbon
  '1F490', // bouquet
] as const;

const LEGACY_BRIEFS: Record<string, ChallengeBrief> = {
  firstDance: { desc: '', instr: 'Wait for the music to slow, find a clear angle of the dancefloor, and snap a candid reaction or wide frame of their dip!' },
  rings: { desc: '', instr: 'Look for a moment when they rest their hands together on a table, or ask to snap a macro shot of the rings catching the light.' },
  group: { desc: '', instr: 'Squeeze everyone close together, make sure all faces are visible and well-lit, and capture the joy of the celebration!' },
  decor: { desc: '', instr: 'Shoot from a low angle to emphasize the candle arrangements, or frame the menu cards and place cards in soft focus.' },
  candle: { desc: '', instr: 'Turn off your camera flash, steady your hands, and capture the flickering flames lighting up the guests’ smiles.' },
  champagne: { desc: '', instr: 'Snap the glasses clinking mid-air, or capture the bubbles in the glass offset by the background bokeh.' },
  cake: { desc: '', instr: 'Frame the entire cake showing the floral decorations, or snap the couple sharing the first bite.' },
  bouquet: { desc: '', instr: 'Find the flowers in motion or frame the arrangement close-up with plenty of texture and colour.' },
  gift: { desc: '', instr: 'Highlight the guest book, the envelope box, or the handwritten signs.' },
  confetti: { desc: '', instr: 'Pre-focus on the aisle, wait for the couple to walk through the shower of petals, and snap a high-energy shot.' },
  birthday: { desc: '', instr: 'Capture the birthday person blowing out the candles or the moment they see their cake for the first time.' },
  babyShower: { desc: '', instr: 'Frame the parent-to-be opening gifts or playing games with the guests, with plenty of smiles and celebration.' },
  bridalShower: { desc: '', instr: 'Snap the bride laughing as she opens gifts, or capture the decorations with their personalized touches.' },
  engagement: { desc: '', instr: 'Focus on their hands together showing off the new ring, or capture their joy with close family.' },
  graduation: { desc: '', instr: 'Get the graduate in cap and gown, either posed or in candid moments with loved ones.' },
  housewarming: { desc: '', instr: 'Capture the home’s special features, or snap guests enjoying the space and raising a toast.' },
  bachelorette: { desc: '', instr: 'Frame the group having fun together, silly moments, and the guest of honour at the center of it all.' },
  anniversary: { desc: '', instr: 'Capture the couple together in a heartfelt moment, or with their loved ones celebrating milestones.' },
  reunion: { desc: '', instr: 'Get nostalgic moments: old friends embracing, group shots, and genuine laughter together.' },
  cocktail: { desc: '', instr: 'Frame the elegant drinks, guests mingling, and the ambient glow of the venue.' },
  conference: { desc: '', instr: 'Snap speakers at the podium, panel discussions, or attendees networking in the halls.' },
  teamBuilding: { desc: '', instr: 'Capture the team in action: activities, laughter, and moments of camaraderie.' },
  gala: { desc: '', instr: 'Frame elegantly dressed guests, the venue décor, and guests enjoying cocktails and conversation.' },
  awards: { desc: '', instr: 'Capture honorees on stage, acceptance moments, and celebratory toasts.' },
  productLaunch: { desc: '', instr: 'Frame the product reveal, audience reactions, and the team celebrating the launch.' },
  networking: { desc: '', instr: 'Snap meaningful conversations between attendees, business card exchanges, and group introductions.' },
  retreat: { desc: '', instr: 'Capture outdoor activities, team bonding moments, and the scenic venue backdrop.' },
  training: { desc: '', instr: 'Frame the instructor engaging with participants, hands-on activities, and group discussions.' },
  holiday: { desc: '', instr: 'Snap the festive decorations, group gatherings, and guests in holiday spirit.' },
  sports: { desc: '', instr: 'Capture action shots of the game or activity, team celebrations, and victory moments.' },
  ceremony: { desc: '', instr: 'Focus on the most formal and meaningful parts of the ceremony, with a clean composition and clear subject.' },
  vows: { desc: '', instr: 'Get a quiet, emotional frame of the vows being read or exchanged.' },
  kiss: { desc: '', instr: 'Anticipate the moment, frame both faces clearly, and capture the kiss at its peak.' },
  music: { desc: '', instr: 'Catch the performer mid-song or the audience reacting to the sound and atmosphere.' },
  dj: { desc: '', instr: 'Frame the DJ booth, the crowd energy, or the hands working the decks.' },
  microphone: { desc: '', instr: 'Capture the speaker clearly with enough background context to show the room and audience.' },
  dinner: { desc: '', instr: 'Look for shared plates, candlelight, and people enjoying the meal together.' },
  brunch: { desc: '', instr: 'Capture bright, social moments around the table with food, drinks, and conversation.' },
  coffee: { desc: '', instr: 'Get the steam, the pour, or a relaxed moment holding a coffee cup.' },
  bbq: { desc: '', instr: 'Capture the grill in action, hands serving food, or guests gathered around the cookout.' },
  beach: { desc: '', instr: 'Use the shoreline, sea, and open sky to create a spacious frame full of atmosphere.' },
  sunset: { desc: '', instr: 'Wait for warm light and strong silhouettes, and expose for the sky rather than the faces.' },
  fireworks: { desc: '', instr: 'Frame the crowd and the sky together if possible, and catch the burst at its fullest spread.' },
  campfire: { desc: '', instr: 'Capture the warm glow on faces and the fire itself without losing the atmosphere of the dark surroundings.' },
  selfie: { desc: '', instr: 'Look for genuine reactions and a playful composition that feels spontaneous rather than staged.' },
  camera: { desc: '', instr: 'Capture someone in the act of taking a photo, or a photo-worthy moment that deserves its own spotlight.' },
  kids: { desc: '', instr: 'Get low to their eye level and capture the energy, curiosity, or playfulness of the moment.' },
  pets: { desc: '', instr: 'Focus on expression and timing: ears up, tail wagging, or a quiet cuddle moment.' },
  travel: { desc: '', instr: 'Use movement, bags, transport, or scenery to make the image feel like part of a journey.' },
  games: { desc: '', instr: 'Capture the competitive moment, the reaction, or the funniest part of the game.' },
  pool: { desc: '', instr: 'Frame splashes, reflections, and bright summer colour for a playful scene.' },
  food: { desc: '', instr: 'Get close enough to show texture and shape, and include hands or table details when they add warmth.' },
  balloons: { desc: '', instr: 'Use the balloons to fill negative space or frame the subject in a celebratory way.' },
  stars: { desc: '', instr: 'Look for sparkle, night light, or dreamy details that give the event a magical mood.' },
};

const RAW_OPENMOJI = require('../../../assets/data/openmoji-nonflags.json') as OpenMojiRawEntry[];

const HEXCODE_TO_ENTRY = new Map<string, OpenMojiRawEntry>(RAW_OPENMOJI.map((entry) => [entry.hexcode, entry]));
const EMOJI_TO_ENTRY = new Map<string, OpenMojiRawEntry>(RAW_OPENMOJI.map((entry) => [entry.emoji, entry]));
const SKIN_TONE_MARKERS = new Set(['1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF']);

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function splitKeywords(value: string) {
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function isToneVariant(entry: OpenMojiRawEntry) {
  return entry.hexcode.split('-').some((part) => SKIN_TONE_MARKERS.has(part));
}

const OPENMOJI_OPTIONS: ChallengeIconOption[] = RAW_OPENMOJI
  .filter((entry) => entry.group !== 'flags' && !isToneVariant(entry))
  .sort((a, b) => {
    const groupDelta = OPENMOJI_GROUP_ORDER.indexOf(a.group as (typeof OPENMOJI_GROUP_ORDER)[number]) -
      OPENMOJI_GROUP_ORDER.indexOf(b.group as (typeof OPENMOJI_GROUP_ORDER)[number]);
    if (groupDelta !== 0) return groupDelta;
    return titleCase(a.annotation).localeCompare(titleCase(b.annotation));
  })
  .map((entry) => {
    const label = titleCase(entry.annotation);
    const keywords = Array.from(
      new Set([
        label.toLowerCase(),
        entry.annotation.toLowerCase(),
        entry.hexcode.toLowerCase(),
        entry.emoji,
        OPENMOJI_GROUP_TITLES[entry.group]?.toLowerCase() ?? entry.group,
        ...splitKeywords(entry.tags),
      ]),
    );

    return {
      type: entry.hexcode,
      label,
      emoji: entry.emoji,
      group: entry.group,
      keywords,
      searchText: keywords.join(' '),
    };
  });

const OPENMOJI_OPTION_BY_HEXCODE = new Map<string, ChallengeIconOption>(
  OPENMOJI_OPTIONS.map((option) => [option.type, option]),
);
const OPENMOJI_OPTION_BY_EMOJI = new Map<string, ChallengeIconOption>(
  OPENMOJI_OPTIONS.map((option) => [option.emoji, option]),
);

export const CHALLENGE_ICON_OPTIONS = OPENMOJI_OPTIONS;
export const OPENMOJI_LIBRARY_COUNT = OPENMOJI_OPTIONS.length;
export const RECOMMENDED_ICON_OPTIONS = RECOMMENDED_HEX_CODES
  .map((hexcode) => OPENMOJI_OPTION_BY_HEXCODE.get(hexcode))
  .filter((option): option is ChallengeIconOption => Boolean(option));

export const OPENMOJI_SECTIONS: ChallengeIconSection[] = OPENMOJI_GROUP_ORDER.map((group) => ({
  key: group,
  title: OPENMOJI_GROUP_TITLES[group],
  data: OPENMOJI_OPTIONS.filter((option) => option.group === group),
})).filter((section) => section.data.length > 0);

export const CHALLENGE_ICON_SECTIONS: ChallengeIconSection[] = [
  {
    key: 'recommended',
    title: 'Recommended',
    data: RECOMMENDED_ICON_OPTIONS,
  },
  ...OPENMOJI_SECTIONS,
];

export const CHALLENGE_BRIEFS: Record<string, ChallengeBrief> = {
  ...LEGACY_BRIEFS,
  ...Object.fromEntries(
    Object.entries(LEGACY_BRIEFS)
      .map(([legacyKey, brief]) => {
        const hexcode = LEGACY_ICON_TO_HEXCODE[legacyKey];
        return hexcode ? [[hexcode, brief] as const] : [];
      })
      .flat(),
  ),
};

export function normalizeChallengeIconValue(value: string) {
  if (LEGACY_ICON_TO_HEXCODE[value]) {
    return LEGACY_ICON_TO_HEXCODE[value];
  }

  if (HEXCODE_TO_ENTRY.has(value)) {
    return value;
  }

  if (EMOJI_TO_ENTRY.has(value)) {
    return EMOJI_TO_ENTRY.get(value)!.hexcode;
  }

  return value;
}

export function resolveChallengeEmoji(value: string) {
  if (LEGACY_ICON_TO_HEXCODE[value]) {
    return HEXCODE_TO_ENTRY.get(LEGACY_ICON_TO_HEXCODE[value])?.emoji ?? '✨';
  }

  if (HEXCODE_TO_ENTRY.has(value)) {
    return HEXCODE_TO_ENTRY.get(value)!.emoji;
  }

  if (EMOJI_TO_ENTRY.has(value)) {
    return value;
  }

  return '✨';
}

export function resolveChallengeLabel(value: string) {
  if (LEGACY_ICON_TO_HEXCODE[value]) {
    return OPENMOJI_OPTION_BY_HEXCODE.get(LEGACY_ICON_TO_HEXCODE[value])?.label ?? value;
  }

  return OPENMOJI_OPTION_BY_HEXCODE.get(value)?.label ?? OPENMOJI_OPTION_BY_EMOJI.get(value)?.label ?? value;
}

export function resolveChallengeBrief(value: string) {
  // Exact key first, normalised second — not the other way round. Several
  // legacy names share one OpenMoji hexcode (`rings` and `engagement` are both
  // `1F48D`), and `CHALLENGE_BRIEFS` spreads the hexcode aliases last, so the
  // shared hexcode holds whichever brief was defined latest. Normalising first
  // therefore handed `rings` the engagement brief. An exact legacy name is
  // unambiguous, so it should never be resolved through a lossy alias.
  return CHALLENGE_BRIEFS[value] ?? CHALLENGE_BRIEFS[normalizeChallengeIconValue(value)];
}

export function ChallengeIconSVG({
  type,
  size = 24,
  color = colours.textPrimary,
}: {
  type: string;
  size?: number;
  color?: string;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[S.frame, { width: size, height: size }]}
    >
      <Text
        allowFontScaling={false}
        style={[
          S.emoji,
          {
            fontSize: Math.max(12, Math.round(size * 0.78)),
            lineHeight: Math.max(14, Math.round(size * 0.92)),
            color,
          },
        ]}
      >
        {resolveChallengeEmoji(type)}
      </Text>
    </View>
  );
}

const S = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  emoji: {
    fontFamily: 'OpenMojiBlack',
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});
