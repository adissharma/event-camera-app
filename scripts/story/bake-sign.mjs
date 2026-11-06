#!/usr/bin/env node
/**
 * Draws the seating sign into the QR easel's board, so the words are part of the print.
 *
 *   PLAYWRIGHT_PATH=/path/to/playwright-core SHARP_PATH=/path/to/sharp node scripts/story/bake-sign.mjs
 *
 * The generated easel's board holds a made-up code and no words. This paints the inside of
 * its frame clean, then lays "Find your table", the page's real code and the Stills logo
 * onto it in black ink, warped to the board's four corners so it sits at the drawing's angle.
 * The result goes through process-art.mjs like any other drawing. Local tool only.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH ?? 'sharp');
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright-core');

const SOURCE = 'assets/story-source';
const FROM = join(SOURCE, 'easel-qr.png');
const TO = join(SOURCE, 'easel-sign.png');
/** The inside of the board's black frame, in the drawing's pixels: top left, top right, bottom right, bottom left. */
const BOARD = [[286, 214], [740, 244], [786, 820], [312, 824]];
/** The sign is laid out flat at this size, then warped onto the board. */
const SIGN = { w: 780, h: 1000 };

const font = readFileSync('public/story/fonts/isolde-regular.woff2').toString('base64');
const qr = readFileSync('public/story/qr-invite.svg').toString('base64');
const logo = readFileSync('public/story/logo.webp').toString('base64');
const html = `<!doctype html><html><head><style>
@font-face { font-family: Isolde; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html, body { margin: 0; background: #fff; }
.s { width: ${SIGN.w}px; height: ${SIGN.h}px; box-sizing: border-box; padding: 70px 70px 64px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
p { margin: 0; font: 96px/1 Isolde, serif; color: #000; white-space: nowrap; }
.qr { width: 560px; height: 560px; }
.logo { width: 250px; filter: brightness(0); }
</style></head><body><div class="s">
<p>Find your table</p>
<img class="qr" src="data:image/svg+xml;base64,${qr}">
<img class="logo" src="data:image/webp;base64,${logo}">
</div></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: SIGN.w, height: SIGN.h } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const shot = await page.screenshot({ clip: { x: 0, y: 0, width: SIGN.w, height: SIGN.h } });
await browser.close();

const sign = await sharp(shot).greyscale().raw().toBuffer();
const { data, info } = await sharp(FROM).flatten({ background: '#fff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width;

/** Where a point in the board lands on the flat sign (inverse bilinear), or null outside it. */
function toSign(x, y) {
  const [a, b, c, d] = BOARD;
  const e = [b[0] - a[0], b[1] - a[1]], f = [d[0] - a[0], d[1] - a[1]];
  const g = [a[0] - b[0] + c[0] - d[0], a[1] - b[1] + c[1] - d[1]], h = [x - a[0], y - a[1]];
  const cross = (p, q) => p[0] * q[1] - p[1] * q[0];
  const k2 = cross(g, f), k1 = cross(e, f) + cross(h, g), k0 = cross(h, e);
  let v;
  if (Math.abs(k2) < 1e-9) v = -k0 / k1;
  else {
    const disc = k1 * k1 - 4 * k0 * k2;
    if (disc < 0) return null;
    v = (-k1 - Math.sqrt(disc)) / (2 * k2);
    if (v < 0 || v > 1) v = (-k1 + Math.sqrt(disc)) / (2 * k2);
  }
  const denX = e[0] + g[0] * v, denY = e[1] + g[1] * v;
  const u = Math.abs(denX) > Math.abs(denY) ? (h[0] - f[0] * v) / denX : (h[1] - f[1] * v) / denY;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
}

const xs = BOARD.map((p) => p[0]), ys = BOARD.map((p) => p[1]);
for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
  for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
    const uv = toSign(x, y);
    if (!uv) continue;
    const sx = Math.min(SIGN.w - 1, Math.round(uv[0] * (SIGN.w - 1)));
    const sy = Math.min(SIGN.h - 1, Math.round(uv[1] * (SIGN.h - 1)));
    data[y * W + x] = sign[sy * SIGN.w + sx];
  }
}

await sharp(data, { raw: { width: W, height: info.height, channels: 1 } }).png().toFile(TO);
console.log(`Sign drawn into ${resolve(TO)}`);
