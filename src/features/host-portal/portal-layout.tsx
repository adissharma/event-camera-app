import { StyleSheet, View } from 'react-native';
import { Redirect, Slot, usePathname } from 'expo-router';

import { colours } from '@/design';
import { useAuth } from '@/features/auth/context';
import { CentredState, PORTAL_CSS } from './ui';

const SIGN_IN_PATH = '/host/sign-in';

/**
 * The host web portal's root: the one gate between the public web and every
 * `/host` page. Guests never come through here; their routes are `/j`, `/e` and
 * `/celebration`, and they keep working with no account at all.
 *
 * This gate is for the host's convenience, not their security. A signed-out
 * browser reaching a screen anyway would get nothing, because RLS refuses it.
 *
 * Nothing renders until the stored session has been read. That includes the
 * server's static pass, so what is exported is the same spinner the browser
 * starts from, and no page flashes past a host who is already signed in.
 */
export default function HostPortalLayout() {
  const { isRestoring, isSignedIn } = useAuth();
  const pathname = usePathname();

  let content;
  if (isRestoring) {
    content = <CentredState busy />;
  } else if (!isSignedIn && pathname !== SIGN_IN_PATH) {
    content = <Redirect href={SIGN_IN_PATH} />;
  } else {
    content = <Slot />;
  }

  return (
    <View style={S.root}>
      <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />
      {content}
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    // The export renders into a container that does not always inherit the
    // viewport's height. See the same pin on `index.web.tsx`.
    height: '100vh' as unknown as number,
    backgroundColor: colours.background,
  },
});
