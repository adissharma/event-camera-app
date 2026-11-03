import { bootStory } from './boot';

/** The homepage's only script. Loaded with `defer` by the static page. */
const root = document.querySelector<HTMLElement>('.story');
if (root && document.documentElement.classList.contains('story-live')) bootStory(root);
