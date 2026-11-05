/**
 * Puts the App Clip card on the guest routes, and keeps every other page free
 * of app banners.
 *
 * The site shows no Smart App Banner: it sent people to the Clip rather than
 * the App Store, and took height from the homepage. An invitation is the
 * exception, because launching the Clip from Safari and Messages is the point
 * of that page, and this tag is what does it.
 *
 * The export writes one HTML file per route, so the tag is added here, to the
 * invitation and event-code routes alone. Runs after `expo export`; see
 * `vercel.json`'s build command.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
/** Routes where launching the Clip is the point of the page. */
const GUEST_ROUTE_DIRS = ['j', 'e'];
const CARD =
  '<meta name="apple-itunes-app" content="app-clip-display=card, app-id=6797053710, app-clip-bundle-id=com.potoevents.eventcamera.Clip"/>';

let patched = 0;

for (const entry of readdirSync(DIST, { withFileTypes: true, recursive: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

  const file = join(entry.parentPath ?? entry.path ?? DIST, entry.name);
  const html = readFileSync(file, 'utf8');
  const isGuestRoute = GUEST_ROUTE_DIRS.includes(relative(DIST, file).split(sep)[0]);

  if (!isGuestRoute) {
    if (html.includes('apple-itunes-app')) {
      throw new Error(`${file} would show an app banner. Only guest routes may.`);
    }
    continue;
  }

  if (!html.includes('</head>')) {
    throw new Error(`No head to add the App Clip card to in ${file}.`);
  }
  writeFileSync(file, html.replace('</head>', `${CARD}</head>`), 'utf8');
  patched += 1;
}

if (patched === 0) {
  throw new Error('No guest route pages were found to show the App Clip card on.');
}

console.log(`App Clip card enabled on ${patched} guest page${patched === 1 ? '' : 's'}.`);
