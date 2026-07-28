import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Reveal } from '@/components/feedback/reveal';
import { VisualPlaceholder } from '@/components/media/visual-placeholder';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';

/**
 * Welcome — design checkpoint screen 1.
 *
 * Composition notes, because this screen sets the tone for everything else:
 *
 * - The photograph is the whole screen, not a panel with content stacked below
 *   it. Content sits *on* the image behind a three-stop scrim. A single
 *   uninterrupted image reads considerably more expensive than a two-block
 *   layout, and it is what lets the type feel placed rather than arranged.
 * - Left-aligned, ranged left off a single margin. The nearest competitor
 *   centres a serif over its cover; ranging left with a wide-tracked uppercase
 *   eyebrow above the statement is an editorial voice rather than a poster one.
 * - A hairline rule separates promise from explanation. One rule, full measure,
 *   at the lowest visible contrast that still reads.
 * - The primary action is ivory, not a colour.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      {/* Full-bleed photography. */}
      <View style={StyleSheet.absoluteFill}>
        <VisualPlaceholder assetKey="welcome_hero" fill radius="none" style={{ borderWidth: 0 }} />
      </View>

      {/* Scrim. Weighted toward the bottom so the subject stays clear while the
          type below stays legible on any photograph. */}
      <LinearGradient
        colors={colours.imageScrim}
        locations={[0, 0.45, 0.82]}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingTop: insets.top + spacing.base, paddingHorizontal: layout.gutter }}>
          <BrandLogo height={24} variant="light" />
        </View>

        <View
          style={{
            paddingHorizontal: layout.gutter,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.xl,
          }}
        >
          <Reveal index={1} step={70} style={{ gap: spacing.base }}>
            <AppText variant="eyebrow" tone="secondary">
              Shared event camera
            </AppText>

            <AppText variant="displayHero">The night, from every side.</AppText>

            {/* One hairline, full measure. `borderSubtle` is tuned for flat
                surfaces and disappears entirely over a scrimmed photograph, so
                this structural rule uses `borderStrong`. */}
            <View
              style={{
                height: layout.hairline,
                backgroundColor: colours.borderStrong,
                marginTop: spacing.xs,
              }}
            />

            <AppText variant="bodyLarge" tone="secondary" style={{ maxWidth: 420 }}>
              Guests scan a code and start shooting. No app, no account. You keep every photo.
            </AppText>
          </Reveal>

          <Reveal index={2} step={70} style={{ gap: spacing.sm }}>
            <Button label="Create an event" haptic onPress={() => router.push('/create')} />
            <Button
              label="I already have an account"
              variant="quiet"
              onPress={() => router.push('/sign-in')}
            />
          </Reveal>
        </View>
      </View>
    </View>
  );
}

