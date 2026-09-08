import { Image } from 'react-native';

/**
 * The example album.
 *
 * A finished wedding a new host can open before they have made anything of
 * their own — the fastest way to answer "what does this actually give me?"
 * without a tour, a video or a tutorial screen.
 *
 * ── Why this is a constant and not seeded rows ──
 *
 * Everything the product promises about it — always present, identical for
 * everyone, impossible to delete, free of storage and guest limits, unchanged
 * across sign-out — is true by construction here and would have to be
 * separately enforced if it lived in `celebrations`. Seeded rows would also
 * need creating for every new account, would count against quotas, and would
 * be one `delete` away from a host losing the only example they had.
 *
 * The cost is that its media are bundled assets rather than storage paths, so
 * anything resolving a signed URL has to tolerate a local `require()`. That is
 * `resolveSampleMedia`'s job, and it is the only seam this feature adds.
 *
 * ── Removing it ──
 *
 * Delete this module and the four `isSampleCelebrationId` call sites it
 * exports for. Nothing else knows the example exists.
 */

/**
 * The id every surface recognises.
 *
 * Deliberately not a UUID: a real celebration id can never collide with it,
 * and it is obvious in a log or a route that this is the example.
 */
export const SAMPLE_CELEBRATION_ID = 'sample-amelia-and-james';

export function isSampleCelebrationId(id: string | null | undefined): boolean {
  return id === SAMPLE_CELEBRATION_ID;
}

/** Shown in the album card's top corner. */
export const SAMPLE_EVENT_LABEL = 'Sample album';

/**
 * When the sample reception happened.
 *
 * Always a month ago, rather than a fixed date. A hard-coded date is right
 * for exactly as long as it takes to age: "June 2026" reads as a real recent
 * wedding this year and as an abandoned demo two years from now. Rolling it
 * keeps the album feeling like something that just happened, forever, with
 * nothing to maintain.
 *
 * Computed per call rather than at module load so a long-running app does not
 * hold on to the date it started with.
 */
export function sampleEventEndsAt(now: Date = new Date()): string {
  const ended = new Date(now);
  ended.setMonth(ended.getMonth() - 1);
  return ended.toISOString();
}

/**
 * Guests joined.
 *
 * Fixed sample metadata — a small reception's worth. The photo count is NOT
 * fixed: it is derived from `SAMPLE_PHOTOS` below, so the gallery can never
 * claim more moments than it can show.
 */
export const SAMPLE_GUESTS_JOINED = 30;

export interface SampleMedia {
  id: string;
  /** A bundled asset, resolved by `require`. Never a storage path. */
  source: number;
  /** Who the gallery credits. Guest names, because guests took these. */
  displayName: string;
  /**
   * Minutes past 15:00 on the day of the reception.
   *
   * Stored as an offset rather than a timestamp because the event date rolls
   * — see `sampleEventEndsAt`. A fixed `capturedAt` would have the gallery
   * claiming photos were taken months before the album says the wedding was.
   */
  minutesIntoDay: number;
  /** Set where a photo genuinely answers a challenge. */
  challengeId?: string;
}

export const SAMPLE_CHALLENGE_IDS = {
  danceFloor: 'sample-challenge-dance-floor',
  happyTears: 'sample-challenge-happy-tears',
  tinyGuest: 'sample-challenge-tiny-guest',
  bestDressed: 'sample-challenge-best-dressed',
  unexpectedStar: 'sample-challenge-unexpected-star',
} as const;

/**
 * The reception, in the order it happened.
 *
 * Sequenced by the light in each frame rather than by category: afternoon sun
 * on the flagstones, then low gold across the grass, then candles, then the
 * dark and the string lights. A gallery that jumps between noon and midnight
 * reads as a folder; this reads as an evening.
 *
 * The count here IS the count shown in the UI. Adding a photo adds one to the
 * gallery and nowhere else needs telling.
 */
export const SAMPLE_PHOTOS: readonly SampleMedia[] = [
  {
    id: 'sample-photo-1',
    source: require('../../../assets/sample-event/01.jpg'),
    displayName: 'Rosie',
    minutesIntoDay: 40,
    challengeId: SAMPLE_CHALLENGE_IDS.unexpectedStar,
  },
  {
    id: 'sample-photo-2',
    source: require('../../../assets/sample-event/02.jpg'),
    displayName: 'Tom',
    minutesIntoDay: 125,
    challengeId: SAMPLE_CHALLENGE_IDS.tinyGuest,
  },
  {
    id: 'sample-photo-3',
    source: require('../../../assets/sample-event/03.jpg'),
    displayName: 'Priya',
    minutesIntoDay: 315,
    challengeId: SAMPLE_CHALLENGE_IDS.happyTears,
  },
  {
    id: 'sample-photo-4',
    source: require('../../../assets/sample-event/04.jpg'),
    displayName: 'Dan',
    minutesIntoDay: 332,
  },
  {
    id: 'sample-photo-5',
    source: require('../../../assets/sample-event/05.jpg'),
    displayName: 'Priya',
    minutesIntoDay: 408,
  },
  {
    id: 'sample-photo-6',
    source: require('../../../assets/sample-event/06.jpg'),
    displayName: 'Marcus',
    minutesIntoDay: 440,
    challengeId: SAMPLE_CHALLENGE_IDS.danceFloor,
  },
  {
    id: 'sample-photo-7',
    source: require('../../../assets/sample-event/07.jpg'),
    displayName: 'Ellie',
    minutesIntoDay: 485,
  },
] as const;

export const SAMPLE_COVER = require('../../../assets/sample-event/cover.jpg');

export interface SampleChallenge {
  id: string;
  label: string;
  instructions: string;
  /** Emoji, matching how challenges are stored everywhere else. */
  icon: string;
  isPinned: boolean;
}

/**
 * Five challenges, in the order a host would have written them.
 *
 * Two are pinned — the two most people would recognise from a wedding they
 * have actually been to.
 */
export const SAMPLE_CHALLENGES: readonly SampleChallenge[] = [
  {
    id: SAMPLE_CHALLENGE_IDS.danceFloor,
    label: 'Dance Floor Hero',
    instructions: 'Catch the guest absolutely owning the dance floor.',
    icon: '💃',
    isPinned: true,
  },
  {
    id: SAMPLE_CHALLENGE_IDS.happyTears,
    label: 'Happy Tears',
    instructions: 'Capture a moment that gets someone emotional.',
    icon: '🥹',
    isPinned: true,
  },
  {
    id: SAMPLE_CHALLENGE_IDS.tinyGuest,
    label: 'Tiny Guest, Big Energy',
    instructions: 'Catch the kids having more fun than the adults.',
    icon: '✨',
    isPinned: false,
  },
  {
    id: SAMPLE_CHALLENGE_IDS.bestDressed,
    label: 'Best Dressed',
    instructions: 'Spot a guest whose outfit deserves its own moment.',
    icon: '👗',
    isPinned: false,
  },
  {
    id: SAMPLE_CHALLENGE_IDS.unexpectedStar,
    label: 'Unexpected Star',
    instructions: 'Find the person — or pet — accidentally stealing the show.',
    icon: '🐾',
    isPinned: false,
  },
] as const;

export const SAMPLE_EVENT = {
  id: SAMPLE_CELEBRATION_ID,
  title: 'Amelia & James',
  celebrationType: 'wedding' as const,
  /** See `sampleEventEndsAt` — always a month ago. */
  get endsAt() {
    return sampleEventEndsAt();
  },
  timezone: 'Europe/London',
  guestsJoined: SAMPLE_GUESTS_JOINED,
  photos: SAMPLE_PHOTOS,
  challenges: SAMPLE_CHALLENGES,
  cover: SAMPLE_COVER,
} as const;

/**
 * A bundled asset as a URI the gallery can treat like any other.
 *
 * The alternative — teaching `PhotoItem` to carry either a URL or a
 * `require()` handle — would have pushed a union into every component that
 * renders a photo. Resolving here keeps `uri: string` true everywhere, so the
 * grid, the viewer, the share sheet and the disposable treatment need to know
 * nothing about the example album.
 *
 * Works in both environments: Metro serves an http URL in development, and
 * the packaged app resolves to a local asset path.
 */
/** A photo's timestamp on the rolling event date. */
export function sampleCapturedAt(photo: SampleMedia, now: Date = new Date()): string {
  const day = new Date(sampleEventEndsAt(now));
  day.setHours(15, 0, 0, 0);
  return new Date(day.getTime() + photo.minutesIntoDay * 60_000).toISOString();
}

export function sampleAssetUri(source: number): string {
  return Image.resolveAssetSource(source).uri;
}
