import type { CelebrationType } from '@/types/database';

/**
 * Content and state for the creation reveal's sneak preview.
 *
 * Everything here is presentation-only. The preview shows the host what their
 * event *will* look like before they have paid for it, at a point in the flow
 * where no event record exists yet — `publishDraft` does not run until the
 * host taps Continue. So there is nothing real to render, and this module
 * supplies the stand-ins.
 *
 * The hard rule is that none of it may reach the database. These photographs
 * are bundled assets, not media rows; these challenges are strings, not
 * `event_challenges`. The preview renders them directly from here and never
 * hands them to a service, which is what keeps "demo data is not persisted"
 * true by construction rather than by remembering to clean up afterwards.
 */

export interface PreviewChallenge {
  id: string;
  label: string;
  /** Shown nowhere in the preview; carried so the tiles read as real briefs. */
  instructions: string;
  /** OpenMoji hexcode, resolved by `ChallengeIconSVG` exactly as a real one is. */
  icon: string;
}

/**
 * Five challenges chosen to apply to any social event.
 *
 * Deliberately generic: the preview appears before the host has configured
 * challenges of their own, so anything venue- or tradition-specific would
 * read as the app having guessed wrong about their event.
 */
export const PREVIEW_CHALLENGES: readonly PreviewChallenge[] = [
  {
    id: 'preview-group',
    label: 'Best group photo',
    instructions: 'Get as many people in one shot as you can.',
    icon: '1F465',
  },
  {
    id: 'preview-off-guard',
    label: 'Caught off guard',
    instructions: 'Capture someone when they least expect it.',
    icon: '1F440',
  },
  {
    id: 'preview-main-character',
    label: 'Main character moment',
    instructions: 'Find someone having their main-character moment.',
    icon: '1F31F',
  },
  {
    id: 'preview-funniest',
    label: 'Funniest photo',
    instructions: 'Capture the moment that makes everyone laugh.',
    icon: '1F602',
  },
  {
    id: 'preview-recreate',
    label: 'Recreate this',
    instructions: 'Recreate an old photo, pose or iconic moment together.',
    icon: '1F5BC',
  },
] as const;

/**
 * Stand-in gallery media.
 *
 * These are `GALLERY_PRESETS` ids for the fixed two-photo pair used in the
 * creation treatment collage. The event screen resolves them to those bundled
 * sources, then uses the collage's rendering path in preview mode. This keeps
 * Original, Disposable and Monochrome on identical crops rather than letting
 * their separate gallery renderers choose different source geometry.
 *
 * Bundled assets, so the reveal never waits on the network. An image that
 * arrived late would appear after the paywall had already taken over.
 */
const PREVIEW_CONTRIBUTORS = [
  'Sophia',
  'Arjun',
  'Liam',
  'Olivia',
  'Noah',
  'Priya',
  'Ella',
  'Marcus',
  'Zara',
  'Daniel',
  'Iris',
  'Theo',
];

/**
 * Twelve tiles repeating the same two photographs.
 *
 * The event screen counts what it is given — its "Moments" figure is
 * `photos.length`, not a number handed to it — so a four-photo preview
 * honestly reports a four-photo event, and a grid two tiles wide showing two
 * rows reads as an event nobody came to. Cycling the two bundled assets
 * across twelve contributors fills the fold and makes the count plausible,
 * without pretending to media that does not exist.
 */
/** Which of the twelve are videos. Spread out, not clustered at the end. */
const PREVIEW_VIDEO_INDICES = new Set([2, 6, 10]);
const PREVIEW_VIDEO_DURATIONS_MS = [7_400, 12_100, 4_800];

function buildPreviewPhotos(order: readonly string[]): PreviewPhoto[] {
  let videoCount = 0;
  return PREVIEW_CONTRIBUTORS.map((takenBy, index) => {
    const isVideo = PREVIEW_VIDEO_INDICES.has(index);
    const photo: PreviewPhoto = { uri: order[index % order.length]!, takenBy };
    if (!isVideo) return photo;
    photo.mediaType = 'video';
    photo.durationMs = PREVIEW_VIDEO_DURATIONS_MS[videoCount++ % PREVIEW_VIDEO_DURATIONS_MS.length];
    return photo;
  });
}

const PREVIEW_MEDIA_ORDER = ['preset_1', 'preset_2'] as const;
const PREVIEW_MEDIA = buildPreviewPhotos(PREVIEW_MEDIA_ORDER);

export interface PreviewPhoto {
  uri: string;
  takenBy: string;
  /**
   * Videos exist in the preview for one reason: the event screen shows its
   * Photos/Videos tabs only when the gallery holds both kinds, and the preview
   * is supposed to be that screen, tab bar included. They are never rendered —
   * the Photos tab is the one on screen — so a bundled still under a duration
   * is all the tab bar needs to justify itself.
   */
  mediaType?: 'photo' | 'video';
  durationMs?: number;
}

/**
 * The same pair is used for every event type, so the pre-paywall gallery is a
 * direct continuation of the two photos the host just saw on the treatment
 * step.
 */
export function previewMediaFor(_type: CelebrationType | null | undefined): PreviewPhoto[] {
  return PREVIEW_MEDIA;
}

/**
 * Whether this creation session has already played the reveal.
 *
 * Module-scoped and deliberately not persisted. The reveal celebrates having
 * just finished building an event; a host who backs out of the paywall and
 * returns a minute later is mid-decision, not mid-celebration, and replaying
 * a five-second animation at them is an obstacle. Equally, a host who comes
 * back tomorrow to a restored draft *is* arriving fresh, so letting the flag
 * die with the process is the behaviour we want rather than a limitation.
 *
 * Keyed by the draft's `createdAt` so that starting a second event in the same
 * session gets its own reveal.
 */
const shown = new Set<string>();

export function hasShownPricingReveal(draftKey: string | null | undefined): boolean {
  return draftKey ? shown.has(draftKey) : false;
}

export function markPricingRevealShown(draftKey: string | null | undefined): void {
  if (draftKey) shown.add(draftKey);
}

/** Test seam, and the reset a fresh creation flow performs. */
export function clearPricingRevealHistory(): void {
  shown.clear();
}
