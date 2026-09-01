import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import {
  CameraSparkleIcon,
  CelebrationIcon,
  LinkIcon,
} from '@/components/ui/icons';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { resolveCoverTemplate } from '@/features/celebrations/cover-templates';
import { GuestJoinScreen } from '@/features/celebrations/join/guest-join-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  clearPublicationResult,
  getPublicationResult,
} from '@/features/celebrations/creation/publication-result';
import { celebrationKeys } from '@/services/celebrations';
import { colours, layout, radii, spacing } from '@/design';

/** How long "Copied" stays before the button reverts. */
const COPIED_RESET_MS = 1600;

/**
 * What the host sees the moment their event exists.
 *
 * Deliberately the guest invitation with different words. Not a lookalike of
 * it — literally `GuestJoinScreen`, rendered with the template the host chose
 * and its `footer` slot carrying the link and CTA in place of the join form.
 * A host who has just spent six steps looking at a preview of their invitation
 * lands on that exact invitation, rather than on a receipt or on a hand-rolled
 * copy of the default cover that ignores their choice.
 *
 * The one flourish is the popper, which plays once. Everything after it simply
 * arrives, staggered, inside a second.
 */
export default function SuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { reset } = useCreationDraft();

  const [copied, setCopied] = useState(false);

  // Read once. The draft is cleared on mount, and the result is cleared on
  // unmount — neither can be a dependency of the render that follows.
  const [result] = useState(getPublicationResult);

  // Same resolver as every other cover surface, so the first screen a host
  // sees after publishing shows the photograph they actually chose.
  const coverSource = useCoverSource(result?.coverStoragePath);

  const entrance = useEntrance(Boolean(result));

  useEffect(() => {
    void reset();
    void queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return () => clearPublicationResult();
  }, [reset, queryClient]);

  // A pending copy timer must not fire into an unmounted screen.
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const daysLeft = useMemo(() => formatDaysLeft(result?.endsAt ?? null), [result?.endsAt]);

  if (!result) {
    return (
      <View style={[S.root, S.centred, { padding: layout.gutter }]}>
        <AppText variant="bodyLarge" tone="secondary" align="center">
          This event has already been created.
        </AppText>
      </View>
    );
  }


  async function handleCopy() {
    await Clipboard.setStringAsync(result!.guestUrl);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  const template = resolveCoverTemplate(result.themeSlug);
  /**
   * The confirmation chrome sits inside the template, so it has to answer to
   * the template's own ground. On the light cover the shared dark-surface
   * tokens would put champagne text on cream — around 1.6:1, unreadable —
   * so the light template gets ink-on-cream equivalents instead.
   */
  const onLight = template === 'lightArch';
  const footerInk = onLight ? '#302E2C' : colours.accentWarm;
  const footerSurface = onLight ? '#FFFFFF' : colours.surfaceMuted;
  const footerBorder = onLight ? '#D9D2C9' : colours.borderSubtle;
  const footerText = onLight ? '#302E2C' : colours.textPrimary;

  return (
    <GuestJoinScreen
      // The template the host actually selected, snapshotted at publication
      // alongside the cover path. `resolveCoverTemplate` falls back to the
      // default only when the event genuinely carries no selection.
      template={template}
      coverSource={coverSource}
      title={result.eventName}
      countdownLabel={daysLeft ?? '—'}
      shotsLeftLabel="∞"
      // Nothing here is a live join form; the template renders the footer
      // below in its place, so none of the guest controls are reachable.
      interactive={false}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Animated.View style={entrance.item(0)}>
            <View style={S.congrats}>
              <Popper play={entrance.playPopper} tint={footerInk} />
              <AppText variant="eyebrow" align="center" style={{ color: footerInk }}>
                Congratulations!
              </AppText>
            </View>
          </Animated.View>

          <Animated.View style={entrance.item(3)}>
            <View
              style={[
                S.field,
                { backgroundColor: footerSurface, borderColor: footerBorder },
              ]}
            >
              <LinkIcon size={20} color={onLight ? '#94887B' : colours.textSecondary} />

              <AppText
                variant="bodySmall"
                numberOfLines={1}
                style={[S.fieldValue, { color: footerText }]}
                accessibilityLabel={`Guest link, ${displayUrl(result.guestUrl)}`}
              >
                {displayUrl(result.guestUrl)}
              </AppText>

              <Pressable
                onPress={() => void handleCopy()}
                accessibilityRole="button"
                accessibilityLabel={copied ? 'Link copied' : 'Copy guest link'}
                hitSlop={8}
                style={({ pressed }) => [S.copy, { borderColor: footerBorder }, pressed && S.pressed]}
              >
                <AppText variant="labelSmall" style={{ color: footerInk }}>
                  {copied ? 'Copied' : 'Copy'}
                </AppText>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View style={entrance.item(4)}>
            <Pressable
              onPress={() => router.replace(`/celebration/${result.celebrationId}` as never)}
              accessibilityRole="button"
              accessibilityLabel="Go to the event"
              style={({ pressed }) => [S.cta, pressed && S.pressed]}
            >
              <CameraSparkleIcon size={22} color={colours.textOnBrand} />
              <AppText variant="labelLarge" style={S.ctaLabel}>
                Go to the event
              </AppText>
            </Pressable>
          </Animated.View>
        </View>
      }
    />
  );
}

/* ────────────────────────────────────────────────────────────────
   Entrance
   ──────────────────────────────────────────────────────────────── */

/** Where each item sits in the stagger. The last one lands at 860ms. */
const ITEM_DELAYS = [280, 350, 420, 500, 580];
const ITEM_DURATION = 280;

/**
 * The staggered arrival.
 *
 * One driver per item rather than a single interpolated progress value: an
 * interpolation would hand every item the same slice of the same curve, and the
 * items further down would arrive visibly flatter than the first.
 */
function useEntrance(enabled: boolean) {
  const values = useRef(ITEM_DELAYS.map(() => new Animated.Value(0))).current;
  const [playPopper, setPlayPopper] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setPlayPopper(true);

    Animated.parallel(
      values.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          delay: ITEM_DELAYS[index],
          duration: ITEM_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [enabled, values]);

  return {
    playPopper,
    item: (index: number) => ({
      opacity: values[index],
      transform: [
        {
          translateY: values[index].interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        },
      ],
    }),
  };
}

/** The three confetti particles, as fractions of their drift distance. */
const PARTICLES = [
  { dx: -26, dy: -22, size: 5, delay: 140, colour: colours.accentWarm },
  { dx: 24, dy: -28, size: 4, delay: 200, colour: colours.textPrimary },
  { dx: 12, dy: -14, size: 4, delay: 260, colour: colours.accentWarm },
];

/**
 * The popper, and the only animation on the screen with any personality.
 *
 * Scales from 0.85 with an overshoot and unwinds a small rotation, while three
 * particles drift off and fade. Plays once, on appearance.
 */
function Popper({ play, tint }: { play: boolean; tint: string }) {
  const pop = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!play) return;
    Animated.parallel([
      Animated.timing(pop, {
        toValue: 1,
        duration: 520,
        // The overshoot. `back` carries it just past 1.0 and settles.
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(drift, {
        toValue: 1,
        delay: 120,
        duration: 640,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [play, pop, drift]);

  return (
    <View style={S.popper}>
      {PARTICLES.map((particle, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[
            S.particle,
            {
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.colour,
              opacity: drift.interpolate({
                inputRange: [0, 0.15, 0.6, 1],
                outputRange: [0, 1, 0.8, 0],
              }),
              transform: [
                {
                  translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.dx],
                  }),
                },
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.dy],
                  }),
                },
              ],
            },
          ]}
        />
      ))}

      <Animated.View
        style={{
          opacity: pop.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              scale: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            },
            {
              rotate: pop.interpolate({
                inputRange: [0, 1],
                outputRange: ['-10deg', '0deg'],
              }),
            },
          ],
        }}
      >
        <CelebrationIcon size={34} color={tint} />
      </Animated.View>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────
   Formatting
   ──────────────────────────────────────────────────────────────── */

/**
 * Whole days only.
 *
 * Floored, not rounded: "7 days left" must never be shown to someone with six
 * days and twenty hours. The final day reads as its own thing rather than
 * counting down to zero in front of the host.
 */
function formatDaysLeft(endsAt: string | null): string | null {
  if (!endsAt) return null;

  const remaining = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return 'Ended';

  const days = Math.floor(remaining / 86_400_000);
  if (days === 0) return 'Last day';
  // No trailing "left": every template pairs this value with its own
  // "TIME LEFT" / "LEFT" label, so including it here read as "4 days left LEFT".
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * The link, without its credential.
 *
 * The fragment carries the guest token; it is copied but never drawn. A token
 * on screen is a token in a screenshot, and this is the screen hosts photograph
 * to send to people.
 */
function displayUrl(guestUrl: string): string {
  return guestUrl.replace(/^https?:\/\//, '').split('#')[0];
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },
  centred: { alignItems: 'center', justifyContent: 'center' },

  // ── Cover ──

  congrats: { alignItems: 'center', gap: spacing.xxs, paddingBottom: spacing.xs },

  // ── Identity ──
  // Pulled up into the ramp, so the popper sits in the dark end of the
  // photograph rather than below a seam.
  popper: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxs },
  particle: { position: 'absolute', borderRadius: 2 },

  eyebrow: { color: colours.accentWarm },


  // ── Share ──
  share: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    minHeight: 60,
    borderRadius: radii.xl,
    backgroundColor: colours.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  fieldValue: { flex: 1, color: colours.textPrimary },
  copy: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    // Fixed width, so "Copy" → "Copied" does not shunt the field's layout.
    minWidth: 82,
    alignItems: 'center',
  },
  copyLabel: { color: colours.accentWarm },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 62,
    borderRadius: radii.pill,
    backgroundColor: colours.accentWarm,
    marginTop: spacing.xs,
  },
  ctaLabel: { color: colours.textOnBrand, fontSize: 17 },
  pressed: { opacity: 0.9 },
});
