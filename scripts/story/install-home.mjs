/**
 * Makes the static story the page served at `/`. Runs after `expo export`; see
 * `vercel.json`'s build command.
 */
import { copyFileSync } from 'node:fs';

copyFileSync('dist/story/home.html', 'dist/index.html');
console.log('Installed the story homepage at dist/index.html.');
