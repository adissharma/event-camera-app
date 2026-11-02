import { Redirect } from 'expo-router';

/**
 * What every `/host` route is on iOS and Android: the app's own dashboard, so a
 * `/host` link opened inside the app still lands somewhere useful. The portal
 * itself is web-only; see `routes.web.ts`.
 */
function HostPortalNativeRedirect() {
  return <Redirect href="/home" />;
}

export {
  HostPortalNativeRedirect as HostEventLayout,
  HostPortalNativeRedirect as HostEventsScreen,
  HostPortalNativeRedirect as HostGuestbookScreen,
  HostPortalNativeRedirect as HostGuestsScreen,
  HostPortalNativeRedirect as HostPhotosScreen,
  HostPortalNativeRedirect as HostPortalLayout,
  HostPortalNativeRedirect as HostSeatingScreen,
  HostPortalNativeRedirect as HostSignInScreen,
};
