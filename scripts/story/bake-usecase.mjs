#!/usr/bin/env node
/**
 * Bakes the photos on the phone in each use case tab, from assets/story-source/usecase/.
 * Name them `<tab>-<n>`, cover first, then list them in `USE_CASES` in `content.ts`.
 *
 *   SHARP_PATH=/path/to/sharp node scripts/story/bake-usecase.mjs
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, parse } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH ?? 'sharp');

const SRC = 'assets/story-source/usecase';
const OUT = 'public/story/usecase';
mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(SRC)) {
  const { name } = parse(file);
  const isCover = name.endsWith('-1');
  await sharp(join(SRC, file)).resize({ width: isCover ? 840 : 480 }).webp({ quality: 74, effort: 6 }).toFile(join(OUT, `${name}.webp`));
  // Stretched behind the event page's glass, like the other covers.
  if (isCover) await sharp(join(SRC, file)).resize({ width: 56 }).blur(1.5).webp({ quality: 60 }).toFile(join(OUT, `${name}-b.webp`));
  console.log(name);
}
