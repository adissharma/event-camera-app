const CENTRE_X = 100;
const CENTRE_Y = 96;
const RADIUS = 56;

/**
 * Every object is a surface of revolution, described by the same nine points
 * from top to bottom: `[height, half-width]`, as fractions of the radius. That
 * is what lets one set of mirrors become each of them while still spinning: only
 * these numbers change, and they can be blended point by point.
 */
const DISCO_BALL = [
  [-0.97, 0.24],
  [-0.84, 0.54],
  [-0.62, 0.79],
  [-0.33, 0.95],
  [0, 1],
  [0.33, 0.95],
  [0.62, 0.79],
  [0.84, 0.54],
  [0.97, 0.24],
];
const CHAMPAGNE_GLASS = [
  [-1, 0.4],
  [-0.75, 0.42],
  [-0.5, 0.4],
  [-0.25, 0.33],
  [0, 0.16],
  [0.06, 0.05],
  [0.45, 0.05],
  [0.86, 0.05],
  [1, 0.46],
];
const WEDDING_CAKE = [
  [-0.95, 0.3],
  [-0.72, 0.3],
  [-0.5, 0.3],
  [-0.5, 0.62],
  [-0.27, 0.62],
  [-0.05, 0.62],
  [-0.05, 0.92],
  [0.42, 0.92],
  [0.9, 0.92],
];
const WEDDING_BELL = [
  [-1, 0.1],
  [-0.8, 0.28],
  [-0.52, 0.4],
  [-0.22, 0.44],
  [0.1, 0.5],
  [0.4, 0.68],
  [0.7, 1],
  [0.7, 0.16],
  [0.95, 0.16],
];
const PARTY_HAT = [
  [-1, 0.13],
  [-0.84, 0.13],
  [-0.84, 0.05],
  [-0.5, 0.22],
  [-0.2, 0.37],
  [0.1, 0.52],
  [0.4, 0.67],
  [0.7, 0.82],
  [0.95, 0.95],
];
const BALLOON = [
  [-0.98, 0.28],
  [-0.84, 0.58],
  [-0.58, 0.78],
  [-0.25, 0.84],
  [0.1, 0.74],
  [0.4, 0.48],
  [0.62, 0.14],
  [0.7, 0.06],
  [0.84, 0.2],
];
const COCKTAIL_GLASS = [
  [-1, 0.8],
  [-0.8, 0.63],
  [-0.6, 0.46],
  [-0.4, 0.29],
  [-0.2, 0.12],
  [-0.1, 0.05],
  [0.4, 0.05],
  [0.86, 0.05],
  [1, 0.5],
];
const TROPHY = [
  [-1, 0.62],
  [-0.66, 0.6],
  [-0.36, 0.5],
  [-0.12, 0.3],
  [0.08, 0.08],
  [0.42, 0.08],
  [0.66, 0.08],
  [0.66, 0.46],
  [0.96, 0.46],
];
/** Occasions alternate, so that the loop never reads as being only for weddings. */
const OBJECTS = [
  DISCO_BALL,
  PARTY_HAT,
  CHAMPAGNE_GLASS,
  BALLOON,
  WEDDING_CAKE,
  COCKTAIL_GLASS,
  WEDDING_BELL,
  TROPHY,
];

const ROWS = DISCO_BALL.length - 1;
/** Six mirrors show at once, and a seventh is always on its way round. */
const COLUMNS = 7;
/** Degrees each mirror spans, and how much of that is left as a gap around it. */
const FACET_DEGREES = 30;
const FACET_GAP_DEGREES = 2.4;
/** The gap between rows, in the drawing's own units. */
const ROW_GAP = 1.6;

/**
 * Mirrors catch the light unevenly, which is what makes the ball look lit. Each
 * brightness is drawn as one path holding all of its mirrors, so a frame updates
 * a handful of paths rather than dozens.
 */
export const FACET_OPACITIES = [1, 0.5, 0.8, 0.35];

/**
 * A mirror's twinkle: a white flash laid over it, stepped through these strengths
 * so that it stays a few shared paths like the mirrors themselves.
 */
export const TWINKLE_OPACITIES = [0.35, 0.65, 1];
/** Whole, so each mirror's twinkle also has no seam in the loop. */
const TWINKLES_PER_LOOP = 6;
/** The share of each twinkle's period the mirror spends lit. */
const TWINKLE_SHARE = 0.14;

/**
 * One loop is three seconds and three columns of turn per object. That has to
 * come to a whole number of repeats of `FACET_OPACITIES`, or the loop has a seam,
 * which is why the number of objects stays a multiple of four.
 */
export const LOOP_MS = 3000 * OBJECTS.length;
const COLUMNS_PER_LOOP = 3 * OBJECTS.length;
/** The share of each object's three seconds it holds still before changing. */
const HOLD_SHARE = 0.7;

/**
 * The clock, wrapped into 0 up to but not including 1.
 *
 * Reanimated does not clamp an animation's elapsed time, so a frame stamped just
 * before the loop restarted reads as very slightly below zero. Used as is, that
 * rounds down to object -1, which does not exist, and throws on the UI thread.
 */
function loopPosition(clock: number): number {
  'worklet';
  return ((clock % 1) + 1) % 1;
}

/** How far the current object has blended into the next, eased at both ends. */
function blendAmount(progress: number): number {
  'worklet';
  if (progress <= HOLD_SHARE) return 0;
  const t = (progress - HOLD_SHARE) / (1 - HOLD_SHARE);
  return t * t * (3 - 2 * t);
}

/** The ball's string and fixing only belong on the ball, so they fade with it. */
export function hangerOpacity(rawClock: number): number {
  'worklet';
  const stage = loopPosition(rawClock) * OBJECTS.length;
  const objectIndex = Math.floor(stage) % OBJECTS.length;
  const blend = blendAmount(stage - Math.floor(stage));
  if (objectIndex === 0) return 1 - blend;
  if (objectIndex === OBJECTS.length - 1) return blend;
  return 0;
}

function facetX(width: number, sine: number): string {
  'worklet';
  return (CENTRE_X + width * sine).toFixed(2);
}

/**
 * The frame's mirrors, as one path per group: the `FACET_OPACITIES` in order,
 * then the `TWINKLE_OPACITIES`.
 */
export function facetPaths(rawClock: number): string[] {
  'worklet';
  const clock = loopPosition(rawClock);
  const stage = clock * OBJECTS.length;
  const objectIndex = Math.floor(stage) % OBJECTS.length;
  const from = OBJECTS[objectIndex];
  const to = OBJECTS[(objectIndex + 1) % OBJECTS.length];
  const blend = blendAmount(stage - Math.floor(stage));

  const heights: number[] = [];
  const widths: number[] = [];
  for (let point = 0; point <= ROWS; point += 1) {
    heights.push(CENTRE_Y + RADIUS * (from[point][0] + (to[point][0] - from[point][0]) * blend));
    widths.push(RADIUS * (from[point][1] + (to[point][1] - from[point][1]) * blend));
  }

  const turned = clock * COLUMNS_PER_LOOP;
  const steps = Math.floor(turned);
  const paths: string[] = [];
  for (let group = 0; group < FACET_OPACITIES.length + TWINKLE_OPACITIES.length; group += 1) {
    paths.push('');
  }

  for (let row = 0; row < ROWS; row += 1) {
    const top = heights[row] + ROW_GAP / 2;
    const bottom = heights[row + 1] - ROW_GAP / 2;

    for (let column = 0; column < COLUMNS && bottom - top >= 0.5; column += 1) {
      const position = column - 1 + (turned - steps);
      const west = Math.max(-90 + position * FACET_DEGREES + FACET_GAP_DEGREES, -90);
      const east = Math.min(-90 + (position + 1) * FACET_DEGREES - FACET_GAP_DEGREES, 90);

      if (east > west) {
        const sinWest = Math.sin((west * Math.PI) / 180);
        const sinEast = Math.sin((east * Math.PI) / 180);

        // Which physical mirror is in this slot, so its brightness travels with it.
        const count = FACET_OPACITIES.length;
        const mirror = (((row + (column - steps) * 3) % count) + count) % count;

        const quad =
          `M${facetX(widths[row], sinWest)} ${top.toFixed(2)}` +
          `L${facetX(widths[row], sinEast)} ${top.toFixed(2)}` +
          `L${facetX(widths[row + 1], sinEast)} ${bottom.toFixed(2)}` +
          `L${facetX(widths[row + 1], sinWest)} ${bottom.toFixed(2)}Z`;
        paths[mirror] += quad;

        // Each mirror has its own moment, scattered by where it sits on the ball,
        // and keeps it as it turns.
        const around = ((column - steps) % COLUMNS_PER_LOOP + COLUMNS_PER_LOOP) % COLUMNS_PER_LOOP;
        const moment = (row * 0.37 + around * 0.61) % 1;
        const cycle = (clock * TWINKLES_PER_LOOP + moment) % 1;
        if (cycle < TWINKLE_SHARE) {
          const strength = Math.sin((Math.PI * cycle) / TWINKLE_SHARE);
          const level = Math.min(
            Math.floor(strength * TWINKLE_OPACITIES.length),
            TWINKLE_OPACITIES.length - 1,
          );
          paths[count + level] += quad;
        }
      }
    }
  }

  return paths;
}
