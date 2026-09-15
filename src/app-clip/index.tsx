import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';

/**
 * Recovery route for an App Clip launched without a routable event URL.
 *
 * Valid invocations enter through `/j/:slug` or `/e/:eventCode` directly. We
 * still inspect the initial URL here because iOS can briefly hand the Clip its
 * root route while activation data settles. This is intentionally not a manual
 * event-code home screen: the Clip only exists in the context of an invitation.
 */
export default function AppClipInvocationFallback() {
  const router = useRouter();
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then((url) => {
      if (!active) return;

      const match = url?.match(/\/(j|e)\/([^/?#]+)/i);
      if (match) {
        router.replace(`/${match[1].toLowerCase()}/${decodeURIComponent(match[2])}` as never);
        return;
      }

      setResolving(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <View style={styles.root}>
      {resolving ? (
        <ActivityIndicator color={colours.textPrimary} />
      ) : (
        <>
          <AppText variant="displaySmall" align="center">Open your event invitation</AppText>
          <AppText variant="bodyMedium" tone="secondary" align="center">
            Reopen the event link or scan its QR code to join.
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.gutter,
    backgroundColor: colours.background,
  },
});
