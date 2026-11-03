/**
 * Everything the story says and shows, in one place.
 *
 * The demo event values are the same across every phone screen, and they are
 * illustrative: no real event sits behind them.
 */

export const DEMO_EVENT = {
  title: 'Olivia & Daniel’s Wedding',
  timeLeft: '2d 4h',
  shots: 20,
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

export const art = (name: string, state: 'neg' | 'pos') => `${ASSET}/art/${name}.${state}.webp`;
export const print = (id: string, small = false) => `${ASSET}/photo/print-${id}${small ? '-s' : ''}.webp`;
export const raw = (id: string) => `${ASSET}/photo/raw-${id}.webp`;

/** Each scene's copy. One heading and at most a line or two, read in DOM order. */
export const CHAPTERS = {
  s1: { id: 's1', label: 'The room', title: 'Every great event has a thousand stories.', alt: 'A drawing of a wedding reception at night: guests laughing, hugging and dancing all over a dark courtyard under strings of lights.' },
  s1b: { title: 'One photographer can only be in one place.', body: 'The rest happens in the dark.', alt: 'One pool of light at the head table, where a photographer is shooting the couple. The rest of the room stays dark.' },
  s2: { id: 's2', label: 'Join', eyebrow: 'Getting in', title: 'One scan. You’re in.', body: 'No app. No account. Point a phone at the QR code on the invitation.', alt: 'A phone scanning the QR code on a paper invitation, then opening the Stills join screen for Olivia and Daniel’s wedding.' },
  s3: { id: 's3', label: 'Your seat', eyebrow: 'If your host adds a seating plan', title: 'Find your seat. Join the fun.', body: 'Type your name and Stills shows you your table.', alt: 'The Find your table screen showing Ayla seated at Table 7, with a gold line leading from the phone to Table 7 in the room.' },
  s4: { id: 's4', label: 'Everyone', eyebrow: 'Then the fun starts', title: 'Now everyone has a camera.', body: 'The best moments happen everywhere.', alt: 'Guests around the room taking photos on their phones. Each flash lights up a corner of the room, and a real photograph appears above it.' },
  s5: { id: 's5', label: 'The camera', eyebrow: 'The camera', title: 'Less posing. More living.', body: 'A set number of shots. Direct flash, a little grain and a printed date stamp, if your host picks the Disposable look.', alt: 'The Stills camera screen on a phone. The shutter fires, the counter drops from 20 to 17, and three prints with orange date stamps come out.' },
  s6: { id: 's6', label: 'Together', title: 'Everyone sees something different.', alt: 'Dozens of photographs swirling together while the whole room lights up.' },
  s6b: { title: 'Together, you get the whole story.', alt: 'The photographs settled into a neat grid inside the phone.' },
  s7: { id: 's7', label: 'The album', eyebrow: 'The album', title: 'The moments you missed.\nThe memories you’ll keep.', body: 'Every guest’s photos in one shared gallery. You choose when it opens.', alt: 'The shared event gallery on a phone, with photographs lifting out of the grid.' },
  s8: { id: 's8', label: 'Get Stills', title: 'Every moment deserves a place.', body: 'Create a shared camera for your next wedding, party or celebration.', alt: 'The same reception, now fully lit, with all the guests and their photographs.' },
};

/** Beside a moment in the room, like someone pointing it out at the party. */
export const NOTES = {
  waiter: 'Eleven glasses. Nobody asked for eleven.',
  dad: 'He’s been waiting for this song since 1987.',
  hug: 'Nobody told them to hold it.',
  table7: 'Table 7. Next to the fun aunt.',
};

/** Notes for the photos that lift out of the gallery. */
export const MEMORIES = [
  { photo: 'p04', note: 'Table 4, all through the speeches.' },
  { photo: 'p06', note: 'You were at the bar for this one.' },
  { photo: 'p01', note: 'Best guest of the night.' },
];

/** What's in the album on the phone, in grid order. */
export const GALLERY = ['p08', 'p07', 'p05', 'p01', 'p06', 'p03', 'p02', 'p04', 'p12', 'p14', 'p10', 'p11'];
