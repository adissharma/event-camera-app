import { Platform } from 'react-native';

/**
 * Platform detection utilities for enforcing web-only guest experience.
 */

export const isWeb = Platform.OS === 'web';

export const isNative = !isWeb;

/**
 * Whether the current platform should only show guest features.
 * Web = guest-only. Native = host + guest.
 */
export const isGuestOnlyPlatform = isWeb;

/**
 * Guard: Use in layouts and screens to block host-only routes on web.
 * Returns true if the route should be accessible on this platform.
 *
 * Example:
 *   if (!allowHostRouteOnWeb()) {
 *     router.replace('/j/');
 *   }
 */
export function allowHostRouteOnWeb(): boolean {
  return isNative;
}

/**
 * Guard: Check if user should see host controls on a shared screen.
 * On web, never show host controls. On native, depends on role.
 */
export function shouldShowHostControls(userRole?: 'host' | 'guest'): boolean {
  if (isWeb) return false;
  return userRole === 'host';
}

/**
 * Guard: Check if a route should redirect to guest fallback on web.
 * Used in layouts that are host-only.
 */
export function shouldBlockHostRouteOnWeb(platform: typeof Platform.OS): boolean {
  return platform === 'web';
}
