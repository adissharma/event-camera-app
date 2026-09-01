# Filter lab

Two ways to look at the Disposable filter without rebuilding the app: an
interactive tuner in the browser, and a command-line renderer for batches and
sweeps.

**Neither one changes the app on its own.** The command-line tool only ever
writes PNGs into `out/`. The tuner previews in the browser and writes to
`src/features/media/disposable-preset.ts` only when you press **Save**.

---

# The tuner (start here)

```bash
node tools/filter-lab/server.cjs
```

Open <http://localhost:5678>. Move a slider, the photo updates immediately —
rendering happens on your GPU via WebGL, so it is live rather than a re-render
you wait for.

- **34 sliders**, one per preset value, grouped as the preset is.
- **Hold <kbd>space</kbd>** to see the untouched original.
- **Variation** cycles the per-photo randomiser, so you can check a setting
  across several photos' worth of dice rather than one lucky roll.
- **Source size / 4032px** — grain and dust are sized relative to the frame, so
  the resolution you judge them at matters. Pick 4032px to see them as a saved
  photo will.
- The **date stamp** field takes any imprint text; the Date stamp group below
  tunes its size, position, colour, glow and bleed. Clear the field to render
  without it.
- Changed sliders turn amber, and the status line counts what is unsaved.
- **Reset all** returns every slider to the file's values.
- **Save** writes only the values you changed back into
  `disposable-preset.ts`, in place, leaving its comments intact. It prints what
  it wrote to the terminal.

## Your own photos

**Upload a photo…**, or drag one anywhere onto the window. It renders straight
away — the file stays in the browser and nothing is written to disk. Press
**Keep for next time** if you want it saved into `tools/filter-lab/images/` so
it is in the picker on future runs. (Dropping files into that folder by hand
works too.)

Worth doing early: every bundled sample is warm-lit wedding photography and not
one has a blue sky, so they systematically flatter a warm preset.

Uploads are decoded by the browser rather than by Skia, which matters for
photos straight off a phone: the browser applies the EXIF orientation tag, so a
portrait shot is upright instead of on its side, and it can read whatever
formats it knows. **HEIC works in Safari but not in Chrome** — Chrome has no
HEIC decoder, and neither does Skia, so the tuner says so plainly rather than
failing quietly. Export as JPEG, or use Safari.

---

# The command-line renderer

For batches, side-by-side sheets, and value sweeps.

## Compare original vs filtered

```bash
node tools/filter-lab/lab.cjs
```

Writes an `original | filtered` pair for each sample photo in `assets/` into
`tools/filter-lab/out/` (gitignored). One image at a time:

```bash
node tools/filter-lab/lab.cjs assets/images/placeholders/hindu_wedding.png
```

## Sweep a value

Renders the same photo at several values of one field, tiled left to right.
The field is a dotted path into the recipe, which mirrors the preset:

```bash
node tools/filter-lab/lab.cjs <image> grain.intensity 0.02,0.032,0.05
node tools/filter-lab/lab.cjs <image> tone.contrast 0.14,0.22,0.30
node tools/filter-lab/lab.cjs <image> colour.blueDensity 0.06,0.13,0.20
node tools/filter-lab/lab.cjs <image> vignette.strength 0,0.11,0.25
node tools/filter-lab/lab.cjs <image> dust.opacity 0.1,0.26,0.5
node tools/filter-lab/lab.cjs <image> lightLeak.opacity 0.05,0.12,0.25
```

Every group in the preset is sweepable: `tone`, `colour`, `grain`, `softness`,
`vignette`, `dust`, `scratches`, `lightLeak`. The optional layers are absent on
most seeds — sweeping into one materialises it at its preset base rather than
making you hunt for a seed that happens to have it.

## Choosing a render size

Grain and dust are sized relative to the frame, so **the resolution you render
at decides what they look like**. By default the lab renders at the source
image's own size; the samples are 1024px, which is well below the size a phone
photo exports at, and the minimum-cell floor makes grain coarser there than in a
saved file.

To judge either as they will actually be saved, force the size:

```bash
node tools/filter-lab/lab.cjs <image> grain.intensity 0.02,0.032,0.05 --size=4032
```

Above tile size the lab clips to a 1:1 window in the middle of the frame, so a
4032px sweep costs about the same as a small one and shows grain at its true
pixel size instead of resampling it away.

## Tuning

Every number lives in `src/features/media/disposable-preset.ts`. Change one,
re-run, look. Nothing in the rendering pipeline needs touching to change the
look — that separation is the point of the file.

Values that vary per photo are written `{ base, vary }`, where `vary` is a ±
fraction of `base`. A sweep sets the resolved value directly, so it ignores
`vary`; move `base` once you have picked a number.

## What it actually runs

The real modules — `disposable-recipe.ts`, `disposable-uniforms.ts`,
`disposable-paint.ts` and the shader in `disposable-shader.ts` — compiled to
CommonJS and run against `canvaskit-wasm`, which is the same Skia the app uses,
compiled to WebAssembly. `skia-shim.cjs` only adapts the handful of API shape
differences between React Native Skia and CanvasKit; no filter logic lives
there. So what this renders is what the app renders.

One caveat worth knowing: **timing here means nothing.** CanvasKit's CPU backend
interprets SkSL and is orders of magnitude slower than the GPU path a device
takes. Use it to compare the relative cost of layers, never to predict how long
an export takes on a phone.
