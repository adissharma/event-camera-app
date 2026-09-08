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

/** Shown on the album card, beneath the title. */
export const SAMPLE_EVENT_LABEL = 'Example album';

/** One quiet line inside the event itself. Nothing more. */
export const SAMPLE_EVENT_NOTE = 'An example of a finished Stills album';

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
  /** Drives the "captured at" ordering and any time display. */
  capturedAt: string;
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
    capturedAt: '2026-06-13T15:40:00.000Z',
    challengeId: SAMPLE_CHALLENGE_IDS.unexpectedStar,
  },
  {
    id: 'sample-photo-2',
    source: require('../../../assets/sample-event/02.jpg'),
    displayName: 'Tom',
    capturedAt: '2026-06-13T17:05:00.000Z',
    challengeId: SAMPLE_CHALLENGE_IDS.tinyGuest,
  },
  {
    id: 'sample-photo-3',
    source: require('../../../assets/sample-event/03.jpg'),
    displayName: 'Priya',
    capturedAt: '2026-06-13T20:15:00.000Z',
    challengeId: SAMPLE_CHALLENGE_IDS.happyTears,
  },
  {
    id: 'sample-photo-4',
    source: require('../../../assets/sample-event/04.jpg'),
    displayName: 'Dan',
    capturedAt: '2026-06-13T20:32:00.000Z',
  },
  {
    id: 'sample-photo-5',
    source: require('../../../assets/sample-event/05.jpg'),
    displayName: 'Priya',
    capturedAt: '2026-06-13T21:48:00.000Z',
  },
  {
    id: 'sample-photo-6',
    source: require('../../../assets/sample-event/06.jpg'),
    displayName: 'Marcus',
    capturedAt: '2026-06-13T22:20:00.000Z',
    challengeId: SAMPLE_CHALLENGE_IDS.danceFloor,
  },
  {
    id: 'sample-photo-7',
    source: require('../../../assets/sample-event/07.jpg'),
    displayName: 'Ellie',
    capturedAt: '2026-06-13T23:05:00.000Z',
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
  /**
   * In the past, so it sorts and renders as a finished album rather than an
   * event still collecting photos. Fixed rather than relative: a date that
   * drifts with the clock is a date that eventually reads oddly.
   */
  endsAt: '2026-06-13T23:59:00.000Z',
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
export function sampleAssetUri(source: number): string {
  return Image.resolveAssetSource(source).uri;
}
