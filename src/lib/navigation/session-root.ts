import type { Href, ImperativeRouter } from 'expo-router';

type SessionRouter = Pick<ImperativeRouter, 'dismissAll' | 'replace'>;

/**
 * A session boundary must not leave routes from the previous session below it.
 * `dismissAll` returns the single root stack to its first route before that
 * route is replaced with the destination.
 */
export function resetToSessionRoot(router: SessionRouter, href: Href): void {
  router.dismissAll();
  router.replace(href);
}

export function resetToAuthenticatedRoot(router: SessionRouter, href: Href = '/home'): void {
  resetToSessionRoot(router, href);
}

export function resetToUnauthenticatedRoot(router: SessionRouter): void {
  resetToSessionRoot(router, '/');
}
