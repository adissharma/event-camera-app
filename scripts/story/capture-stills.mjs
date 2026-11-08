#!/usr/bin/env node
/**
 * Captures one still per scene for the linear page (reduced motion, no JavaScript). The
 * first, the terrace at sunset with no words on it, also closes the page and is its share image.
 * The stills are the live stage itself, so they can't drift from the real art.
 *
 *   PLAYWRIGHT_PATH=/path/to/playwright-core SHARP_PATH=/path/to/sharp node scripts/story/capture-stills.mjs
 *
 * Needs the `story-static` server from .claude/launch.json, and Chrome installed.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright-core');
const sharp = require(process.env.SHARP_PATH ?? 'sharp');

mkdirSync('public/story/poster', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(process.env.STORY_URL ?? 'http://localhost:8090/', { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('.story')?.dataset.booted === '1');
await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('in-sky'), null, { timeout: 90000 });
await page.waitForTimeout(2500);
const WORDS_OFF = '.ch > *, .nav, .chapters, .scroll-hint, .hint-band { opacity: 0 !important; }';
await page.addStyleTag({ content: WORDS_OFF });
await page.evaluate(() => document.querySelector('.story').classList.add('in-phone'));

const { stills, unit } = await page.evaluate(() => {
  const root = document.querySelector('.story');
  return { stills: JSON.parse(root.dataset.stills), unit: Number(root.dataset.unit) };
});
// The first still also closes the page and is its share image, so the phone stays out of it.
const noPhone = await page.addStyleTag({ content: '.phone { display: none !important; }' });
for (const [name, t] of Object.entries(stills)) {
  await page.evaluate((y) => window.scrollTo(0, y), t * unit);
  await page.waitForFunction((want) => Math.abs(Number(document.querySelector('.story').dataset.t) - want) < 0.02, t, { timeout: 90000 });
  await page.waitForTimeout(500);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).webp({ quality: 74, effort: 6 }).toFile(`public/story/poster/${name}.webp`);
  if (name === 's1') await sharp(png).resize({ width: 1200 }).jpeg({ quality: 80 }).toFile('public/story/poster/share.jpg');
  if (name === 's1') await noPhone.evaluate((tag) => tag.remove());
  console.log(name, t);
}

await browser.close();
