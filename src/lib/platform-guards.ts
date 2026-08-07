import { Platform } from 'react-native';
import { IS_APP_CLIP } from '@/config/app-config';

/**
 * Platform detection utilities for enforcing guest-only experiences.
 * Web and App Clip = guest-only. Native (full app) = host + guest.
 *
 * These are NOT what keeps host code out of the App Clip — that is structural.
 * The Clip builds against the `src/app-clip` route tree (see `app.config.js`),
 * so host screens and their assets are never bundled. What remains here is
 * second-line hardening for host controls inside screens that both variants
 * share, such as the event page.
 */

export const isWeb = Platform.OS === 'web';

export const isNative = !isWeb;

/**
 * Whether the current platform should only show guest features.
 * Web = guest-only. App Clip = guest-only. Native full app = host + guest.
 */
export const isGuestOnlyPlatform = isWeb || IS_APP_CLIP;

/**
 * Guard: Use in layouts and screens to block host-only routes on web or App Clip.
 * Returns true if the route should be accessible on this platform.
 *
 * Example:
 *   if (!allowHostRouteOnWeb()) {
 *     router.replace('/j/');
 *   }
 */
export function allowHostRouteOnWeb(): boolean {
  return isNative && !IS_APP_CLIP;
}

/**
 * Guard: Check if user should see host controls on a shared screen.
 * On web or App Clip, never show host controls. On full native app, depends on role.
 */
export function shouldShowHostControls(userRole?: 'host' | 'guest'): boolean {
  if (isGuestOnlyPlatform) return false;
  return userRole === 'host';
}

/**
 * Guard: Check if a route should redirect to guest fallback on web or App Clip.
 * Used in layouts that are host-only.
 */
export function shouldBlockHostRouteOnWeb(platform: typeof Platform.OS): boolean {
  return platform === 'web' || IS_APP_CLIP;
}
