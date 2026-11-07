#!/usr/bin/env node
/**
 * The displacement map behind the phone mock's Liquid Glass card.
 *
 *   SHARP_PATH=/path/to/sharp node scripts/story/bake-glass-map.mjs
 *
 * On iOS 26 the app's event card is the system's Liquid Glass (`EventGlass` in
 * src/components/ui/event-glass.tsx), which bends the cover where it meets the card's rim.
 * The page can't use the system's material, so it bends its copy of the cover with an SVG
 * displacement filter instead. This map tells the filter which way to look: within a band
 * along the top and sides, and round the top corners, each pixel reads from a little further
 * inside the card, strongest at the edge, as glass refracts. Red is across, green is down,
 * and mid-grey is no change. The card's bottom carries on into the gallery, so it has no rim.
 */
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH ?? 'sharp');

const W = 392;
const H = 300;
/** The card's top corners, as in EventGlass. */
const RADIUS = 32;
/** How far in from the rim the bending reaches. */
const BAND = 40;

const data = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // Distance to the rim, and which way is inward from it.
    let d, nx, ny;
    const cx = x < RADIUS ? RADIUS : x > W - RADIUS ? W - RADIUS : null;
    if (cx !== null && y < RADIUS) {
      const vx = x - cx, vy = y - RADIUS, len = Math.hypot(vx, vy) || 1;
      d = RADIUS - len;
      nx = -vx / len;
      ny = -vy / len;
    } else {
      const edges = [[x, 1, 0], [W - 1 - x, -1, 0], [y, 0, 1]];
      [d, nx, ny] = edges.reduce((a, b) => (b[0] < a[0] ? b : a));
    }
    const f = d < 0 ? 0 : Math.max(0, 1 - d / BAND) ** 2.4;
    const o = (y * W + x) * 3;
    data[o] = Math.round(128 + 127 * nx * f);
    data[o + 1] = Math.round(128 + 127 * ny * f);
    data[o + 2] = 128;
  }
}

await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile('public/story/glass-map.png');
console.log('Wrote public/story/glass-map.png');
