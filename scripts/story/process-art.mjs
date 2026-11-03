#!/usr/bin/env node
/**
 * Turns the black-on-white prints into the transparent art the page uses.
 *
 *   node scripts/story/process-art.mjs [ids...]
 *
 * Figures get a silhouette alpha so nothing shows through their white clothes,
 * the room loses its sky so the sunset shows behind it, and the clouds become a
 * white layer whose tones are transparency, so they pick up the sky's colour.
 * Night is drawn over all of it on the page, so each drawing needs one file.
 *
 * Needs `sharp`, which isn't an app dependency: SHARP_PATH points at any install.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH ?? 'sharp');

const SOURCE = 'assets/story-source';
const OUT = 'public/story/art';
const PAPER = [255, 251, 246];
const INK = [10, 9, 12];

const MANIFEST = 'src/features/marketing/story/art-manifest.ts';
const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

/** Merges with what's there, so processing one drawing keeps the others. */
const sizes = {};
if (existsSync(MANIFEST)) {
  const match = readFileSync(MANIFEST, 'utf8').match(/= (\{[\s\S]*\});/);
  if (match) Object.assign(sizes, JSON.parse(match[1]));
}

const mix = (a, b, t) => a + (b - a) * t;

/**
 * Flood-fills the outside from the borders; a dilated line closes small gaps.
 * With `topOnly` it starts from the top edge alone, which finds the room's sky.
 */
function silhouette(alphaLine, w, h, gap = 3, topOnly = false) {
  const blocked = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alphaLine[y * w + x] > 0.25) {
      for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) blocked[ny * w + nx] = 1;
      }
    }
  }
  const outside = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => { if (!outside[i] && !blocked[i]) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); if (!topOnly) push((h - 1) * w + x); }
  if (!topOnly) for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  // Grow the outside back by the same gap, so the edge returns to the line.
  const grown = new Uint8Array(outside);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!outside[y * w + x]) continue;
    for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
      if (dx * dx + dy * dy > gap * gap) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && alphaLine[ny * w + nx] < 0.35) grown[ny * w + nx] = 1;
    }
  }
  return grown;
}


async function clouds(id) {
  const { data, info } = await sharp(join(SOURCE, `${id}.png`)).flatten({ background: '#000' }).greyscale().resize({ width: 2400 }).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i++) {
    // Mid greys become a faint lighter pink; only the sunlit edges reach white.
    const alpha = ((data[i] / 255) ** 1.9) * 0.94;
    out[i * 4] = 255; out[i * 4 + 1] = 247; out[i * 4 + 2] = 242; out[i * 4 + 3] = alpha * 255;
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 70, alphaQuality: 62, effort: 6 }).toFile(join(OUT, `${id}.webp`));
  console.log(id, info.width, info.height);
}

async function run(id, { room }) {
  const file = join(SOURCE, `${id}.png`);
  const meta = await sharp(file).metadata();
  const width = room ? meta.width : Math.min(meta.width, 900);
  const res = await sharp(file).flatten({ background: '#fff' }).greyscale().resize({ width }).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = res;
  const w = info.width, h = info.height;
  const a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = Math.min(1, Math.max(0, (205 - data[i]) / 130));

  const outside = room ? silhouette(a, w, h, 2, true) : silhouette(a, w, h);
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < a.length; i++) {
    const t = a[i], o = i * 4;
    for (let c = 0; c < 3; c++) out[o + c] = mix(PAPER[c], INK[c], t);
    out[o + 3] = outside[i] ? 0 : 255;
  }
  const raw = { raw: { width: w, height: h, channels: 4 } };
  let crop = { left: 0, top: 0, width: w, height: h };
  if (!room) {
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!outside[y * w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    crop = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    sizes[id] = { w: crop.width, h: crop.height };
  }
  const q = room ? { quality: 70, alphaQuality: 70, effort: 6 } : { quality: 66, alphaQuality: 75, effort: 6 };
  await sharp(out, raw).extract(crop).webp(q).toFile(join(OUT, `${id}.webp`));
  if (room) {
    // Phones get a lighter plate.
    await sharp(out, raw).resize({ width: 2880 }).webp({ quality: 58, alphaQuality: 60, effort: 6 }).toFile(join(OUT, `${id}.m.webp`));
    // What the phone's camera sees behind the invitation.
    await sharp(out, raw).extract({ left: 0, top: 560, width: 1100, height: 880 }).flatten({ background: '#fe4d8d' }).resize({ width: 620 }).webp({ quality: 55, effort: 6 }).toFile(join(OUT, `${id}-entrance.webp`));
  }
  console.log(id, crop.width, crop.height);
}

const ids = readdirSync(SOURCE).filter((f) => f.endsWith('.png') && !f.includes('.draft')).map((f) => f.replace('.png', ''));
for (const id of ids) {
  if (only.length && !only.includes(id)) continue;
  if (!existsSync(join(SOURCE, `${id}.png`))) continue;
  if (id === 'clouds') await clouds(id);
  else await run(id, { room: id === 'room' });
}

writeFileSync(MANIFEST, `/** Written by scripts/story/process-art.mjs: the trimmed size of each figure drawing. */
export const ART_SIZES: Record<string, { w: number; h: number }> = ${JSON.stringify(sizes, null, 2)};
`);
