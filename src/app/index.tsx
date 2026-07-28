import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Reveal } from '@/components/feedback/reveal';
import { VisualPlaceholder } from '@/components/media/visual-placeholder';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

/**
 * Welcome — design checkpoint screen 1.
 *
 * Photography carries the emotion; the type carries the promise. One statement,
 * one primary action, one quiet secondary action. Nothing else competes.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      {/* Hero. Edge to edge, no containing card — the image is the surface.
          It is the element that yields space; the statement below never does. */}
      <View style={{ flex: 1, flexShrink: 1, minHeight: 200 }}>
        <VisualPlaceholder assetKey="welcome_hero" fill radius="none" style={{ borderWidth: 0 }} />

        {/* Restrained brand mark — an anchor, not decoration on every surface. */}
        <View style={{ position: 'absolute', top: insets.top + spacing.base, left: layout.gutter }}>
          <BrandLogo height={26} />
        </View>
      </View>

      {/* Statement and actions on the paper canvas. */}
      <View
        style={{
          flexShrink: 0,
          paddingHorizontal: layout.gutter,
          paddingTop: spacing.xxl,
          paddingBottom: insets.bottom + spacing.xl,
          backgroundColor: colours.background,
          borderTopLeftRadius: radii.xxl,
          borderTopRightRadius: radii.xxl,
          gap: spacing.lg,
        }}
      >
        <Reveal index={1} step={60} style={{ gap: spacing.md, maxWidth: layout.maxReadableWidth }}>
          {/* Short by design. The display face earns its scale on a five-word
              statement; a full sentence at 40pt wraps into a wall on a small
              phone and crowds the primary action. */}
          <AppText variant="displayHero">The night, from every side.</AppText>
          <AppText variant="bodyLarge" tone="secondary">
            Guests scan a code and start shooting. No app, no account. You keep every photo.
          </AppText>
        </Reveal>

        <Reveal index={2} step={60} style={{ gap: spacing.sm }}>
          <Button label="Create an event" haptic onPress={() => router.push('/create')} />
          <Button
            label="I already have an account"
            variant="quiet"
            onPress={() => router.push('/sign-in')}
          />
        </Reveal>
      </View>
    </View>
  );
}
