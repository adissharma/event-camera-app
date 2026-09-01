import {
  DISPOSABLE_PRESET,
  type DisposablePreset,
  type Varied,
} from './disposable-preset';

/**
 * One photo's Disposable recipe: the preset, resolved.
 *
 * Every value is derived deterministically from that photo's identity, so two
 * photos in the same gallery differ from each other while any one photo looks
 * identical on every re-render, scroll back, and app relaunch. That is the
 * whole point: a filter that applies byte-identical numbers to every frame
 * reads as a digital preset, and one that re-randomises per render flickers.
 *
 * No React and no Skia imports here on purpose. This module is pure data and
 * arithmetic, which is what lets the on-screen preview
 * (`components/media/disposable-photo.tsx`) and the full-resolution export
 * (`disposable-render.ts`) share one description of the look rather than
 * drifting apart.
 *
 * Everything here is resolution-independent. Turning a recipe into pixels —
 * grain cell size, softening radius, the clamps that keep both sane at a given
 * output size — is `disposable-paint.ts`'s job.
 */

/** A 4x5 row-major colour matrix. Offsets (column 5) are in 0..1, as Skia expects. */
export type ColorMatrix4x5 = number[];

export interface DisposableRecipe {
  /** The linear part of the colour treatment: white balance, mixer, saturation. */
  colorMatrix: ColorMatrix4x5;

  tone: {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    blacks: number;
    whites: number;
  };

  /** The selective part of the colour treatment, applied in the shader. */
  colour: {
    warmHighlights: number;
    coolShadows: number;
    blueDensity: number;
    greenControl: number;
  };

  grain: {
    intensity: number;
    /** Grain cells across the frame's long edge — frame-relative, not pixels. */
    cells: number;
    contrast: number;
    shadowBias: number;
    seed: number;
  };

  softness: {
    /** Radius in pixels *at* `referenceLongEdge`; scaled to the real output. */
    blurPx: number;
    referenceLongEdge: number;
  };

  vignette: {
    strength: number;
    radius: number;
    softness: number;
  };

  /** Null on the minority of photos that get no dust at all. */
  dust: {
    opacity: number;
    density: number;
    size: number;
    darkRatio: number;
    seed: number;
  } | null;

  /** Null on nearly every photo. A scratch is an exception, not a texture. */
  scratches: {
    opacity: number;
    width: number;
    seed: number;
  } | null;

  /** Null on roughly three photos in four: leaks are occasional, not a fixture. */
  lightLeak: {
    opacity: number;
    spread: number;
    colour: [number, number, number];
    origin: [number, number];
    direction: [number, number];
    /** Which edge was picked. Carried for debugging and tests, not rendering. */
    edge: string;
  } | null;
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

/** Resolves a `Varied` into a concrete value, `base ± base * vary`. */
export function resolveVaried(random: () => number, value: Varied): number {
  return value.base * (1 + (random() * 2 - 1) * value.vary);
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

/**
 * Warmer white balance: red up, blue down, green nearly still.
 *
 * The channel-level version of a colour-temperature shift rather than an
 * orange wash laid over everything — which is the difference between "shot in
 * afternoon light" and the sepia the brief rules out.
 */
export function temperature(amount: number): ColorMatrix4x5 {
  return [
    1 + amount * 0.9, 0, 0, 0, 0,
    0, 1 + amount * 0.15, 0, 0, 0,
    0, 0, 1 - amount * 0.9, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** Positive is magenta, negative green. Kept tiny — a corrector, not a look. */
export function tint(amount: number): ColorMatrix4x5 {
  return [
    1 + amount * 0.5, 0, 0, 0, 0,
    0, 1 - amount, 0, 0, 0,
    0, 0, 1 + amount * 0.5, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Grey-preserving channel mixer.
 *
 * `b += kb * (b - (r + g) / 2)` and the same shape on green. Because the
 * correction is exactly zero when the three channels agree, this enriches a
 * blue sky and restrains a fluorescent green without shifting neutrals — which
 * a plain per-channel gain cannot do, since that tints the entire frame
 * including the greys.
 */
export function channelMixer(blueRichness: number, greenRestraint: number): ColorMatrix4x5 {
  const kb = blueRichness;
  const kg = greenRestraint;
  return [
    1, 0, 0, 0, 0,
    -kg / 2, 1 + kg, -kg / 2, 0, 0,
    -kb / 2, -kb / 2, 1 + kb, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

// ── Recipe ───────────────────────────────────────────────────────────

/** Picks one of `edges` in proportion to its weight. */
function pickEdge(random: () => number, preset: DisposablePreset) {
  const edges = preset.lightLeak.edges;
  const total = edges.reduce((sum, edge) => sum + edge.weight, 0);
  let roll = random() * total;
  for (const edge of edges) {
    roll -= edge.weight;
    if (roll <= 0) return edge;
  }
  return edges[edges.length - 1];
}

/**
 * Builds the recipe for one photo.
 *
 * `seedKey` must be stable for a given photo and different between photos —
 * the media item's id is ideal. It is hashed, never parsed, so any stable
 * string works.
 *
 * The draw order below is load-bearing: adding a `random()` call in the middle
 * reshuffles every value after it, so every photo in every gallery would get a
 * different look. Append new draws at the end.
 */
export function buildDisposableRecipe(
  seedKey: string,
  preset: DisposablePreset = DISPOSABLE_PRESET,
): DisposableRecipe {
  const random = createRandom(hashString(seedKey));

  // The linear half of the colour treatment. Order matters: white balance
  // first (it is a correction), then the mixer that enriches what is already
  // there, then saturation last so it amplifies the enriched result.
  const colorMatrix = [
    temperature(preset.colour.temperature),
    tint(preset.colour.tint),
    channelMixer(preset.colour.blueRichness, preset.colour.greenRestraint),
    saturation(1 + preset.colour.saturation),
  ].reduce(compose, IDENTITY);

  const hasDust = random() < preset.dust.probability;
  const hasScratch = random() < preset.scratches.probability;
  const hasLeak = random() < preset.lightLeak.probability;

  const leakEdge = pickEdge(random, preset);
  const leakColour =
    preset.lightLeak.colours[Math.floor(random() * preset.lightLeak.colours.length)];
  // Slides the leak along its edge so two photos with the same edge still
  // differ. Perpendicular to the travel direction, so it never walks the
  // origin off the frame.
  const slide = (random() - 0.5) * 0.5;
  const perpendicular: [number, number] = [-leakEdge.direction[1], leakEdge.direction[0]];

  return {
    colorMatrix,

    tone: { ...preset.tone },

    colour: {
      warmHighlights: preset.colour.warmHighlights,
      coolShadows: preset.colour.coolShadows,
      blueDensity: preset.colour.blueDensity,
      greenControl: preset.colour.greenControl,
    },

    grain: {
      intensity: resolveVaried(random, preset.grain.intensity),
      cells: preset.grain.cells,
      contrast: preset.grain.contrast,
      shadowBias: preset.grain.shadowBias,
      seed: Math.floor(random() * 10_000),
    },

    softness: { ...preset.softness },

    vignette: {
      strength: resolveVaried(random, preset.vignette.strength),
      radius: resolveVaried(random, preset.vignette.radius),
      softness: preset.vignette.softness,
    },

    dust: hasDust
      ? {
          opacity: resolveVaried(random, preset.dust.opacity),
          density: resolveVaried(random, preset.dust.density),
          size: resolveVaried(random, preset.dust.size),
          darkRatio: preset.dust.darkRatio,
          // The variant only shifts the noise field. There is no bitmap to
          // recognise, so no two photos share a speck position.
          seed: Math.floor(random() * preset.dust.variants) * 137.13 + random() * 4.7,
        }
      : null,

    scratches: hasScratch
      ? {
          opacity: resolveVaried(random, preset.scratches.opacity),
          width: resolveVaried(random, preset.scratches.width),
          seed: random() * 100,
        }
      : null,

    lightLeak: hasLeak
      ? {
          opacity: resolveVaried(random, preset.lightLeak.opacity),
          spread: resolveVaried(random, preset.lightLeak.spread),
          colour: leakColour,
          origin: [
            leakEdge.origin[0] + perpendicular[0] * slide,
            leakEdge.origin[1] + perpendicular[1] * slide,
          ],
          direction: leakEdge.direction,
          edge: leakEdge.name,
        }
      : null,
  };
}
