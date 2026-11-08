#!/usr/bin/env node
/**
 * Builds the static homepage into public/story/.
 *
 *   ESBUILD_PATH=/path/to/esbuild node scripts/story/build-home.mjs
 *
 * Output: `home.html` (the pre-rendered page) and `story.js` (its only script).
 * Both are committed, so a deploy needs no extra tooling. Re-run after changing
 * anything in src/features/marketing/story. `install-home.mjs` copies the page
 * over dist/index.html after `expo export`.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD_PATH ?? 'esbuild');
const STORY = 'src/features/marketing/story';

await esbuild.build({
  entryPoints: [`${STORY}/entry.ts`],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  outfile: 'public/story/story.js',
});

const server = await esbuild.build({
  entryPoints: [`${STORY}/story-site.tsx`],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
});
const mod = { exports: {} };
new Function('module', 'exports', 'require', server.outputFiles[0].text)(mod, mod.exports, require);

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const body = renderToStaticMarkup(React.createElement(mod.exports.StoryMarkup));

const TITLE = 'Stills: the shared camera app for weddings and parties';
const DESCRIPTION = 'Guests scan a QR code and start shooting, with nothing to download. Every photo, video and voice message lands in one album.';
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://stills.events/">
<meta property="og:image" content="https://stills.events/story/poster/share.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#7A22B8">
<link rel="icon" href="/favicon.ico">
<link rel="preload" href="/story/art/room.webp" as="image" fetchpriority="high" media="(min-width: 760px)">
<link rel="preload" href="/story/art/room.m.webp" as="image" fetchpriority="high" media="(max-width: 759px)">
<link rel="preload" href="/story/fonts/isolde-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/story/fonts/instrument-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/story/story.css">
<script>${mod.exports.STORY_HEAD_SCRIPT}</script>
<script src="/story/story.js" defer></script>
</head>
<body>${body}</body>
</html>
`;
writeFileSync('public/story/home.html', html);
console.log('home.html', html.length, 'story.js built');
