#!/usr/bin/env node
/**
 * Converts the app's own brand fonts to WOFF2 for the story. WAWOFF2_PATH and
 * SUBSET_FONT_PATH point at any installs of `wawoff2` and `subset-font`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const wawoff = require(process.env.WAWOFF2_PATH ?? 'wawoff2');
const subset = require(process.env.SUBSET_FONT_PATH ?? 'subset-font');

// Only ever used for the stat strip's figures, and it's a big font.
const SUBSETS = { 'cormorant-italic': '0123456789,. ' };
const G = 'node_modules/@expo-google-fonts';
const FONTS = {
  'isolde-regular': 'assets/fonts/Isolde-Regular.ttf',
  'isolde-italic': 'assets/fonts/Isolde-Italic.ttf',
  'instrument-400': `${G}/instrument-sans/400Regular/InstrumentSans_400Regular.ttf`,
  'instrument-500': `${G}/instrument-sans/500Medium/InstrumentSans_500Medium.ttf`,
  'instrument-600': `${G}/instrument-sans/600SemiBold/InstrumentSans_600SemiBold.ttf`,
  'cormorant-italic': `${G}/cormorant-garamond/500Medium_Italic/CormorantGaramond_500Medium_Italic.ttf`,
};
mkdirSync('public/story/fonts', { recursive: true });
for (const [name, file] of Object.entries(FONTS)) {
  const source = readFileSync(file);
  const trimmed = SUBSETS[name] ? await subset(source, SUBSETS[name], { targetFormat: 'truetype' }) : source;
  const out = Buffer.from(await wawoff.compress(trimmed));
  writeFileSync(`public/story/fonts/${name}.woff2`, out);
  console.log(name, out.length);
}
