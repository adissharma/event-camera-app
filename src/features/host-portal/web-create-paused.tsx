import { Redirect } from 'expo-router';

/**
 * Stands in for the web create-and-pay screens while web checkout is off, so an
 * old or typed link lands on the host portal. To bring web checkout back, point
 * `routes.web.ts` at `features/web-create` again, restore the links in the portal
 * and remove its three endpoints from `.vercelignore`.
 */
export default function WebCreatePaused() {
  return <Redirect href="/host" />;
}
