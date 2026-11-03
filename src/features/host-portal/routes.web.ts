/**
 * The portal's screens, for the route files in `src/app/host`.
 *
 * The routes import this module rather than each screen because Metro discovers
 * routes with `require.context`, which bundles a `.web.tsx` route on every
 * platform. Resolving the platform here instead is what actually keeps the portal
 * out of the native app: iOS and Android get `routes.ts`.
 */
export { default as HostEventLayout } from './event-layout';
export { default as HostEventsScreen } from './events-screen';
export { default as HostGuestbookScreen } from './guestbook-screen';
export { default as HostGuestsScreen } from './guests-screen';
export { default as HostPhotosScreen } from './photos-screen';
export { default as HostPortalLayout } from './portal-layout';
export { default as HostSeatingScreen } from './seating-screen';
export { default as HostSignInScreen } from './sign-in-screen';
