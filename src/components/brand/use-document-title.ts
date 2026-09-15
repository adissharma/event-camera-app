import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Names the browser tab.
 *
 * Expo Router's own routes into the document title all fail in this project:
 * `Stack.Screen`'s `title` option and `screenOptions.title` never reach the
 * document because the stack's header is hidden, `expo-router/head`'s `<Head>`
 * renders only while its route reports focus and these routes never did, and a
 * `<title>` in `+html.tsx` is outranked by the empty tag react-helmet injects
 * ahead of it. Each was tried and verified not to work.
 *
 * So the title is set where it is actually read. Native has no document, so
 * this is a no-op there.
 *
 * Note this only names the *tab*. The served HTML still carries helmet's empty
 * title, so a crawler or a link preview that does not run JavaScript sees no
 * title at all — worth revisiting if the page is ever shared for reach.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = title;
  }, [title]);
}
