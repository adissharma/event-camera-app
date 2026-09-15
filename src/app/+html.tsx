import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The HTML shell for the static web export.
 *
 * Applied at build time to every exported page, so what it sets is in the
 * served markup rather than painted in after the bundle boots — which is what
 * a crawler, a link preview and the tab before first paint all read.
 *
 * `expo-router/head`'s `<Head>` would be the per-route way to do this, but it
 * renders only while its route reports focus, and on these pages it never did:
 * the string reached the bundle and the document title stayed empty.
 *
 * Runs on the server only. Nothing here is interactive, and hooks do not work.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* No <title> here. Expo Router always renders one through
            react-helmet from the route's `title` option, and helmet's tag comes
            first in the head — so a title set here is simply ignored. The
            titles live on the routes in `_layout.tsx` instead. */}
        <meta
          name="description"
          content="Stills. turns your guests into your photographers. Every guest, every angle, one shared album."
        />

        {/* The canvas behind the app, so a slow bundle does not flash white
            before the near-black page paints. */}
        <meta name="theme-color" content="#0B0B0C" />
        <style dangerouslySetInnerHTML={{ __html: BACKGROUND }} />

        {/* Disables body scrolling on web, which keeps ScrollView components
            behaving as they do on native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BACKGROUND = `
body { background-color: #0B0B0C; }
`;
