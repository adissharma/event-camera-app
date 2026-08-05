/**
 * The disposable-camera look, as plain data.
 *
 * Every photo gets its own *recipe* — a set of effect values derived
 * deterministically from that photo's identity, so two photos in the same
 * gallery differ from each other while any one photo looks identical on
 * every re-render, scroll back, and app relaunch. That is the whole point:
 * a filter that applies byte-identical numbers to every frame reads as a
 * digital preset, and a filter that re-randomises on each render flickers.
 *
 * No React and no Skia imports here on purpose. `DisposablePhoto`
 * (src/components/media/disposable-photo.tsx) renders a recipe to screen
 * today; a future bulk-export step can hand the same recipe to an offscreen
 * Skia surface and get a matching file out, without re-deriving the look.
 */

/** A 4x5 row-major colour matrix. Offsets (column 5) are in 0..1, as Skia expects. */
export type ColorMatrix4x5 = number[];

export interface DisposableVignette {
  /** 0..1 alpha at the darkest point. */
  opacity: number;
  /** Fraction of the half-diagonal at which darkening starts. */
  innerStop: number;
}

export interface DisposableLightLeak {
  /** Which edge the leak enters from. */
  corner: 0 | 1 | 2 | 3;
  /** 0..1 alpha of the leak. */
  strength: number;
  /** Warm leak colour, `r, g, b` for interpolation into an rgba() string. */
  colour: string;
}

export interface DisposableRecipe {
  colorMatrix: ColorMatrix4x5;
  /** 0..1 opacity of the procedural grain layer. */
  grainIntensity: number;
  /** Shader seed, so two photos get different noise fields. */
  grainSeed: number;
  /** Blur sigma in points. Deliberately tiny — softening, not defocus. */
  blurRadius: number;
  vignette: DisposableVignette;
  /** Null on roughly half of photos: leaks are "occasional", not a fixture. */
  lightLeak: DisposableLightLeak | null;
  dust: { variant: 0 | 1; opacity: number } | null;
  scratches: { variant: 0 | 1; opacity: number } | null;
}

// ── Seeded randomness ────────────────────────────────────────────────

/** FNV-1a. Turns a photo's identity string into a 32-bit seed. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — small, fast, good enough for picking effect values. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Colour matrix maths ──────────────────────────────────────────────

const IDENTITY: ColorMatrix4x5 = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * Composes two colour matrices: the result applies `second` to the output of
 * `first`, so `compose(a, b)` reads left-to-right as "a, then b".
 */
export function compose(first: ColorMatrix4x5, second: ColorMatrix4x5): ColorMatrix4x5 {
  const out: number[] = new Array(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += second[row * 5 + k] * first[k * 5 + col];
      }
      out[row * 5 + col] = sum;
    }
    // Translation column: second's linear part applied to first's offsets,
    // plus second's own offset.
    let offset = second[row * 5 + 4];
    for (let k = 0; k < 4; k += 1) {
      offset += second[row * 5 + k] * first[k * 5 + 4];
    }
    out[row * 5 + 4] = offset;
  }
  return out;
}

/** Rec. 709 luminance weights — the same ones a real desaturation uses. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

export function saturation(amount: number): ColorMatrix4x5 {
  const inv = 1 - amount;
  return [
    LUMA_R * inv + amount, LUMA_G * inv, LUMA_B * inv, 0, 0,
    LUMA_R * inv, LUMA_G * inv + amount, LUMA_B * inv, 0, 0,
    LUMA_R * inv, LUMA_G * inv, LUMA_B * inv + amount, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** Scales around mid-grey so contrast doesn't also shift exposure. */
export function contrast(amount: number): ColorMatrix4x5 {
  const offset = (1 - amount) * 0.5;
  return [
    amount, 0, 0, 0, offset,
    0, amount, 0, 0, offset,
    0, 0, amount, 0, offset,
    0, 0, 0, 1, 0,
  ];
}

export function exposure(amount: number): ColorMatrix4x5 {
  return [
    amount, 0, 0, 0, 0,
    0, amount, 0, 0, 0,
    0, 0, amount, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Pushes red up and blue down by `amount`, leaving green alone — the
 * channel-level version of a warmer white balance, rather than laying an
 * orange wash over everything.
 */
export function warmth(amount: number): ColorMatrix4x5 {
  return [
    1 + amount, 0, 0, 0, 0,
    0, 1 + amount * 0.25, 0, 0, 0,
    0, 0, 1 - amount, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Lifts the shadows toward warm grey instead of true black, the way a print
 * that has aged loses its deepest blacks. A small positive offset on all
 * three channels, biased warm.
 */
export function liftShadows(amount: number): ColorMatrix4x5 {
  return [
    1 - amount, 0, 0, 0, amount * 1.15,
    0, 1 - amount, 0, 0, amount * 0.95,
    0, 0, 1 - amount, 0, amount * 0.8,
    0, 0, 0, 1, 0,
  ];
}

// ── Recipe ───────────────────────────────────────────────────────────

/** Picks a float in [min, max). */
function range(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

/**
 * Warm leak colours — a narrow set, all in the amber/rose family that real
 * light leaks produce. Picking from a list rather than randomising hue keeps
 * a stray green or purple leak off a wedding photo.
 */
const LEAK_COLOURS = ['255, 176, 92', '255, 138, 76', '255, 202, 138', '250, 150, 120'];

/**
 * Builds the recipe for one photo.
 *
 * `seedKey` must be stable for a given photo and different between photos —
 * the media item's id is ideal. It is hashed, never parsed, so any stable
 * string works.
 */
export function buildDisposableRecipe(seedKey: string): DisposableRecipe {
  const random = createRandom(hashString(seedKey));

  // Colour: warm the white balance, lift the blacks, then a restrained
  // contrast/exposure/saturation pass. Ranges are tight on purpose — the
  // variation should read as "these came off the same roll", not as
  // different filters.
  const colorMatrix = [
    warmth(range(random, 0.045, 0.085)),
    liftShadows(range(random, 0.03, 0.06)),
    saturation(range(random, 0.9, 1.02)),
    contrast(range(random, 1.03, 1.1)),
    exposure(range(random, 0.97, 1.05)),
  ].reduce(compose, IDENTITY);

  // Leaks are the loudest effect here, so most photos don't get one.
  const hasLeak = random() < 0.5;
  const lightLeak: DisposableLightLeak | null = hasLeak
    ? {
        corner: Math.floor(random() * 4) as 0 | 1 | 2 | 3,
        strength: range(random, 0.08, 0.17),
        colour: LEAK_COLOURS[Math.floor(random() * LEAK_COLOURS.length)],
      }
    : null;

  const hasDust = random() < 0.75;
  const hasScratches = random() < 0.6;

  return {
    colorMatrix,
    grainIntensity: range(random, 0.05, 0.09),
    grainSeed: Math.floor(random() * 10000),
    blurRadius: range(random, 0.3, 0.6),
    vignette: {
      opacity: range(random, 0.22, 0.4),
      innerStop: range(random, 0.45, 0.62),
    },
    lightLeak,
    dust: hasDust
      ? { variant: (random() < 0.5 ? 0 : 1) as 0 | 1, opacity: range(random, 0.05, 0.12) }
      : null,
    scratches: hasScratches
      ? { variant: (random() < 0.5 ? 0 : 1) as 0 | 1, opacity: range(random, 0.04, 0.1) }
      : null,
  };
}
