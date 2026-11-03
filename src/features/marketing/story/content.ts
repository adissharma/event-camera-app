/**
 * Everything the story says and shows, in one place.
 *
 * The demo event values are the same across every phone screen, and they are
 * illustrative: no real event sits behind them.
 */

export const DEMO_EVENT = {
  title: 'Olivia & Daniel’s Wedding',
  timeLeft: '2d 4h',
  shots: 24,
  guest: 'Ayla Brooks',
  seat: 'Table 7',
  otherGuest: 'Aylin Park',
  otherSeat: 'Table 2',
};

export const LINKS = {
  appStore: 'https://apps.apple.com/app/id6797053710',
  hostPortal: '/host',
  privacy: '/privacy',
};

export const ASSET = '/story';

export const art = (name: string) => `${ASSET}/art/${name}.webp`;
export const print = (id: string, small = false) => `${ASSET}/photo/print-${id}${small ? '-s' : ''}.webp`;
export const raw = (id: string) => `${ASSET}/photo/raw-${id}.webp`;
/** Tiny and already blurred, for the locked cells and the glass. */
export const blurredPrint = (id: string) => `${ASSET}/photo/blur-${id}.webp`;
export const blurredRaw = (id: string) => `${ASSET}/photo/raw-${id}-b.webp`;

export const CTA = {
  create: 'Create your event',
  scroll: 'Scroll to join the party',
  swipe: 'Swipe up to join the party',
  scan: 'Scan with your iPhone',
};

/**
 * Each scene's copy, in reading order. See docs/story-site/07-storyline-and-copy.md.
 * One idea per scene: the headline makes the promise and the body proves it.
 */
export const CHAPTERS = {
  s1: { title: 'You’ll miss most\nof your own party.', body: 'Your guests won’t. Stills turns every phone in the room into one shared camera.', alt: 'A bold black and white print of a wedding on the terrace of an Italian villa, under a hot pink and violet sunset.' },
  s2: { label: 'Scan', title: 'Nothing to download.\nNothing to explain.', body: 'One scan and Stills just opens, like a card trick. Guests type their name and start shooting. No app. No account. No password your uncle will forget.', alt: 'A phone scanning the QR code on a paper invitation, then opening the Stills join screen for Olivia and Daniel’s wedding.' },
  s3: { label: 'Seat', title: 'Retire the easel.', body: 'Guests type their name and Stills shows them their table. Add your floor plan and they can zoom in to find it. No second app. No extra charge.', alt: 'An old seating chart on an easel is thrown out of the picture. Then the Find your table screen shows Ayla seated at Table 7, and the host’s floor plan zooms in.' },
  s4: { label: 'Shoot', title: '120 photographers.\nZero invoices.', body: 'Your photographer gets the first dance. Your guests get the speech from table nine, the auntie on the dance floor and the hug you walked straight past.', alt: 'Night has fallen over the terrace. Guests take photos on their phones, each flash lights up a patch of the party, and a real photograph appears above it.' },
  s5: { label: 'Dare', title: 'Don’t ask for photos.\nSet a dare.', body: 'Happy Tears. Best Dressed. Caught in the Act. Write your own challenges or grab a ready-made pack, then watch your quietest table go to work.', alt: 'A phone showing the challenges Happy Tears, Best Dressed and Caught in the Act, while guests go to absurd lengths to get the shot.' },
  s6: { label: 'Messages', title: 'A photo can’t keep\nyour grandad’s voice.', body: 'So Stills has an audio and video guestbook. Guests leave you a message, out loud or on camera, and only you get to hear it.', alt: 'A grandfather speaking into his phone, while the Stills guestbook records his voice as a waveform.' },
  s7: { label: 'Reveal', title: 'Watch it live.', titleAfter: 'Or make them wait.', alt: 'A gallery filling up photo by photo. Then the Stills camera zooms in on its remaining-shots counter, which rolls up to 24 and runs down to nothing, and the gallery comes back locked, every photo blurred with the time until it’s revealed.' },
  s8: { label: 'Album', title: 'Here’s everything\nyou missed.', body: 'Every photo, video and message, from every guest, in one place. No chasing the group chat. Download the lot, and finally attend your own party.', alt: 'The sun comes up and each locked photo in the gallery reveals itself, one at a time. Last night’s couple sit on the empty terrace, looking through it.' },
  s9: { label: 'Parties', title: 'Any party with\nmore than one phone.', alt: 'Tabs for birthdays, bachelor and bachelorette parties, and holidays, each with its own setting and its own event on a phone.' },
};

/** The two ways to run the camera, in scene 7, in the order the phone shows them. */
export const REVEAL_OPTIONS = [
  { name: 'Go live.', line: 'Every photo lands in the gallery as it’s taken. The party watches itself happen.' },
  { name: 'Go disposable.', line: 'A limited roll. Direct flash, a little grain, a printed date stamp. Nobody sees a thing until the moment you pick.' },
];

/** The last thing on the page, once the story has let go of the scroll. */
export const CLOSE = {
  title: 'It only happens once.\nCatch all of it.',
  body: 'Make your event. Share the QR code. Go enjoy your own party.',
};

/** Checked against the code: see the fact check in docs/story-site/07-storyline-and-copy.md. */
export const FAQS = [
  { q: 'Do my guests need to download anything?', a: 'No. On a recent iPhone the QR code opens Stills as an App Clip, with nothing to install. On other phones it opens in the browser. Guests type their name and start shooting, with no account and no password.' },
  { q: 'What do I need to create an event?', a: 'The Stills app for iPhone, which is free to download. An Android app is coming soon. Once your event is made, you can also look after its photos, guests and seating from the web portal.' },
  { q: 'How much does it cost?', a: 'Free for up to 5 guests. Bigger events are a one-off payment from £14.99 per event, with no subscription. Stills+ is £49.99 for unlimited guests, and adds videos, challenges and the guestbook.' },
  { q: 'When do guests see the photos?', a: 'You choose. Share every photo live as it’s taken, or keep them locked until the event closes or until a day and time you pick. Then they reveal themselves.' },
  { q: 'Can guests leave audio and video messages?', a: 'Yes, with Stills+. Guests record a message for your guestbook, out loud or on camera. Only you get to hear it.' },
  { q: 'Can Stills really replace my seating chart?', a: 'It can. Seating comes with every plan. Guests type their name to find their table, and if you add a floor plan as a PNG, JPEG or PDF, they can zoom in to find it.' },
  { q: 'Can I download everything afterwards?', a: 'Yes. Sign in to the web portal and download the lot as ZIP files.' },
];

/** Real challenges, word for word from `challenge-packs.ts`. */
export const DARES = [
  { label: 'Happy Tears', icon: '🥹', line: 'Spot someone getting emotional and capture the moment.', photo: 'p04' },
  { label: 'Best Dressed', icon: '👗', line: 'Capture an outfit or look that deserves attention.', photo: 'p02' },
  { label: 'Caught in the Act', icon: '😂', line: 'Capture the funniest unplanned moment.', photo: 'p07' },
];

/**
 * The tabs in the parties scene. Each has its own setting and its own event on the
 * phone. `photos` starts with the cover, then the grid, from `bake-usecase.mjs`. Any
 * cell without a photo shows a placeholder tile, as the rows below the phone's edge do.
 */
export const USE_CASES: {
  id: string;
  tab: string;
  title: string;
  line: string;
  art: string;
  tint: string;
  event: { title: string; photos: string; joined: string; when: string };
  photos: string[];
  /** The cover, blurred, for behind the glass. */
  blurred?: string;
  /** The name tag on each photo in the grid. */
  by?: string[];
}[] = [
  {
    id: 'birthday', tab: 'Birthdays', title: 'Birthdays.', line: 'The surprise face. From every angle.', art: 'setting-birthday', tint: '#b5249f',
    event: { title: 'Maya’s surprise 40th', photos: '286', joined: '22', when: '1' },
    photos: [`${ASSET}/usecase/birthday-1.webp`, `${ASSET}/usecase/birthday-2.webp`, `${ASSET}/usecase/birthday-3.webp`],
    blurred: `${ASSET}/usecase/birthday-1-b.webp`,
    by: ['Sam', 'Nina'],
  },
  {
    id: 'bach', tab: 'Bach parties', title: 'Bachelor and bachelorette parties.', line: 'What happens on the trip stays in the gallery.', art: 'setting-bach', tint: '#2860c8',
    event: { title: 'Jess’s Last Weekend', photos: '214', joined: '8', when: '3' },
    photos: [`${ASSET}/usecase/bach-1.webp`, `${ASSET}/usecase/bach-2.webp`, `${ASSET}/usecase/bach-3.webp`],
    blurred: `${ASSET}/usecase/bach-1-b.webp`,
    by: ['Holly', 'Mia'],
  },
  {
    id: 'trip', tab: 'Holidays', title: 'Holidays and group trips.', line: 'You shot the sunset. They shot you asleep on the beach.', art: 'setting-trip', tint: '#f67b3d',
    event: { title: 'Lisbon, All of Us', photos: '337', joined: '9', when: '5' },
    photos: [`${ASSET}/usecase/trip-1.webp`, `${ASSET}/usecase/trip-2.webp`, `${ASSET}/usecase/trip-3.webp`],
    blurred: `${ASSET}/usecase/trip-1-b.webp`,
    by: ['Ana', 'Joe'],
  },
];
export const USE_CASES_ALSO = 'Plus engagements, anniversaries, graduations, baby showers, housewarmings and Christmas parties. There’s a challenge pack for each.';

/** Beside a moment in the room, like someone pointing it out at the party. */
export const NOTES = {
  table7: 'Table 7. That’s you.',
};

/** Notes for the photos that lift out of the gallery. */
export const MEMORIES = [
  { photo: 'p04', note: 'Table 4, all through the speeches.' },
  { photo: 'p06', note: 'You were at the bar for this one.' },
  { photo: 'p01', note: 'Best guest of the night.' },
];

/**
 * The photos swirling round the phone before they settle into the album. Parked for now:
 * the album's locked slots reveal themselves instead. Turn it back on here, and move the
 * cell reveal out of the way in `choreography.ts`.
 */
export const SWIRL = false;

/** What's in the album on the phone, in grid order. */
export const GALLERY = ['p08', 'p07', 'p05', 'p01', 'p06', 'p03', 'p02', 'p04', 'p12', 'p14', 'p10', 'p11'];
/** The name tag on each of those photos. */
export const GALLERY_BY = ['Ayla', 'Tom', 'Priya', 'Uncle Raj', 'Sofia', 'Ben', 'Nana', 'Leo', 'Ayla', 'Grace', 'Tom', 'Priya'];
