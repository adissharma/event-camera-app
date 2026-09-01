/**
 * The whole Disposable look, as one SkSL fragment shader.
 *
 * Exported as a plain string, deliberately: this module imports nothing, so it
 * is safe on web (where Skia is not bootstrapped) and can be inspected by a
 * test without a GPU. `disposable-paint.ts` is the only thing that compiles it.
 *
 * ── Why one shader rather than a chain of image filters ──────────────────
 *
 * Skia offers both. A `RuntimeShader` *image filter* is evaluated in the
 * layer's device space, so its incoming coordinate depends on the canvas
 * transform — which differs between a preview drawn at 3x on a phone screen
 * and an export drawn 1:1 into an offscreen surface. Anything positioned
 * relative to the frame (the vignette, the leak, the dust) would then land
 * somewhere different in each. A runtime shader used as a *paint shader* is
 * evaluated in local coordinates, which are exactly the destination rect we
 * asked for, so `xy / resolution` is the same normalised frame position in
 * both. That is what lets one paint serve preview and export unchanged.
 *
 * The one thing this costs is that the analogue softening has to be sampled
 * here rather than delegated to `ImageFilter.MakeBlur` — a blur applied to the
 * paint's output would blur the grain along with it, which defeats the point.
 * At a sub-two-pixel radius a 3x3 binomial kernel is indistinguishable from a
 * Gaussian, so nine taps buys the whole effect.
 *
 * ── Layer order ─────────────────────────────────────────────────────────
 *
 * Follows how a frame is physically formed, because that is what makes the
 * result read as a photograph rather than a stack of overlays:
 *
 *   1. optical softness   — the lens, before anything is recorded
 *   2. tone               — the film's response curve
 *   3. colour             — the emulsion's dye layers
 *   4. light leak         — stray light on the film, before development
 *   5. grain              — the emulsion's own structure
 *   6. vignette           — lens falloff, which attenuates the grain with it
 *   7. dust and scratches — debris on the scanner, after everything else
 */

export const DISPOSABLE_SHADER_SOURCE = `
uniform shader image;

uniform float2 uResolution;
uniform float  uAspect;
uniform float  uSoftness;

// The linear half of the colour treatment: white balance, channel mixer and
// saturation, pre-composed into one matrix by \'disposable-recipe.ts\'. It has
// to live inside the shader rather than in the paint's colour filter, because
// Skia runs a paint's colour filter *after* its shader — which would put white
// balance after the grain instead of before the tone curve.
uniform float3x3 uColorMatrix;
uniform float3   uColorOffset;

// Tone
uniform float uExposure;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform float uBlacks;
uniform float uWhites;

// Selective colour
uniform float uWarmHighlights;
uniform float uCoolShadows;
uniform float uBlueDensity;
uniform float uGreenControl;

// Grain
uniform float uGrainIntensity;
uniform float uGrainCellPx;
uniform float uGrainContrast;
uniform float uGrainShadowBias;
uniform float uGrainSeed;

// Vignette
uniform float uVignetteStrength;
uniform float uVignetteRadius;
uniform float uVignetteSoftness;

// Dust
uniform float uDustOpacity;
uniform float uDustDensity;
uniform float uDustSize;
uniform float uDustDarkRatio;
uniform float uDustSeed;

// Scratches
uniform float uScratchOpacity;
uniform float uScratchWidth;
uniform float uScratchSeed;

// Light leak
uniform float  uLeakOpacity;
uniform float  uLeakSpread;
uniform float3 uLeakColour;
uniform float2 uLeakOrigin;
uniform float2 uLeakDirection;

const float3 LUMA = float3(0.2126, 0.7152, 0.0722);

// Every random value in this shader — grain, dust position, dust size, speck
// brightness — comes through here, so its quality is the effect's quality.
//
// The obvious short hash (fract(p * vec2(123.34, 456.21)), then a dot with
// itself) is fine for continuously varying input but falls apart on the
// integer lattice this uses: consecutive integers step the intermediate by a
// constant, so it repeats on a short period and the 'noise' renders as a
// woven crosshatch across the entire frame. This one decorrelates the two
// components against each other before combining, and holds up on integers.
float hash21(float2 p) {
  float3 q = fract(float3(p.x, p.y, p.x) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Interpolated value noise rather than per-pixel white noise. Film grain
// clumps; uncorrelated per-pixel noise reads as digital sensor noise, which is
// the single most common tell of a fake film filter.
float valueNoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + float2(1.0, 0.0));
  float c = hash21(i + float2(0.0, 1.0));
  float d = hash21(i + float2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 3x3 binomial kernel. Takes the digital edge off without reading as blur.
float4 sampleSoft(float2 xy, float r) {
  if (r <= 0.01) {
    return float4(image.eval(xy));
  }
  float4 sum = float4(0.0);
  float total = 0.0;
  for (int j = -1; j <= 1; ++j) {
    for (int i = -1; i <= 1; ++i) {
      float w = (i == 0 && j == 0) ? 4.0 : ((i == 0 || j == 0) ? 2.0 : 1.0);
      sum += float4(image.eval(xy + float2(float(i), float(j)) * r)) * w;
      total += w;
    }
  }
  return sum / total;
}

// A bounded S-curve. Maps 0 to 0 and 1 to 1 exactly, so contrast can be
// pushed hard without ever driving a channel out of range.
//
// The obvious alternative — scaling around mid-grey — runs off both ends and
// has to be clipped back, and by then the damage is done: a saturated blue sky
// clips flat at the top, and highlight recovery cannot pull it back because
// there is no headroom left to recover into. Composing smoothstep with itself
// gives a steeper midtone slope while compressing the extremes instead.
float3 sCurve(float3 x, float amount) {
  float3 s = x * x * (3.0 - 2.0 * x);
  float3 s2 = s * s * (3.0 - 2.0 * s);
  return mix(x, mix(s, s2, 0.5), amount * 2.0);
}

float3 applyTone(float3 c) {
  // Clamped before the curve: smoothstep is only monotonic on 0..1, and an
  // exposure lift can push a bright pixel past 1, where the polynomial turns
  // back down and a highlight would render *darker* than its neighbour.
  float3 x = clamp(c * (1.0 + uExposure), 0.0, 1.0);

  // The response curve is per channel, because that is what a film's three
  // dye layers actually do, and it is where the look's colour separation
  // comes from.
  x = sCurve(x, uContrast);

  // The four endpoint controls, by contrast, act on luminance and scale all
  // three channels together. Applied per channel they crush whichever channel
  // is weakest — the blue in sunlit foliage, the red in a deep sky — and the
  // photo picks up saturation nobody asked for on top of the saturation the
  // curve already added.
  //
  // Each is scaled by the headroom left in the direction it travels, so a
  // highlight pull cannot reach zero and a black point cannot flatten shadow
  // detail into one value.
  float l = dot(x, LUMA);
  float hi = smoothstep(0.55, 1.0, l);
  float lo = 1.0 - smoothstep(0.0, 0.45, l);
  float wh = smoothstep(0.78, 1.0, l);
  float bl = 1.0 - smoothstep(0.0, 0.28, l);

  float delta = uHighlights * hi * (1.0 - l) * 2.0
              + uShadows    * lo * l        * 2.0
              + uWhites     * wh * (1.0 - l) * 3.0
              + uBlacks     * bl * l        * 1.5;

  // Applied as a gain rather than an offset, so hue and saturation survive it.
  float gain = l > 0.002 ? (l + delta) / l : 1.0;
  return clamp(x * gain, 0.0, 1.0);
}

float3 applyColour(float3 x) {
  float lum = dot(x, LUMA);

  // Sky. Gated on the pixel already being blue, so skin, warm neutrals and
  // shadow detail are untouched — a flat blue gain would tint the whole frame.
  float blueness = clamp((x.b - max(x.r, x.g)) * 2.5, 0.0, 1.0);
  x.b += uBlueDensity * blueness * (1.0 - x.b);
  x.r -= uBlueDensity * blueness * 0.45 * x.r;
  x.g -= uBlueDensity * blueness * 0.12 * x.g;
  // A touch darker as well as bluer: dense, rather than pastel.
  x *= 1.0 - uBlueDensity * blueness * 0.10;

  // Foliage. Take the neon out, let a little red in so greens read sunlit.
  float greenness = clamp((x.g - max(x.r, x.b)) * 2.5, 0.0, 1.0);
  x.r += uGreenControl * greenness * 0.35 * (1.0 - x.r);
  x.g -= uGreenControl * greenness * 0.22 * x.g;
  // Pulled back toward a third of the green channel. A green whose blue has
  // been crushed to nothing is precisely what 'fluorescent' looks like, and
  // both the saturation lift and the response curve push it that way.
  x.b += uGreenControl * greenness * 1.2 * max(x.g * 0.33 - x.b, 0.0);

  // Split tone: amber into the light, blue into the dark. Applied by
  // luminance band rather than globally, which is the difference between
  // "sunlit" and "orange filter".
  //
  // Each shift is scaled by the headroom left in the direction it travels —
  // toward white for the channels it raises, toward black for the ones it
  // lowers. A flat addition instead (which is the obvious way to write this)
  // drives already-bright channels straight through 1.0, so sunlit stone and
  // light skin clip to a flat orange; and it lifts the blue channel of a
  // near-black pixel off zero, which is precisely the milky shadow this look
  // is supposed to avoid.
  float hiMask = smoothstep(0.54, 0.95, lum);
  float loMask = 1.0 - smoothstep(0.12, 0.58, lum);

  // Fades out as the brightest channel approaches white, so speculars and
  // paper whites stay white and the warmth lands on sunlit *surfaces*. Without
  // that fade, the shift has the most room to move exactly where there is
  // least reason to — a white wall picks up the strongest amber cast in the
  // frame, which is the tell of a cheap warm filter.
  float warmRoom = 1.0 - max(max(x.r, x.g), x.b);
  x += uWarmHighlights * hiMask * float3(1.0, 0.42, -0.55) * warmRoom * 2.5;

  // Scaled by the signal itself, so a pixel that is already black stays black.
  // Headroom scaling would do the reverse here: a near-black pixel has almost
  // its whole range free, so it would take the *most* blue — which is how a
  // cool-shadow tint turns into the milky lifted black this look rules out.
  x += uCoolShadows * loMask * float3(-0.16, 0.05, 1.0) * x * 2.5;

  return clamp(x, 0.0, 1.0);
}

float grainAt(float2 p) {
  float2 q = p + float2(uGrainSeed, uGrainSeed * 1.7);
  // The second octave is *coarser* than the first, not finer. Conventional
  // fBm stacks higher frequencies, but the first octave is already close to
  // the pixel grid here, so a 2x octave lands below it and aliases into a
  // regular crosshatch across the whole frame. Going the other way adds the
  // larger-scale clumping real grain has instead.
  float g = valueNoise(q) * 0.62 + valueNoise(q * 0.47 + 19.3) * 0.38;
  g = g * 2.0 - 1.0;
  // Shapes each grain's punch without changing its size.
  return sign(g) * pow(abs(g), 1.0 / uGrainContrast);
}

float vignetteAt(float2 uv) {
  float2 p = (uv - 0.5) * 2.0;
  float d = length(p) * 0.7071;
  return smoothstep(uVignetteRadius, uVignetteRadius + uVignetteSoftness, d);
}

// Returns light specks in x, dark flecks in y. Generated from the seed rather
// than sampled from a texture: nothing repeats between photos, and the specks
// scale with the output instead of being stretched across it.
float2 dustField(float2 uv) {
  float2 p = float2(uv.x * uAspect, uv.y) * uDustDensity;
  float2 cell = floor(p);
  float2 f = fract(p);

  // Four cells rather than the surrounding nine: a speck's centre always lies
  // inside its own cell and its radius is clamped below half a cell, so it can
  // only ever reach into the neighbours on the side of the cell the sample
  // point is already nearest. Checking the other five is work that can never
  // contribute, and dust was half the cost of this shader before this.
  float2 towards = step(0.5, f) * 2.0 - 1.0;

  float light = 0.0;
  float dark = 0.0;
  for (int j = 0; j < 2; ++j) {
    for (int i = 0; i < 2; ++i) {
      float2 g = float2(float(i), float(j)) * towards;
      float2 id = cell + g + uDustSeed;
      if (hash21(id) > 0.80) {
        float2 offset = float2(hash21(id + 11.7), hash21(id + 23.1));
        float dist = length(f - g - offset);
        float radius = min(mix(0.012, 0.055, hash21(id + 37.9)) * uDustSize, 0.45);
        float speck = smoothstep(radius, 0.0, dist) * (0.55 + 0.45 * hash21(id + 53.3));
        if (hash21(id + 71.1) < uDustDarkRatio) {
          dark += speck;
        } else {
          light += speck;
        }
      }
    }
  }
  return float2(min(light, 1.0), min(dark, 1.0));
}

float scratchAt(float2 uv) {
  float x0 = hash21(float2(uScratchSeed, 3.7));
  float lean = (hash21(float2(uScratchSeed, 9.1)) - 0.5) * 0.12;
  float dx = abs(uv.x - (x0 + lean * (uv.y - 0.5)));
  float core = 1.0 - smoothstep(0.0, uScratchWidth, dx);
  // Fading both ends stops it reading as a deliberately drawn line.
  float ends = smoothstep(0.0, 0.18, uv.y) * (1.0 - smoothstep(0.82, 1.0, uv.y));
  return core * ends;
}

float3 applyLeak(float3 x, float2 uv) {
  if (uLeakOpacity <= 0.0) {
    return x;
  }
  float2 d = uv - uLeakOrigin;
  float along = 1.0 - smoothstep(0.0, uLeakSpread, max(dot(d, uLeakDirection), 0.0));
  float2 perp = float2(-uLeakDirection.y, uLeakDirection.x);
  float lateral = 1.0 - smoothstep(0.0, uLeakSpread * 1.8, abs(dot(d, perp)));
  float amount = uLeakOpacity * along * mix(0.45, 1.0, lateral);
  // Screen: stray light can only ever add, never darken.
  return 1.0 - (1.0 - x) * (1.0 - uLeakColour * amount);
}

half4 main(float2 xy) {
  float2 uv = xy / uResolution;

  float4 src = sampleSoft(xy, uSoftness);
  float a = src.a;
  if (a <= 0.0) {
    return half4(0.0);
  }
  float3 c = clamp(src.rgb / a, 0.0, 1.0);

  // White balance and saturation before the tone curve, the way a raw
  // developer orders them: the matrix is a correction to the recorded signal,
  // the curve is the film's response to it.
  c = clamp(uColorMatrix * c + uColorOffset, 0.0, 1.0);

  c = applyTone(c);
  c = applyColour(c);
  c = applyLeak(c, uv);

  // Grain before the vignette, so the corners' grain is attenuated along with
  // the corners — as it is on a real frame.
  float lum = dot(c, LUMA);
  float tonalWeight = 1.0 - uGrainShadowBias * smoothstep(0.55, 1.0, lum);
  c += grainAt(xy / uGrainCellPx) * uGrainIntensity * tonalWeight;

  c *= 1.0 - uVignetteStrength * vignetteAt(uv);

  if (uDustOpacity > 0.0) {
    float2 dust = dustField(uv);
    c = mix(c, float3(1.0), dust.x * uDustOpacity);
    c = mix(c, float3(0.0), dust.y * uDustOpacity * 0.7);
  }

  if (uScratchOpacity > 0.0) {
    c = mix(c, float3(1.0), scratchAt(uv) * uScratchOpacity);
  }

  c = clamp(c, 0.0, 1.0);
  return half4(half3(c * a), half(a));
}
`;
