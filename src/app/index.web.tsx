import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { StillsLockup } from '@/components/brand/stills-lockup';
import { colours, spacing } from '@/design';
import { useDocumentTitle } from '@/components/brand/use-document-title';

/**
 * The public homepage.
 *
 * A web-only override of the app's entry route. The app itself still exports to
 * web — guests join, view galleries and capture through `/j`, `/e` and
 * `/celebration` — but the root used to drop a stranger straight into the host
 * onboarding, sign-in and all. Somebody arriving at stills.events from a
 * printed QR code's domain, or from the App Store listing, should meet the
 * product's name, not its first-run flow.
 *
 * Deliberately almost nothing: the logo, and the one link the App Store
 * requires a public home for. Marketing copy can arrive when there is some.
 *
 * Platform-suffixed rather than branched inside `index.tsx`: the native entry
 * is a 1,100-line animated intro, and the web bundle has no reason to carry it.
 */
export default function WebHome() {
  useDocumentTitle('Stills - Events Camera App');

  return (
    <View style={S.page}>

      <View style={S.centre}>
        <StillsLockup size={76} />
      </View>

      <View style={S.footer}>
        <Link href="/privacy" asChild>
          <Pressable accessibilityRole="link">
            <AppText variant="caption" tone="secondary" style={S.footerLink}>
              Privacy Policy
            </AppText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colours.background,
    // The export renders into a container that does not always inherit the
    // viewport's height, so the page is pinned rather than trusted to fill.
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  centre: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  footer: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
});
