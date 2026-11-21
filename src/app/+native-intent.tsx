/**
 * Keeps the OAuth return link away from the router.
 *
 * Google and Apple sign-in end by opening `eventcamera://auth/callback?...`.
 * On iOS the sign-in sheet catches that link itself. On Android it reaches the
 * app as an ordinary deep link as well, so Expo Router tried to show a page
 * for `/auth/callback`, had none, and flashed "Unmatched route" before the
 * screen the host was on came back. `expo-web-browser` reads the link through
 * its own listener, so dropping it here does not interrupt sign-in.
 *
 * Every other link passes through unchanged.
 */
const OAUTH_CALLBACK = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\/?auth\/callback(?:[/?#]|$)/i;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (!OAUTH_CALLBACK.test(path)) return path;
  // A link that arrives while the app is open is dropped, leaving the host where
  // they were. One that launched the app has nowhere to stay, so it goes home.
  return initial ? '/' : null;
}
