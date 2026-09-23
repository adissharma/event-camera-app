/**
 * Shows the App Clip card, rather than a slim banner, on the guest routes.
 *
 * `src/app/+html.tsx` is one shell for every exported page, so the Smart App
 * Banner it carries is sitewide. `app-clip-display=card` cannot live there:
 * it covers the page with the App Clip card on a first visit, which is what an
 * invitation wants and the last thing the privacy policy wants — that page is
 * read by guests and by App Store reviewers.
 *
 * The export writes one HTML file per route, so the card is added here, to the
 * invitation and event-code routes alone. Runs after `expo export`; see
 * `vercel.json`'s build command.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
/** Routes where launching the Clip is the point of the page. */
const GUEST_ROUTE_DIRS = ['j', 'e'];
const BANNER = 'name="apple-itunes-app" content="';

let patched = 0;

for (const dir of GUEST_ROUTE_DIRS) {
  const root = join(DIST, dir);
  if (!existsSync(root)) continue;

  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

    const file = join(entry.parentPath ?? entry.path ?? root, entry.name);
    const html = readFileSync(file, 'utf8');

    if (!html.includes(BANNER)) {
      throw new Error(`No Smart App Banner in ${file}. Did +html.tsx change?`);
    }
    if (html.includes('app-clip-display=card')) continue;

    writeFileSync(
      file,
      html.replace(BANNER, `${BANNER}app-clip-display=card, `),
      'utf8',
    );
    patched += 1;
  }
}

if (patched === 0) {
  throw new Error('No guest route pages were found to show the App Clip card on.');
}

console.log(`App Clip card enabled on ${patched} guest page${patched === 1 ? '' : 's'}.`);
