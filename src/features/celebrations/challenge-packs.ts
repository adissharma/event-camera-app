/**
 * Curated Challenge Packs — a fast starting point for a host who does not
 * want to write five prompts from scratch, without forcing every event into
 * the same generic set the app used to auto-seed.
 *
 * Icons are raw emoji, exactly as `ChallengeIconSVG`/`resolveChallengeEmoji`
 * already accept for display. They are normalised to an OpenMoji hexcode
 * (via `normalizeChallengeIconValue`) only at the point a challenge is
 * actually persisted, matching how hand-picked icons are stored today.
 */

export type ChallengePackChallenge = {
  label: string;
  icon: string;
  instructions: string;
};

export type ChallengePack = {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: ChallengePackCategory;
  challenges: ChallengePackChallenge[];
};

export type ChallengePackCategory = 'weddings' | 'parties' | 'holidays';

export const CHALLENGE_PACK_CATEGORIES: { id: ChallengePackCategory; label: string }[] = [
  { id: 'weddings', label: 'Weddings' },
  { id: 'parties', label: 'Parties' },
  { id: 'holidays', label: 'Holidays' },
];

export const CHALLENGE_PACKS: ChallengePack[] = [
  {
    id: 'christian-wedding',
    name: 'Christian Wedding',
    icon: '💍',
    description: 'The moments every wedding day builds toward.',
    category: 'weddings',
    challenges: [
      { label: 'The First Look', icon: '👀', instructions: 'Capture the couple seeing each other for the first time.' },
      { label: 'Happy Tears', icon: '🥹', instructions: 'Spot someone getting emotional and capture the moment.' },
      { label: 'Dance Floor', icon: '💃', instructions: 'Catch someone giving it everything on the dance floor.' },
      { label: 'The Little Details', icon: '🔍', instructions: 'Capture a detail the couple might not get a chance to notice.' },
      { label: 'Behind the Scenes', icon: '🎬', instructions: 'Capture something brilliant happening away from the main action.' },
    ],
  },
  {
    id: 'bachelorette',
    name: 'Bachelorette / Hen Party',
    icon: '👰',
    description: 'Main character energy and the moments worth remembering the next morning.',
    category: 'parties',
    challenges: [
      { label: 'Main Character Energy', icon: '✨', instructions: 'Capture the bride-to-be having her moment.' },
      { label: 'Cheers', icon: '🥂', instructions: 'Get the perfect group toast.' },
      { label: 'Best Dressed', icon: '👗', instructions: 'Capture an outfit or look that deserves attention.' },
      { label: 'Caught in the Act', icon: '😂', instructions: 'Capture the funniest unplanned moment.' },
      { label: 'One for Tomorrow', icon: '🌅', instructions: 'Take a photo everyone will want to see again the next morning.' },
    ],
  },
  {
    id: 'stag',
    name: 'Stag Party',
    icon: '🤵',
    description: 'The group shot, the chaos, and the evidence.',
    category: 'parties',
    challenges: [
      { label: 'The Groom', icon: '🎩', instructions: 'Capture the groom in his natural habitat.' },
      { label: 'The Group Shot', icon: '👬', instructions: 'Get everyone together before things get chaotic.' },
      { label: 'Absolute Scenes', icon: '🔥', instructions: 'Capture the funniest moment of the day or night.' },
      { label: 'Unexpected MVP', icon: '🏆', instructions: 'Capture the person unexpectedly stealing the show.' },
      { label: 'Evidence', icon: '📱', instructions: 'Capture something the group will still be talking about afterwards.' },
    ],
  },
  {
    id: 'birthday',
    name: 'Birthday',
    icon: '🎂',
    description: 'The birthday person, the wish, and the reactions in between.',
    category: 'parties',
    challenges: [
      { label: 'Birthday Person', icon: '🥳', instructions: 'Capture the birthday person having their moment.' },
      { label: 'Make a Wish', icon: '🕯️', instructions: 'Capture the cake, candles or birthday celebration.' },
      { label: 'The Reunion', icon: '🤗', instructions: 'Catch friends or family seeing each other again.' },
      { label: 'Best Reaction', icon: '😲', instructions: 'Capture the funniest or happiest reaction of the event.' },
      { label: 'One They Missed', icon: '🎈', instructions: 'Capture something happening away from the birthday person.' },
    ],
  },
  {
    id: 'holiday-trip',
    name: 'Holiday / Group Trip',
    icon: '✈️',
    description: 'From arrival to the moment that sums up the whole trip.',
    category: 'holidays',
    challenges: [
      { label: 'We Made It', icon: '🛬', instructions: 'Capture the first proper moment of the trip.' },
      { label: 'The View', icon: '🏞️', instructions: 'Capture somewhere worth remembering.' },
      { label: 'Local Find', icon: '🗺️', instructions: 'Photograph something unique you discover along the way.' },
      { label: 'Holiday Chaos', icon: '🌀', instructions: 'Capture the moment when the trip goes slightly off-script.' },
      { label: 'Core Memory', icon: '💛', instructions: 'Capture a moment that sums up the whole trip.' },
    ],
  },
  {
    id: 'christmas-party',
    name: 'Christmas Party',
    icon: '🎄',
    description: 'Festive fits, gifts, and the last ones standing.',
    category: 'holidays',
    challenges: [
      { label: 'Festive Fits', icon: '🎅', instructions: 'Capture the best Christmas outfit.' },
      { label: 'Cheers', icon: '🥂', instructions: 'Capture the perfect festive toast.' },
      { label: 'Secret Santa', icon: '🎁', instructions: 'Catch a great gift or reaction.' },
      { label: 'Christmas Chaos', icon: '❄️', instructions: 'Capture the funniest moment of the party.' },
      { label: 'Last Ones Standing', icon: '🌙', instructions: 'Capture the energy later in the night.' },
    ],
  },
  {
    id: 'baby-shower',
    name: 'Baby Shower',
    icon: '🍼',
    description: 'The parents-to-be, and the details worth looking back on.',
    category: 'parties',
    challenges: [
      { label: 'The Parents-to-Be', icon: '🤰', instructions: 'Capture a moment with the parents-to-be.' },
      { label: 'Best Reaction', icon: '😲', instructions: 'Catch a brilliant reaction during the celebration.' },
      { label: 'Little Details', icon: '🧸', instructions: 'Capture decorations, gifts or details worth remembering.' },
      { label: 'Friends & Family', icon: '💕', instructions: 'Capture a meaningful moment between guests.' },
      { label: 'A Moment for the Baby', icon: '👶', instructions: "Capture something they'll enjoy looking back on one day." },
    ],
  },
  {
    id: 'engagement-party',
    name: 'Engagement Party',
    icon: '💎',
    description: 'The ring, the reactions, and the celebration of what comes next.',
    category: 'weddings',
    challenges: [
      { label: 'The Ring', icon: '💍', instructions: 'Capture a great shot of the ring.' },
      { label: 'The Couple', icon: '🥰', instructions: 'Capture the newly engaged couple together.' },
      { label: 'Cheers', icon: '🥂', instructions: 'Get the perfect group toast.' },
      { label: 'Family & Friends', icon: '💕', instructions: 'Capture a meaningful moment between guests.' },
      { label: 'The Reaction', icon: '😲', instructions: "Capture someone's reaction to the news." },
    ],
  },
  {
    id: 'anniversary-party',
    name: 'Anniversary Party',
    icon: '🥂',
    description: 'The couple, the story so far, and the people who came to celebrate it.',
    category: 'parties',
    challenges: [
      { label: 'The Couple', icon: '💑', instructions: 'Capture the couple celebrating together.' },
      { label: 'Then & Now', icon: '📷', instructions: 'Capture a moment that echoes their story.' },
      { label: 'Cheers', icon: '🥂', instructions: 'Get the perfect group toast.' },
      { label: 'Loved Ones', icon: '💕', instructions: 'Capture a meaningful moment between guests.' },
      { label: 'Best Reaction', icon: '😲', instructions: 'Capture the happiest reaction of the night.' },
    ],
  },
  {
    id: 'graduation',
    name: 'Graduation',
    icon: '🎓',
    description: 'The graduate, the celebration, and what comes next.',
    category: 'parties',
    challenges: [
      { label: 'The Graduate', icon: '🎓', instructions: 'Capture the graduate having their moment.' },
      { label: 'Cap Toss', icon: '🎉', instructions: 'Capture the celebration as it happens.' },
      { label: 'Proud Family', icon: '👨‍👩‍👧‍👦', instructions: 'Capture a moment between the graduate and their family.' },
      { label: 'Friends Forever', icon: '🤗', instructions: 'Capture a moment between friends.' },
      { label: "What's Next", icon: '🚀', instructions: 'Capture the excitement for what comes next.' },
    ],
  },
  {
    id: 'retirement-party',
    name: 'Retirement Party',
    icon: '🏆',
    description: 'The guest of honor, and the people celebrating their next chapter.',
    category: 'parties',
    challenges: [
      { label: 'The Retiree', icon: '🥳', instructions: 'Capture the guest of honor having their moment.' },
      { label: 'Colleagues & Friends', icon: '🤝', instructions: 'Capture a moment between coworkers or friends.' },
      { label: 'Cheers to the Next Chapter', icon: '🥂', instructions: 'Get the perfect toast.' },
      { label: 'Best Memory', icon: '💭', instructions: 'Capture something that sums up their career.' },
      { label: 'Best Reaction', icon: '😲', instructions: 'Capture the funniest or happiest reaction of the day.' },
    ],
  },
  {
    id: 'housewarming',
    name: 'Housewarming',
    icon: '🏡',
    description: 'The new place, the hosts, and the friends who came to see it.',
    category: 'parties',
    challenges: [
      { label: 'The New Place', icon: '🏠', instructions: 'Capture a detail of the new home worth remembering.' },
      { label: 'The Hosts', icon: '🥳', instructions: 'Capture the hosts enjoying their new space.' },
      { label: 'Cheers', icon: '🥂', instructions: 'Get the perfect toast.' },
      { label: 'Friends Together', icon: '💕', instructions: 'Capture a meaningful moment between guests.' },
      { label: 'Core Memory', icon: '💛', instructions: 'Capture a moment that sums up the day.' },
    ],
  },
  {
    id: 'gender-reveal',
    name: 'Gender Reveal',
    icon: '🎀',
    description: 'The big moment, and the reactions around it.',
    category: 'parties',
    challenges: [
      { label: 'The Reveal', icon: '🎉', instructions: 'Capture the big reveal moment.' },
      { label: 'Best Reaction', icon: '😲', instructions: 'Capture the happiest or funniest reaction.' },
      { label: 'The Parents-to-Be', icon: '🤰', instructions: 'Capture a moment with the parents-to-be.' },
      { label: 'Guessing Game', icon: '🤔', instructions: 'Capture guests before the reveal.' },
      { label: 'Little Details', icon: '🧸', instructions: 'Capture decorations or details worth remembering.' },
    ],
  },
  {
    id: 'jewish-wedding',
    name: 'Jewish Wedding',
    icon: '🕍',
    description: 'The chuppah, the celebration, and the moments in between.',
    category: 'weddings',
    challenges: [
      { label: 'Under the Chuppah', icon: '✡️', instructions: 'Capture the couple beneath the chuppah.' },
      { label: 'Breaking the Glass', icon: '🥂', instructions: 'Catch the glass-breaking moment and the cheer that follows.' },
      { label: 'The Hora', icon: '💃', instructions: 'Capture the energy of the dancing and celebration.' },
      { label: 'Family Blessings', icon: '👨‍👩‍👧‍👦', instructions: 'Capture a meaningful moment between the couple and their families.' },
      { label: 'Details Worth Remembering', icon: '🔍', instructions: 'Capture a detail the couple might not notice themselves.' },
    ],
  },
  {
    id: 'muslim-wedding',
    name: 'Muslim Wedding',
    icon: '🕌',
    description: 'The nikkah, the celebration, and the moments that follow.',
    category: 'weddings',
    challenges: [
      { label: 'The Nikkah Moment', icon: '📖', instructions: 'Capture the couple during their nikkah.' },
      { label: 'Joyful Celebration', icon: '🎊', instructions: 'Catch the energy when everyone is celebrating together.' },
      { label: 'Family Moments', icon: '👨‍👩‍👧‍👦', instructions: 'Capture a meaningful moment between family members.' },
      { label: 'The Details', icon: '🌸', instructions: 'Capture a detail, outfit or decoration that stands out.' },
      { label: 'Something They Missed', icon: '📸', instructions: 'Capture a moment the couple may not have seen themselves.' },
    ],
  },
  {
    id: 'hindu-wedding',
    name: 'Hindu Wedding',
    icon: '🪔',
    description: 'Colour, family and celebration, without assuming one script for every ceremony.',
    category: 'weddings',
    challenges: [
      { label: 'A Grand Entrance', icon: '🎉', instructions: 'Capture one of the unforgettable entrances.' },
      { label: 'Colour Everywhere', icon: '🌈', instructions: 'Find a detail, outfit or decoration that stands out.' },
      { label: 'Family Moments', icon: '👨‍👩‍👧‍👦', instructions: 'Capture a meaningful moment between family members.' },
      { label: 'The Celebration', icon: '🎊', instructions: 'Catch the energy when everyone is celebrating together.' },
      { label: 'Something They Missed', icon: '📸', instructions: 'Capture a moment the couple may not have seen themselves.' },
    ],
  },
];

export function findChallengePack(packId: string): ChallengePack | undefined {
  if (packId === 'white-wedding') {
    return CHALLENGE_PACKS.find((pack) => pack.id === 'christian-wedding');
  }
  return CHALLENGE_PACKS.find((pack) => pack.id === packId);
}
