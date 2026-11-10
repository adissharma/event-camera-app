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
};

/**
 * Each scene's copy, in reading order. See docs/story-site/07-storyline-and-copy.md.
 * One idea per scene: the headline makes the promise and the body proves it.
 */
export const CHAPTERS = {
  s1: { title: 'Turn every phone into\na disposable camera.', body: 'Stills is the private shared camera for weddings and parties. Guests scan your QR, no app needed, and every shot lands in one album.', alt: 'A bold black and white print of a wedding on the terrace of an Italian villa, under a hot pink and violet sunset.' },
  s2: { label: 'Join', title: 'Guests join\nwith one scan.', body: 'No app download, no account, no password needed. They scan your QR code and they’re in.', alt: 'A phone scanning the QR code on a paper invitation, then opening the Stills join screen for Olivia and Daniel’s wedding.' },
  s3: { label: 'Seating', title: 'A seating chart\non every phone.', body: 'No crowd round the easel. Guests scan, find their table and zoom into your floor plan.', alt: 'A crowd of confused guests squeeze round a paper seating chart on an easel. It turns into one big QR code and the crowd is gone. The Find your table screen shows Ayla at Table 7, and the host’s floor plan zooms in.' },
  s4: { label: 'Photos', title: 'Every guest is\nyour photographer.', body: 'Your photographer can’t be everywhere. Your guests are, catching the moments you miss.', alt: 'Night has fallen over the terrace. Guests take photos on their phones, each flash lights up a patch of the party, and a real photograph appears above it.' },
  s5: { label: 'Challenges', title: 'Photo challenges\nget everyone shooting.', body: 'Set prompts like Happy Tears and Best Dressed, or pick a ready-made pack for your event.', alt: 'A phone showing the challenges Happy Tears, Best Dressed and Caught in the Act, while guests go to absurd lengths to get the shot.' },
  s6: { label: 'Guestbook', title: 'A guestbook\nyou can actually hear.', body: 'Guests leave private voice or video messages: your mum in tears, your best friend at 1am.', alt: 'A guest in the lit terrace records a voice message on her phone, with its waveform on the Stills guestbook screen.' },
  s7: { label: 'Disposable', title: 'Make every shot count.\nThe reveal’s worth it.', body: 'Go disposable: one roll each, no peeking till morning. Or share every shot live. Your call.', alt: 'The Stills camera zooms in on its remaining-shots counter, which runs down to zero. The gallery locks, the sun comes up on an empty terrace, and with just the couple left, every photo is revealed.' },
  s8: { label: 'Album', title: 'Your guests are already\ntaking the photos.', body: 'Get every photo, video and message in one album. All you need is a QR code.', alt: 'The morning after. Last night’s couple sit on the empty terrace, looking through the album on the phone.' },
  s9: { label: 'Parties', title: 'Any party with\nmore than one phone.', alt: 'Tabs for birthdays, bachelor and bachelorette parties, and holidays, each with its own setting and its own event on a phone.' },
};

/** The last thing on the page, once the story has let go of the scroll. */
export const CLOSE = {
  title: 'It only happens once.\nCatch all of it.',
  body: 'Create your event in the app, share your QR code, and let your guests do the rest.',
};

/** Checked against the code: see the fact check in docs/story-site/07-storyline-and-copy.md. */
/** Teases what's next once a slide has finished, in order: after Guests join, and so on to after the last. */
export const KEEP_GOING = [
  'Keep {verb}, your table’s waiting',
  'Keep {verb}, the party’s starting',
  'Keep {verb} for the dares',
  'Keep {verb}, someone’s got a speech',
  'Keep {verb}, the best bit’s next',
  'Keep {verb}, we’ve got answers',
];

export const FAQS = [
  { q: 'Do my guests need to download anything?', a: 'No. On a recent iPhone the QR code opens Stills as an App Clip, with nothing to install. On other phones it opens in the browser. Guests type their name and start shooting, with no account and no password.' },
  { q: 'What do I need to create an event?', a: 'The Stills app for iPhone, which is free to download. An Android app is coming soon.' },
  {
    q: 'How much does it cost?',
    a: 'Free for up to 5 guests. Bigger events are a one-off payment from $14.99 per event, with no subscription. Stills+ is $49.99 for unlimited guests, and adds videos, challenges and the guestbook. All currencies are supported. For the exact price where you are,',
    link: { label: 'download the app', href: LINKS.appStore },
  },
  { q: 'When do guests see the photos?', a: 'You choose. Share every photo live as it’s taken, or keep them locked until the event closes or until a day and time you pick. Then they reveal themselves.' },
  { q: 'Can guests leave audio and video messages?', a: 'Yes, with Stills+. Guests record a message for your guestbook, out loud or on camera. Only you get to hear it.' },
  { q: 'Can Stills really replace my seating chart?', a: 'It can. Seating comes with every plan. Guests type their name to find their table, and if you add a floor plan as a PNG, JPEG or PDF, they can zoom in to find it.' },
  { q: 'Can I download everything afterwards?', a: 'Yes. Every photo and video is yours to keep, and you can save any of them to your phone straight from the app.' },
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
  /** The setting behind the phone. Weddings have the terrace itself. */
  art: string | null;
  tint: string;
  event: { title: string; photos: string; joined: string; last: [string, string] };
  /** The icons on its challenge strip, from that kind of party's pack in `challenge-packs.ts`. */
  challenges: string[];
  photos: string[];
  /** The cover, blurred, for behind the glass. */
  blurred?: string;
  /** The name tag on each photo in the grid. */
  by?: string[];
}[] = [
  {
    id: 'wedding', tab: 'Weddings', title: 'Weddings.', line: 'Every table, every tear, every angle.', art: null, tint: '#5a21a8',
    event: { title: DEMO_EVENT.title, photos: '1,284', joined: '86', last: ['2', 'Hours left'] },
    photos: [raw('p13'), print('p05', true), print('p07', true)],
    blurred: blurredRaw('p13'),
    by: ['Priya', 'Tom'],
    challenges: ['👀', '🥹', '💃', '🔍', '🎬'],
  },
  {
    id: 'birthday', tab: 'Birthdays', title: 'Birthdays.', line: 'The surprise face. From every angle.', art: 'setting-birthday', tint: '#b5249f',
    event: { title: 'Maya’s surprise 40th', photos: '286', joined: '22', last: ['1', 'Day ago'] },
    photos: [`${ASSET}/usecase/birthday-1.webp`, `${ASSET}/usecase/birthday-2.webp`, `${ASSET}/usecase/birthday-3.webp`],
    blurred: `${ASSET}/usecase/birthday-1-b.webp`,
    by: ['Sam', 'Nina'],
    challenges: ['🥳', '🕯️', '🤗', '😲', '🎈'],
  },
  {
    id: 'bach', tab: 'Bach parties', title: 'Bachelor and bachelorette parties.', line: 'What happens on the trip stays in the gallery.', art: 'setting-bach', tint: '#2860c8',
    event: { title: 'Jess’s Last Weekend', photos: '214', joined: '8', last: ['3', 'Days ago'] },
    photos: [`${ASSET}/usecase/bach-1.webp`, `${ASSET}/usecase/bach-2.webp`, `${ASSET}/usecase/bach-3.webp`],
    blurred: `${ASSET}/usecase/bach-1-b.webp`,
    by: ['Holly', 'Mia'],
    challenges: ['✨', '🥂', '👗', '😂', '🌅'],
  },
  {
    id: 'trip', tab: 'Holidays', title: 'Holidays and group trips.', line: 'You shot the sunset. They shot you asleep on the beach.', art: 'setting-trip', tint: '#f67b3d',
    event: { title: 'Lisbon, All of Us', photos: '337', joined: '9', last: ['5', 'Days ago'] },
    photos: [`${ASSET}/usecase/trip-1.webp`, `${ASSET}/usecase/trip-2.webp`, `${ASSET}/usecase/trip-3.webp`],
    blurred: `${ASSET}/usecase/trip-1-b.webp`,
    by: ['Ana', 'Joe'],
    challenges: ['🛬', '🏞️', '🗺️', '🌀', '💛'],
  },
];
export const USE_CASES_ALSO = 'Plus engagements, anniversaries, graduations, baby showers, housewarmings and Christmas parties. There’s a challenge pack for each.';

/** Beside a moment in the room, like someone pointing it out at the party. */
/**
 * The photos swirling round the phone before they settle into the album. Parked for now:
 * the album's locked slots reveal themselves instead. Turn it back on here, and move the
 * cell reveal out of the way in `choreography.ts`.
 */
export const SWIRL = false;

/** What's in the album on the phone, in grid order. */
export const GALLERY = ['p05', 'p07', 'p08', 'p01', 'p06', 'p03', 'p02', 'p04', 'p12', 'p14', 'p10', 'p11'];
/** The name tag on each of those photos. */
export const GALLERY_BY = ['Priya', 'Tom', 'Ayla', 'Uncle Raj', 'Sofia', 'Ben', 'Nana', 'Leo', 'Ayla', 'Grace', 'Tom', 'Priya'];
