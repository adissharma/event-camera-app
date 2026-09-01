import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The first-launch brand intro: its script, its clock, and whether it has run.
 *
 * Kept apart from the screen so the words can be read and revised without
 * scrolling past animation code, and so the timings sit in one table rather
 * than as literals scattered through effects.
 */

/**
 * Device-local, and deliberately not tied to the account.
 *
 * Reusing the shape of `__seen_challenge_packs_intro` rather than inventing a
 * second first-run mechanism: same prefix, same string sentinel, same
 * swallow-and-continue error handling. Signing out, or signing in as someone
 * else, must not replay the intro at a device that has already watched it.
 */
const SEEN_KEY = '__seen_still_intro';

/**
 * REVIEW SWITCH — set to `false` before this ships.
 *
 * The intro is a once-per-device moment, which makes it almost impossible to
 * look at twice: seeing it again otherwise means clearing app storage between
 * every run. This bypasses the check so it plays on every launch.
 *
 * Only the *reading* of the flag is bypassed. `markStillIntroSeen` still
 * writes it on completion, so the real path stays exercised and flipping this
 * one constant restores the shipping behaviour with nothing else to undo.
 */
export const REPLAY_INTRO_EVERY_LAUNCH = true;

export async function hasSeenStillIntro(): Promise<boolean> {
  if (REPLAY_INTRO_EVERY_LAUNCH) return false;
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === '1';
  } catch {
    // Storage unavailable: show the intro. Once too many is a worse outcome
    // than never, but only slightly — and the reverse is unrecoverable.
    return false;
  }
}

export async function markStillIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Non-fatal: worst case it plays once more.
  }
}

/** Test seam, and the reset for anyone re-reviewing the sequence. */
export async function clearStillIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEEN_KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * The poem, as three slides.
 *
 * A slide is a complete thought. The first accumulates a line at a time so the
 * reader is never handed more than one sentence at once; the second is a
 * single line that has earned a screen of its own; the third is the brand
 * statement. Each clears before the next arrives.
 */

/**
 * The opening slide, as paragraphs of lines.
 *
 * The nesting is the spacing: lines inside a group sit tight because they are
 * one sentence continuing, and the gap between groups is the pause between
 * thoughts. Each line is revealed on its own, so the grouping is about where
 * the eye rests, not about what arrives when.
 */
export const SLIDE_ONE_GROUPS: readonly (readonly string[])[] = [
  ['Some moments make time stand still.', 'And in that stillness, life feels wonderfully full.'],
  ['Yet every eye sees something different.', 'Together, they make the moment whole.'],
] as const;

/** Flattened, because the reveals are numbered across the whole slide. */
export const SLIDE_ONE_LINES = SLIDE_ONE_GROUPS.flat();

/** The promise, alone on a slide because it is the turn the poem is built on. */
export const SLIDE_TWO_LINE = 'We hope Still can keep it close to you';

/** The nudge that says the reader can move on rather than wait. */
export const CONTINUE_HINT = 'Tap to continue';

/** The one word the closing slide is built on. It arrives once and stays. */
export const CLOSING_MARK = 'Still';

/**
 * The comma, which belongs to the name rather than to the sentence.
 *
 * It arrives with the word and stays put while the endings change behind it,
 * so what fades is only ever words. A comma blinking in and out three times
 * draws the eye to punctuation, which is the last thing that should be moving
 * on this slide.
 *
 * Kept out of `CLOSING_MARK` because that word is also the logo, and the logo
 * is "Stills." — not "Still,s.".
 */
export const CLOSING_COMMA = ',';

/**
 * What follows it — three endings to the same sentence, on one line.
 *
 * The name is not repeated. It fades in once and then holds while these take
 * turns after it, so the repetition is something the reader watches happen to
 * a word that is already there rather than something they are shown three
 * times. It is also what makes the zoom that follows feel inevitable: by then
 * "Still" has been fixed in that spot for ten seconds and only the sentence
 * around it has been moving.
 */
export const CLOSING_TAILS: readonly string[] = [
  ' just as it happened.',
  ' from every point of view.',
  ' with you forever.',
] as const;

/**
 * The line that becomes the wordmark.
 *
 * `stop` is what the sentence's "Still" grows into once it has stopped moving:
 * the trailing "s." that turns the word into the name. It is not part of the
 * sentence — that already ends after "forever" — so it stays invisible until
 * the logo exists, and the statements above read "Still, …" throughout.
 */
export const FINAL_LINE = { mark: CLOSING_MARK, stop: 's.' } as const;

/**
 * The wordmark, whole.
 *
 * Exported so the dashboard header and the intro's logo cannot drift: they are
 * the same name and there is one string for it.
 */
export const WORDMARK = `${FINAL_LINE.mark}${FINAL_LINE.stop}`;

export type RevealPart = 'line' | 'mark' | 'tail';

export interface Reveal {
  slide: 1 | 2 | 3;
  part: RevealPart;
  /** Which of `CLOSING_TAILS`, for the closing slide's tail reveals. */
  tail?: 0 | 1 | 2;
  /** How long this holds before the next arrives on its own. */
  hold: number;
}

/**
 * Every reveal in order, so the screen holds one index rather than a slide
 * number and an offset within it.
 *
 * The holds are uneven on purpose. A line needs reading time; the tail of a
 * statement needs only to land after its own name, which is why those sit at a
 * few hundred milliseconds — long enough to read as two events, short enough
 * that they still read as one sentence.
 */
export const REVEALS: readonly Reveal[] = [
  { slide: 1, part: 'line', hold: 2000 },
  { slide: 1, part: 'line', hold: 2000 },
  { slide: 1, part: 'line', hold: 2000 },
  { slide: 1, part: 'line', hold: 2000 },

  // Alone on its slide, so it holds a beat longer than a line among others.
  { slide: 2, part: 'line', hold: 2600 },

  // The name, alone, before anything follows it.
  { slide: 3, part: 'mark', hold: 700 },
  // Each ending replaces the last: the one before fades out, then this fades
  // in. A crossfade would smear two different sentences over each other, since
  // they start at the same point and run to different lengths.
  { slide: 3, part: 'tail', tail: 0, hold: 2200 },
  { slide: 3, part: 'tail', tail: 1, hold: 2200 },
  // The last one holds a little longer — it is the line the logo comes out of.
  { slide: 3, part: 'tail', tail: 2, hold: 2400 },
] as const;

export const REVEAL_COUNT = REVEALS.length;
export const FINAL_STEP = REVEAL_COUNT - 1;

/** The first step belonging to each slide — i.e. where the one before it leaves. */
export const SLIDE_TWO_START = REVEALS.findIndex((reveal) => reveal.slide === 2);
export const SLIDE_THREE_START = REVEALS.findIndex((reveal) => reveal.slide === 3);

/**
 * Where each slide starts and how many reveals it owns.
 *
 * Derived from the table rather than counted by hand, so adding a line moves
 * its progress bar and its hand-over point with it — the two things most
 * likely to be forgotten, and least likely to be noticed when they are.
 */
export const SLIDE_RANGES = ([1, 2, 3] as const).map((slide) => ({
  slide,
  first: REVEALS.findIndex((reveal) => reveal.slide === slide),
  count: REVEALS.filter((reveal) => reveal.slide === slide).length,
}));

export const INTRO_TIMINGS = {
  /** A paragraph arriving. Slower than a UI fade — this is a title. */
  REVEAL_FADE_IN: 700,
  /**
   * Half a statement arriving.
   *
   * Faster, because the two halves are one sentence: at the paragraph's pace
   * the name would finish fading in, sit alone, and then be joined — three
   * events where the writing wants one continuous construction.
   */
  PART_FADE_IN: 420,
  /** One ending leaving before the next arrives. */
  TAIL_SWAP_OUT: 320,
  /** A slide clearing to make room for the next. */
  SLIDE_FADE_OUT: 600,
  /**
   * How far into that clearing the next slide's first reveal begins.
   *
   * Overlapped rather than sequential: a fully black gap between slides reads
   * as the app having stopped.
   */
  SLIDE_OVERLAP: 350,

  /**
   * Taps closer together than this are one tap.
   *
   * The whole screen is the control, so a thumb resting after a deliberate tap
   * registers a second one easily — and a skipped reveal here can mean half a
   * statement, which reads as a typo rather than as a skip.
   */
  TAP_DEBOUNCE: 480,

  /**
   * The sentence becoming the wordmark. One duration for the movement and the
   * fade both, because they are one animation.
   */
  MORPH_DURATION: 1400,
  /**
   * Where in that animation the trailing words have finished disappearing.
   *
   * Earlier than the movement finishes, and deliberately so: the line is
   * growing, so its tail is travelling toward the edge of the screen. Gone by
   * three fifths, it never reaches the edge to be cut off by it — the words
   * fade rather than run out of room.
   */
  TAIL_FADE_UNTIL: 0.6,
  /**
   * How much of the morph the rest of the screen takes to clear.
   *
   * Inside the morph, not before it. The lines above have to be leaving while
   * the last one is rising through where they were, or the screen empties and
   * then something moves — two events where the sequence needs one.
   */
  REST_FADE_UNTIL: 0.45,

  /**
   * The wordmark's own full stop, arriving once it has stopped moving.
   *
   * Runs inside the settle pause rather than after it, so the beat before the
   * login controls stays the length it was — the punctuation lands during the
   * silence instead of extending it.
   */
  STOP_FADE_IN: 450,

  /** The wordmark alone, before the screen becomes a login screen. */
  SETTLE_PAUSE: 620,
  CONTROLS_FADE_IN: 900,
} as const;
