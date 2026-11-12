import type { CreationStep } from '../draft/types';

/**
 * What the info button on each creation step says.
 *
 * Kept deliberately short: a title and at most two plain sentences. A step
 * with no entry gets no info button — some steps explain themselves. Claims
 * here are product facts, so check them against the code before changing
 * them, as the homepage's copy is (docs/story-site/07-storyline-and-copy.md).
 */
export interface StepInfo {
  title: string;
  lines: string[];
}

export const STEP_INFO: Partial<Record<CreationStep, StepInfo>> = {
  closing: {
    title: 'When it ends',
    lines: [
      'Guests can take photos right up until this day.',
      'Pick the day after if your party runs past midnight.',
    ],
  },
  'closing-time': {
    title: 'The closing time',
    lines: ['At this exact time, guests can’t take any more photos.'],
  },
  cover: {
    title: 'Your cover',
    lines: [
      'It’s the welcome screen guests see when they join.',
      'A photo of the two of you, the venue or the invite works well.',
    ],
  },
  'photo-limit': {
    title: 'Photos per guest',
    lines: [
      'Each guest can take this many photos, like a disposable camera.',
      'Choose unlimited and they can shoot as much as they like.',
    ],
  },
  reveal: {
    title: 'When you see the photos',
    lines: [
      'See them as they come in, when the event ends, or on a day you pick.',
      'Waiting builds anticipation, like getting film developed.',
    ],
  },
  'guest-reveal': {
    title: 'When guests see the photos',
    lines: [
      'This is separate from when you see them.',
      'Choose “only you” and every shot is a private gift.',
    ],
  },
  treatment: {
    title: 'The look',
    lines: ['Every photo at your event gets this look, so the album feels like one roll of film.'],
  },
};
