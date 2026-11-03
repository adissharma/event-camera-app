import { useEffect } from 'react';

import { useDocumentTitle } from '@/components/brand/use-document-title';
import { bootStory } from '@/features/marketing/story/boot';
import { ASSET } from '@/features/marketing/story/content';
import { StoryMarkup } from '@/features/marketing/story/story-site';

/**
 * The homepage, when reached inside the running web app.
 *
 * A direct visit to `/` never gets here: the deploy replaces `dist/index.html`
 * with the static page from `scripts/story/build-home.mjs`, which needs no app
 * bundle. This covers navigating to `/` from another route, and `expo start`.
 */
export default function WebHome() {
  useDocumentTitle('Stills - Events Camera App');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('story-live');
    const root = document.querySelector<HTMLElement>('.story');
    const stop = root ? bootStory(root) : undefined;
    return () => {
      stop?.();
      document.documentElement.classList.remove('story-live');
    };
  }, []);

  return (
    <>
      <link rel="stylesheet" href={`${ASSET}/story.css`} />
      <StoryMarkup />
    </>
  );
}
