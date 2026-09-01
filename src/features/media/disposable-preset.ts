/**
 * The Disposable look, expressed entirely as numbers.
 *
 * This file is the tuning surface. Nothing here knows how a pixel is drawn —
 * it is read by `disposable-recipe.ts` (which resolves it into one photo's
 * values) and rendered by `disposable-paint.ts` (which turns those values into
 * a Skia paint). Adjusting the look should never mean editing the pipeline,
 * so every magic number the effect depends on lives here and nowhere else.
 *
 * The target is a scanned analogue point-and-shoot frame: punchy contrast,
 * rich blues, warm sunlit highlights, deep-but-not-crushed shadows, fine
 * grain, a little dust, a soft wide vignette. Explicitly *not* a faded,
 * milky, sepia "vintage" filter — the reference images this was tuned against
 * are rich and photographic first, analogue second.
 */

/**
 * A value that varies per photo.
 *
 * `vary` is a ± fraction of `base`, so `{ base: 0.18, vary: 0.1 }` resolves
 * somewhere in 0.162–0.198. Fractions rather than absolute bounds because
 * every one of these has been specified as "about ±10%", and because it means
 * retuning `base` carries its spread with it instead of silently widening or
 * narrowing the variation.
 */
export interface Varied {
  base: number;
  vary: number;
}

/**
 * Tone, in the vocabulary of a raw developer.
 *
 * Applied in the shader rather than in the colour matrix: `highlights`,
 * `shadows`, `blacks` and `whites` are region-selective, and a 4x5 matrix is
 * a linear operator that cannot express "only the bright end". Each is scaled
 * by headroom in the shader (highlight recovery by `1 - x`, shadow depth by
 * `x`) so pushing them never clips an endpoint flat — the brief's "strong but
 * not crushed blacks" and "do not blow out bright areas".
 */
export interface DisposableTone {
  /** Overall gain. `+0.06` is a ~6% lift, not a stop. */
  exposure: number;
  /** Midtone slope. `0.22` lands around a 1.30 gamma slope at mid-grey. */
  contrast: number;
  /** Negative recovers blown highlights. */
  highlights: number;
  /** Negative deepens the shadows. */
  shadows: number;
  /** Negative sets a stronger black point. */
  blacks: number;
  /** Positive stretches the top end. */
  whites: number;
}

/**
 * Colour, split between the parts a matrix can express and the parts it cannot.
 *
 * `saturation`, `temperature`, `tint`, `blueRichness` and `greenRestraint` are
 * linear and compose into the single colour matrix. `blueDensity`,
 * `greenControl`, `warmHighlights` and `coolShadows` are selective — they act
 * on "pixels that are already blue" or "pixels that are already bright" — and
 * happen in the shader.
 */
export interface DisposableColour {
  /** Added saturation. `0.15` renders as `saturation(1.15)`. */
  saturation: number;
  /** Warm white balance. Small: the look is warm, never orange. */
  temperature: number;
  /** Positive is magenta. Kept tiny — it is a cast-corrector, not a look. */
  tint: number;
  /**
   * Channel mixer: `b += k * (b - (r + g) / 2)`.
   *
   * Grey-preserving by construction — the correction is zero when the channels
   * are equal — so it enriches a blue sky without tinting the whole frame,
   * which is what a flat blue-channel gain would do.
   */
  blueRichness: number;
  /** The same mixer on green, negative, so foliage never goes fluorescent. */
  greenRestraint: number;
  /** Amber pushed into bright tones only. */
  warmHighlights: number;
  /** Blue pushed into dark tones only. */
  coolShadows: number;
  /** Selective density on pixels that already read as blue — sky, not skin. */
  blueDensity: number;
  /** Selective restraint + slight warmth on pixels that already read green. */
  greenControl: number;
}

export interface DisposableGrain {
  /**
   * Peak channel deviation, in 0..1 colour space. `0.032` is roughly ±8 levels
   * of 8-bit, which reads as fine film texture at full size.
   *
   * The brief suggested 0.14–0.22, but that is a strength on a normalised
   * scale rather than an amplitude: applied literally here it is ±0.18, or ±46
   * levels, which is the coarse noise the brief also rules out. Tuned by eye
   * against the references instead, which is what the brief asked for when the
   * two disagree.
   */
  intensity: Varied;
  /**
   * Grain cells across the frame's long edge.
   *
   * Frame-relative rather than pixel-relative, which is what keeps a 400px
   * preview and a 4032px export looking like the same photograph. Clamped at
   * render time so a cell never falls below `render.grainMinCellPx` device
   * pixels, since sub-pixel grain aliases into mush rather than disappearing
   * politely.
   */
  cells: number;
  /** >1 makes individual grains punchier without making them larger. */
  contrast: number;
  /** How much more grain shows in shadows and mids than in clipped whites. */
  shadowBias: number;
}

export interface DisposableSoftness {
  /**
   * Softening radius in pixels, *at* `referenceLongEdge`. Scaled linearly with
   * the render's long edge so the softness stays proportional rather than
   * vanishing on an export and dominating a thumbnail.
   */
  blurPx: number;
  referenceLongEdge: number;
}

export interface DisposableVignette {
  /** 0..1 darkening at the corners. */
  strength: Varied;
  /** Normalised radius at which falloff begins. Higher is wider. */
  radius: Varied;
  /** Width of the falloff. High values give the "natural lens" feel. */
  softness: number;
}

export interface DisposableDust {
  /** Fraction of photos that get any dust at all. */
  probability: number;
  /**
   * Peak whiteness of a speck's centre, as a mix weight.
   *
   * The brief suggested 0.05–0.12, which on this implementation is invisible:
   * a speck a couple of pixels across, blended 8% toward white, does not
   * survive being looked at. Real dust on a scan is *small but definite*, so
   * this is opacity of a small speck rather than the opacity of a full-frame
   * overlay, and the number is correspondingly higher.
   */
  opacity: Varied;
  /** Speck grid cells across the long edge. Higher is more, smaller specks. */
  density: Varied;
  /** Multiplier on speck radius. */
  size: Varied;
  /** Fraction of specks rendered as dark flecks rather than light ones. */
  darkRatio: number;
  /**
   * How many distinct speck fields exist.
   *
   * The specks are generated procedurally from this and the photo's seed, not
   * sampled from a texture, so "which variant" only shifts the noise field —
   * there is no bitmap to recognise and no fixed dust position shared between
   * two photos. It also means dust scales with output resolution instead of
   * being stretched.
   */
  variants: number;
}

export interface DisposableScratches {
  /** Deliberately tiny. A visible scratch on every frame reads as a novelty. */
  probability: number;
  opacity: Varied;
  /** Streak width as a fraction of the frame's short edge. */
  width: Varied;
}

export interface DisposableLightLeak {
  probability: number;
  opacity: Varied;
  /** How far across the frame the leak reaches, normalised. */
  spread: Varied;
  /** Warm amber / beige / reddish-gold. `r, g, b` in 0..1. */
  colours: [number, number, number][];
  /**
   * Which edge the leak enters from, and how often. Weighted toward the right
   * and top-right, where a real cartridge leaks.
   */
  edges: { name: string; origin: [number, number]; direction: [number, number]; weight: number }[];
}

/**
 * The date imprint.
 *
 * Sized and positioned in fractions of the frame, like every other layer here,
 * so it lands identically at thumbnail and full-export resolution.
 */
export interface DisposableDateStamp {
  /** Digit height, as a fraction of the frame's short edge. */
  size: number;
  /** Inset from the right edge, as a fraction of width. */
  marginX: number;
  /** Inset from the bottom edge, as a fraction of height. */
  marginY: number;
  /** The digits themselves. Warm orange-red, not neon and not yellow. */
  core: string;
  /** The halo. Deeper and redder than the core, as a hot filament's is. */
  glow: string;
  /** Core opacity. Below 1 so the image reads faintly through the digits. */
  opacity: number;
  /**
   * Blur applied to the digits themselves, relative to digit height.
   *
   * Not optional garnish: an LED exposing film through a gate never produces a
   * hard edge, and a razor-sharp stamp is the single clearest tell that a date
   * was drawn on afterwards rather than exposed into the frame.
   */
  softness: number;
  /** Tight bloom, hugging the digits. Radius is relative to digit height. */
  bloomRadius: number;
  bloomOpacity: number;
  /** Wide, faint halo — the part that bleeds into the surrounding image. */
  bleedRadius: number;
  bleedOpacity: number;
  /** Per-digit brightness variation, 0..1. Keeps the row from reading as vector art. */
  unevenness: number;
}

export interface DisposableRender {
  /**
   * Grain cells are clamped so one never falls below this many device pixels.
   *
   * Two-ish rather than one: interpolated value noise sampled at roughly one
   * cell per pixel is not noise at all, it is a lattice aligned to the pixel
   * grid, and it renders as a visible woven crosshatch over the whole frame.
   */
  grainMinCellPx: number;
  /** Full-resolution exports are capped here to bound peak memory. */
  maxExportLongEdge: number;
  /**
   * A tighter cap used only when no GPU surface could be allocated.
   *
   * The shader is cheap on a GPU and expensive on a CPU raster surface — the
   * difference is orders of magnitude, not percentages — so the fallback path
   * trades some resolution for finishing at all. It should effectively never
   * be taken on a real device; this exists so that if it ever is, the user
   * gets a slightly smaller photo rather than a frozen app.
   */
  maxCpuFallbackLongEdge: number;
  /** JPEG quality for the exported derivative. */
  exportQuality: number;
}

export interface DisposablePreset {
  tone: DisposableTone;
  dateStamp: DisposableDateStamp;
  colour: DisposableColour;
  grain: DisposableGrain;
  softness: DisposableSoftness;
  vignette: DisposableVignette;
  dust: DisposableDust;
  scratches: DisposableScratches;
  lightLeak: DisposableLightLeak;
  render: DisposableRender;
}

export const DISPOSABLE_PRESET: DisposablePreset = {
  tone: {
    exposure: -0.045,
    contrast: 0.055,
    highlights: -0.01,
    shadows: 0.095,
    blacks: -0.03,
    whites: 0.135,
  },

  colour: {
    saturation: 0.04,
    temperature: 0.016,
    tint: -0.037,
    // Both mixers are off, and the comment on `channelMixer` explains why:
    // being linear, they are symmetric, so a blue boost also *removes* blue
    // from every green and a green restraint *adds* green to every magenta.
    // In practice that crushed the blue channel of sunlit foliage to nothing.
    // `blueDensity` and `greenControl` below do the same jobs one-sidedly in
    // the shader, gated on the pixel already being blue or green. The knobs
    // stay exposed because a linear mixer is still the right tool for a
    // whole-frame channel shift.
    blueRichness: 0,
    greenRestraint: 0,
    warmHighlights: 0,
    coolShadows: 0.05,
    blueDensity: 0.13,
    greenControl: 0.1,
  },

  grain: {
    intensity: { base: 0.037, vary: 0.1 },
    cells: 1200,
    contrast: 1.1,
    shadowBias: 0.41,
  },

  softness: {
    blurPx: 1,
    referenceLongEdge: 1600,
  },

  vignette: {
    strength: { base: 0.11, vary: 0.1 },
    radius: { base: 1, vary: 0.06 },
    softness: 0.34,
  },

  dust: {
    probability: 0.35,
    opacity: { base: 0.26, vary: 0.3 },
    density: { base: 26, vary: 0.2 },
    size: { base: 2.4, vary: 0.25 },
    darkRatio: 0.34,
    variants: 4,
  },

  scratches: {
    probability: 0.06,
    opacity: { base: 0.02, vary: 0.3 },
    width: { base: 0.004, vary: 0.4 },
  },

  lightLeak: {
    probability: 0.25,
    opacity: { base: 0.05, vary: 0.35 },
    spread: { base: 0.42, vary: 0.25 },
    // Amber, beige and reddish-gold. A narrow family on purpose: randomising
    // hue instead would eventually put a green or violet leak on a wedding.
    colours: [
      [1.0, 0.72, 0.42],
      [1.0, 0.78, 0.56],
      [0.98, 0.6, 0.36],
      [1.0, 0.84, 0.66],
    ],
    // `origin` is the point the leak is brightest, in normalised frame
    // coordinates; `direction` is the unit vector it travels along.
    edges: [
      { name: 'right', origin: [1, 0.5], direction: [-1, 0], weight: 3 },
      { name: 'top-right', origin: [1, 0], direction: [-0.7071, 0.7071], weight: 3 },
      { name: 'bottom-right', origin: [1, 1], direction: [-0.7071, -0.7071], weight: 2 },
      { name: 'bottom-left', origin: [0, 1], direction: [0.7071, -0.7071], weight: 1 },
      { name: 'left', origin: [0, 0.5], direction: [1, 0], weight: 1 },
    ],
  },

  dateStamp: {
    size: 0.052,
    marginX: 0.055,
    marginY: 0.045,
    core: '#ff7c38',
    glow: '#ff5214',
    opacity: 0.96,
    softness: 0.022,
    bloomRadius: 0.1,
    bloomOpacity: 0.6,
    bleedRadius: 0.34,
    bleedOpacity: 0.22,
    unevenness: 0.16,
  },

  render: {
    grainMinCellPx: 2.2,
    maxExportLongEdge: 4096,
    maxCpuFallbackLongEdge: 2048,
    exportQuality: 95,
  },
};
