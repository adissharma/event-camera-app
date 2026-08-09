import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/brand-logo';
import GrainGradientBackground from '@/components/media/grain-gradient-background';
import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { listCelebrations } from '@/services/celebrations';
import { colours, layout, spacing, useMotion } from '@/design';
import { copy } from '@/i18n';

/**
 * Welcome — the first screen on a cold start.
 *
 * Composition notes, because this screen sets the tone for everything else:
 *
 * - **The shader is the screen.** No panel, no card, no stacked layout. The
 *   background runs edge to edge and the only things on top of it are the mark
 *   and the two actions. Restraint is what reads as expensive here; a headline
 *   and a paragraph would compete with the motion behind them and win, and the
 *   product would look like a brochure rather than a door.
 * - **Centred, not ranged left.** With the type gone there is nothing to hang a
 *   left margin off, and a lone mark ranged left reads as unfinished rather
 *   than deliberate. Dead-centre against a moving field is the composition that
 *   holds still.
 * - **The mark sits in the optical centre of the free space**, above the
 *   actions rather than the geometric middle of the screen — the actions carry
 *   real visual weight at the bottom, so a true centre would look low.
 * - **The scrim only works the bottom third.** It exists to keep the actions
 *   legible, not to darken the artwork, so the ramp starts well below the mark
 *   and the shader stays fully visible above it.
 * - The primary action is ivory, not a colour.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const motion = useMotion();

  useEffect(() => {
    let active = true;
    async function checkExistingEvents() {
      try {
        const list = await listCelebrations();
        if (list.length > 0 && active) {
          router.replace('/home');
        }
      } catch (e) {
        console.warn('Failed to check existing celebrations in welcome screen:', e);
      }
    }
    void checkExistingEvents();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      {/* Wallpaper. The shader runs inside a webview, which is a real native
          view and would otherwise swallow the taps meant for the buttons
          layered above it — hence `pointerEvents="none"` on the wrapper rather
          than relying on z-order alone. Hidden from assistive tech for the same
          reason the video was: the meaning on this screen lives in the text. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <GrainGradientBackground
          // A background that moves indefinitely is exactly what WCAG 2.2.2
          // covers. Freezing the shader holds the composition rather than
          // swapping reduce-motion users onto a visibly poorer screen.
          speed={motion.reduceMotion ? 0 : 1}
          dom={{
            scrollEnabled: false,
            style: { flex: 1, backgroundColor: colours.background },
          }}
        />
      </View>
      {/* Legibility scrim for the actions only. The ramp is pushed down the
          screen (vs. the old 0/0.45/0.82 tuned for video) so the mark and the
          shader above it stay untouched. */}
      <LinearGradient
        colors={colours.imageScrim}
        locations={[0.42, 0.74, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: layout.gutter,
          justifyContent: 'space-between',
        }}
      >
        {/* The mark sits higher on the screen now, with a little more presence. */}
        <View style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.md }}>
          <Reveal index={0} step={70}>
            <BrandLogo height={52} variant="light" />
          </Reveal>
        </View>

        <View style={{ gap: spacing.xs, paddingBottom: spacing.sm }}>
          <Reveal index={1} step={70} style={{ gap: spacing.xs }}>
            <Button
              label={copy.welcome.joinEvent}
              haptic
              labelStyle={{ fontSize: 20, lineHeight: 25 }}
              onPress={() => router.push('/j')}
            />
          <Button
            label={copy.welcome.signUp}
            variant="quiet"
            labelStyle={{ fontSize: 17, lineHeight: 21 }}
            onPress={() => router.push('/sign-in')}
          />
          </Reveal>
        </View>
      </View>
    </View>
  );
}
