#!/usr/bin/env node
/**
 * Bakes the sample-album photos into the story's web assets.
 *
 *   SHARP_PATH=/path/to/sharp node scripts/story/bake-photos.mjs
 *
 * `print-*` carries a simplified offline version of the app's Disposable look
 * (warm flash colour, grain, soft vignette) and the real date-stamp geometry from
 * `src/features/media/disposable-date-stamp.ts`. `raw-*` is the untreated frame
 * for the camera viewfinder, and `blur-*` and `raw-*-b` are tiny blurred stand-ins for
 * the locked cells and the glass. Runs on Node's native TypeScript stripping.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { STAMP_METRICS, formatDisposableDateStamp, layoutDateStamp } from '../../src/features/media/disposable-date-stamp.ts';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH ?? 'sharp');

const SRC = 'assets/sample-event';
const OUT = 'public/story/photo';
mkdirSync(OUT, { recursive: true });

// Vertical focus for the 3:4 crop, tuned by eye so faces aren't cut.
const PHOTOS = [
  ['p01', '01.jpg', 0.35], ['p02', '02.jpg', 0.45], ['p03', '03.jpg', 0.3], ['p04', '04.jpg', 0.42],
  ['p05', '05.jpg', 0.3], ['p06', '06.jpg', 0.32], ['p07', '07.jpg', 0.3], ['p08', '08.png', 0.3],
  ['p10', '10.png', 0.5], ['p11', '11.png', 0.55], ['p12', 'Codex Image 21 Sept 2026, 11_42_34.png', 0.3],
  ['p13', 'amelia-and-james-cover.jpg', 0.3], ['p14', 'cover.jpg', 0.55],
];

const W = 720, H = 960;

function stampSvg(text) {
  const { glyphs, width } = layoutDateStamp(text, STAMP_METRICS);
  const size = H * 0.033, x0 = W - W * 0.06 - width * size, y0 = H - H * 0.05 - size;
  const polys = glyphs.flatMap((g) => g.polygons.map((p) => {
    const pts = [];
    for (let i = 0; i < p.length; i += 2) pts.push(`${(x0 + (g.x + p[i]) * size).toFixed(1)},${(y0 + p[i + 1] * size).toFixed(1)}`);
    return `<polygon points="${pts.join(' ')}"/>`;
  })).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><filter id="b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${size * 0.28}"/></filter><filter id="s"><feGaussianBlur stdDeviation="0.55"/></filter></defs>
    <g fill="#ff5214" opacity=".55" filter="url(#b)">${polys}</g><g fill="#ff7c38" opacity=".96" filter="url(#s)">${polys}</g></svg>`);
}

const vignette = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="48%" r="72%"><stop offset="62%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#120804" stop-opacity=".42"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`);

function grain(seed) {
  const buf = Buffer.alloc((W >> 1) * (H >> 1));
  let s = seed;
  for (let i = 0; i < buf.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; buf[i] = 128 + ((s >>> 24) - 128) * 0.34; }
  return sharp(buf, { raw: { width: W >> 1, height: H >> 1, channels: 1 } }).resize(W, H, { kernel: 'cubic' }).toColourspace('srgb').png().toBuffer();
}

const text = formatDisposableDateStamp(new Date(2026, 5, 12));

for (const [id, file, focus] of PHOTOS) {
  const src = sharp(join(SRC, file));
  const meta = await src.metadata();
  // Scale to cover the 3:4 frame whichever way the source is shaped.
  const scale = Math.max(W / meta.width, H / meta.height);
  const scaledW = Math.ceil(meta.width * scale);
  const scaledH = Math.ceil(meta.height * scale);
  const top = Math.max(0, Math.min(scaledH - H, Math.round(scaledH * focus - H / 2)));
  const left = Math.round((scaledW - W) / 2);
  const base = await sharp(join(SRC, file)).resize(scaledW, scaledH).extract({ left, top, width: W, height: H }).toBuffer();

  const treated = await sharp(base)
    .recomb([[1.08, 0.02, -0.02], [0.01, 1.0, 0.0], [-0.03, 0.02, 0.92]])
    .linear(1.08, -8)
    .modulate({ saturation: 1.07 })
    .composite([
      { input: vignette, blend: 'multiply' },
      { input: await grain(id.charCodeAt(2) * 7919), blend: 'soft-light' },
      { input: stampSvg(text) },
    ])
    .toBuffer();
  await sharp(treated).webp({ quality: 74, effort: 6 }).toFile(join(OUT, `print-${id}.webp`));
  await sharp(treated).resize({ width: 360 }).webp({ quality: 70, effort: 6 }).toFile(join(OUT, `print-${id}-s.webp`));
  // The album cover fills the phone's whole width, so it gets more pixels than the rest.
  const rawWidth = id === 'p13' ? 900 : 640;
  await sharp(join(SRC, file)).resize({ width: rawWidth }).webp({ quality: id === 'p13' ? 78 : 74, effort: 6 }).toFile(join(OUT, `raw-${id}.webp`));
  // Already blurred, and small: the locked cells and the glass stretch these instead of
  // paying for a live CSS blur on every frame the phone moves.
  await sharp(treated).resize({ width: 48 }).blur(1.5).webp({ quality: 60 }).toFile(join(OUT, `blur-${id}.webp`));
  await sharp(join(SRC, file)).resize({ width: 56 }).blur(1.5).webp({ quality: 60 }).toFile(join(OUT, `raw-${id}-b.webp`));
  // The counter's close-up fills the screen, so its viewfinder needs the extra pixels.
  if (id === 'p03') await sharp(join(SRC, file)).resize({ width: 1240 }).modulate({ saturation: 0 }).webp({ quality: 58, effort: 6 }).toFile(join(OUT, `raw-${id}-l.webp`));
  console.log(id);
}
