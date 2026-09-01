#!/usr/bin/env node
/*
 * Renders the Disposable filter on real images, under Node, in about a second.
 *
 * The alternative when tuning is to rebuild the app, deploy it to a device,
 * take a photo and squint — which is slow enough that it stops happening, and
 * a preset nobody re-checks drifts. This runs the *actual* modules
 * (`disposable-recipe`, `disposable-uniforms`, `disposable-paint`, and the
 * shader itself) against canvaskit-wasm, so what comes out is what the app
 * renders, not an approximation of it.
 *
 *   node tools/filter-lab/lab.cjs                       compare every sample
 *   node tools/filter-lab/lab.cjs <image>               compare one image
 *   node tools/filter-lab/lab.cjs <image> grain.intensity 0.02,0.03,0.05
 *                                                       sweep one recipe field
 *
 * Output lands in tools/filter-lab/out/ and is gitignored.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
const MEDIA = path.join(ROOT, 'src/features/media');

const SAMPLES = [
  'assets/images/placeholders/christian_wedding.png',
  'assets/images/placeholders/hindu_wedding.png',
  'assets/images/placeholders/treatment_preview_1.png',
  'assets/images/placeholders/treatment_preview_2.png',
  'assets/images/placeholders/create_event_cover.png',
];

/**
 * Compiles the filter modules to CommonJS in a temp directory, with the Skia
 * import redirected at the shim. Done on every run rather than cached, because
 * a stale build is exactly the way a tuning session ends up looking at numbers
 * it is no longer using.
 */
function buildModules() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-lab-'));
  fs.mkdirSync(path.join(dir, 'node_modules/@shopify/react-native-skia'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'node_modules/@shopify/react-native-skia/package.json'),
    JSON.stringify({ name: '@shopify/react-native-skia', version: '0.0.0-lab', main: 'index.js' }),
  );
  fs.copyFileSync(
    path.join(__dirname, 'skia-shim.cjs'),
    path.join(dir, 'node_modules/@shopify/react-native-skia/index.js'),
  );
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'CommonJS',
        moduleResolution: 'node10',
        // node10 resolution is deprecated and errors without this, even though
        // it still emits. CommonJS output is what Node needs to require these.
        ignoreDeprecations: '6.0',
        outDir: 'build',
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
        rootDir: MEDIA,
        types: [],
      },
      files: [path.join(MEDIA, 'disposable-paint.ts')],
    }),
  );
  try {
    execFileSync(path.join(ROOT, 'node_modules/.bin/tsc'), ['-p', dir], { encoding: 'utf8' });
  } catch (error) {
    // tsc reports on stdout, and the raw exec error prints it as a byte buffer.
    throw new Error(`the filter modules did not compile:\n${error.stdout ?? error.message}`);
  }
  return dir;
}

/**
 * A layer at its preset base values, for sweeping a field on a photo whose
 * seed left that layer out. Read from the preset rather than written out here,
 * so these cannot drift from the real defaults.
 */
function makeDefaultLayer(preset) {
  const base = (varied) => varied.base;
  return (group) => {
    if (group === 'dust') {
      return {
        opacity: base(preset.dust.opacity),
        density: base(preset.dust.density),
        size: base(preset.dust.size),
        darkRatio: preset.dust.darkRatio,
        seed: 12.3,
      };
    }
    if (group === 'scratches') {
      return {
        opacity: base(preset.scratches.opacity),
        width: base(preset.scratches.width),
        seed: 41,
      };
    }
    if (group === 'lightLeak') {
      const edge = preset.lightLeak.edges[0];
      return {
        opacity: base(preset.lightLeak.opacity),
        spread: base(preset.lightLeak.spread),
        colour: preset.lightLeak.colours[0],
        origin: edge.origin,
        direction: edge.direction,
        edge: edge.name,
      };
    }
    return null;
  };
}

async function main() {
  let CanvasKitInit;
  try {
    CanvasKitInit = require(path.join(ROOT, 'node_modules/canvaskit-wasm/bin/full/canvaskit.js'));
  } catch {
    console.error('canvaskit-wasm is not installed. Run `npm install canvaskit-wasm`.');
    process.exit(1);
  }

  const CK = await CanvasKitInit({
    locateFile: (file) => path.join(ROOT, 'node_modules/canvaskit-wasm/bin/full/', file),
  });

  const dir = buildModules();
  const shim = require(path.join(dir, 'node_modules/@shopify/react-native-skia'));
  shim.__setCanvasKit(CK);
  const { buildDisposableRecipe } = require(path.join(dir, 'build/disposable-recipe.js'));
  const { buildDisposablePaint } = require(path.join(dir, 'build/disposable-paint.js'));
  const { DISPOSABLE_PRESET } = require(path.join(dir, 'build/disposable-preset.js'));
  const { drawDisposableDateStamp } = require(path.join(dir, 'build/disposable-stamp.js'));
  const defaultLayer = makeDefaultLayer(DISPOSABLE_PRESET);

  fs.mkdirSync(OUT, { recursive: true });

  const surface = (w, h) => {
    const s = CK.MakeSurface(w, h);
    if (!s) throw new Error(`could not allocate a ${w}x${h} surface`);
    return s;
  };
  const encode = (s) => Buffer.from(s.makeImageSnapshot().encodeToBytes(CK.ImageFormat.PNG, 100));
  const decode = (file) => {
    const image = CK.MakeImageFromEncoded(fs.readFileSync(file));
    if (!image) throw new Error(`could not decode ${file}`);
    return image;
  };

  /**
   * Renders the filter over a `w` x `h` frame.
   *
   * `window` asks for only a square of that frame, at 1:1. The shader still
   * receives the full frame's coordinates, so grain, dust and the vignette are
   * sized exactly as they would be in a real render of that size — but Skia
   * only shades inside the clip. Without this, previewing grain at export
   * resolution means rasterising twelve megapixels on a WASM CPU backend,
   * which takes minutes per tile.
   */
  const render = (image, recipe, w, h, window) => {
    const { paint } = buildDisposablePaint(image, recipe, {
      width: w,
      height: h,
      // The offscreen surface is measured in real pixels, as an export is.
      devicePixelRatio: 1,
    });
    const stamp = process.env.STAMP;
    const stampOn = (canvas) => {
      if (!stamp) return;
      drawDisposableDateStamp(canvas, {
        width: w, height: h, text: stamp,
        style: DISPOSABLE_PRESET.dateStamp, seed: recipe.grain.seed,
      });
    };
    if (!window || w <= window) {
      const s = surface(w, h);
      s.getCanvas().drawRect(CK.XYWHRect(0, 0, w, h), paint);
      stampOn(s.getCanvas());
      return { surface: s, sx: 0, sy: 0, sw: w, sh: h };
    }
    const x = (w - window) / 2;
    const y = (h - window) / 2;
    const s = surface(window, window);
    const canvas = s.getCanvas();
    canvas.translate(-x, -y);
    canvas.clipRect(CK.XYWHRect(x, y, window, window), CK.ClipOp.Intersect, false);
    canvas.drawRect(CK.XYWHRect(0, 0, w, h), paint);
    stampOn(canvas);
    return { surface: s, sx: 0, sy: 0, sw: window, sh: window };
  };

  const args = process.argv.slice(2);
  // Grain and dust are sized relative to the frame, so which resolution you
  // render at decides what they look like. Default to the source's own size;
  // pass --size to judge them as a full-resolution export would show them.
  const sizeArg = args.find((arg) => arg.startsWith('--size='));
  const forcedWidth = sizeArg ? Number(sizeArg.split('=')[1]) : null;
  const [target, field, valuesArg] = args.filter((arg) => !arg.startsWith('--'));

  if (field) {
    // Sweep one field across several values, tiled left to right.
    const file = path.resolve(ROOT, target);
    const image = decode(file);
    const values = valuesArg.split(',').map(Number);
    const width = forcedWidth ?? image.width();
    const tile = 420;
    const sheet = surface(tile * values.length, tile);
    const canvas = sheet.getCanvas();
    canvas.clear(CK.WHITE);
    const blit = new CK.Paint();
    blit.setAntiAlias(true);

    values.forEach((value, index) => {
      const recipe = buildDisposableRecipe('filter-lab');
      const [group, key] = field.split('.');
      if (key) {
        // Dust, scratches and leaks are null on most seeds — that is the point
        // of them. Materialise the layer from its preset base so it can still
        // be swept, rather than making the caller hunt for a seed that
        // happens to have it.
        if (!recipe[group]) recipe[group] = defaultLayer(group);
        if (!recipe[group]) throw new Error(`unknown field: ${field}`);
        recipe[group][key] = value;
      } else {
        recipe[group] = value;
      }
      const height = Math.round((image.height() / image.width()) * width);
      // A 1:1 window into the middle once the render is bigger than the tile,
      // so grain and dust are shown at their true pixel size rather than
      // resampled away by a downscale.
      const rendered = render(image, recipe, width, height, tile);
      canvas.drawImageRect(
        rendered.surface.makeImageSnapshot(),
        CK.XYWHRect(rendered.sx, rendered.sy, rendered.sw, rendered.sh),
        CK.XYWHRect(index * tile, 0, tile, tile),
        blit,
      );
    });

    const out = path.join(OUT, `sweep-${field.replace(/\./g, '-')}.png`);
    fs.writeFileSync(out, encode(sheet));
    console.log(`${out}\n${values.join('  |  ')}`);
    return;
  }

  // Otherwise: original beside filtered, for each sample.
  const files = target ? [target] : SAMPLES;
  for (const relative of files) {
    const file = path.resolve(ROOT, relative);
    if (!fs.existsSync(file)) {
      console.log(`skipped (missing): ${relative}`);
      continue;
    }
    const image = decode(file);
    const iw = forcedWidth ?? image.width();
    const ih = forcedWidth
      ? Math.round((image.height() / image.width()) * forcedWidth)
      : image.height();
    const seed = path.basename(relative, path.extname(relative));
    const recipe = buildDisposableRecipe(seed);
    const rendered = render(image, recipe, iw, ih);

    const width = 520;
    const scale = width / iw;
    const w = Math.round(iw * scale);
    const h = Math.round(ih * scale);
    const sheet = surface(w * 2 + 8, h);
    const canvas = sheet.getCanvas();
    canvas.clear(CK.WHITE);
    const blit = new CK.Paint();
    blit.setAntiAlias(true);
    canvas.drawImageRect(image, CK.XYWHRect(0, 0, iw, ih), CK.XYWHRect(0, 0, w, h), blit);
    canvas.drawImageRect(
      rendered.surface.makeImageSnapshot(),
      CK.XYWHRect(0, 0, iw, ih),
      CK.XYWHRect(w + 8, 0, w, h),
      blit,
    );

    const out = path.join(OUT, `${seed}.png`);
    fs.writeFileSync(out, encode(sheet));
    console.log(
      `${out}  ${iw}x${ih}  ` +
        `leak:${recipe.lightLeak ? recipe.lightLeak.edge : '-'}  ` +
        `dust:${recipe.dust ? recipe.dust.opacity.toFixed(2) : '-'}  ` +
        `grain:${recipe.grain.intensity.toFixed(3)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
