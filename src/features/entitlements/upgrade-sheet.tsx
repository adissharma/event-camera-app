import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import {
  planAccessibilityLabel,
  planGuestSubtitle,
  type PaywallPlan,
} from '@/features/payments/plan-catalogue';
import { upgradePriceLabel } from '@/features/payments/upgrade-catalogue';
import { UpgradeError, eventPlanKeys, upgradeEventPlan } from '@/services/event-plan';
import { celebrationKeys } from '@/services/celebrations';
import { upgradeSummary } from './event-entitlements';
import { colours, layout, radii, REVEAL_TRACK_GRADIENT, spacing } from '@/design';

const UPGRADE_SHADER = [
  REVEAL_TRACK_GRADIENT[4],
  REVEAL_TRACK_GRADIENT[3],
  REVEAL_TRACK_GRADIENT[2],
  REVEAL_TRACK_GRADIENT[1],
  REVEAL_TRACK_GRADIENT[0],
] as const;
const UPGRADE_SHADER_START = { x: 0, y: 0 } as const;
const UPGRADE_SHADER_END = { x: 1, y: 0 } as const;

function StarIcon({ size = 10 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * The one upgrade surface.
 *
 * Every locked feature in the app opens this rather than carrying its own
 * paywall — the brief's point, and the right one: a product with six bespoke
 * upgrade screens has six places for the pricing to drift and six visual
 * languages for the same decision. What changes per feature is the title and
 * the sentence explaining why it appeared, not the cards or the payment.
 *
 * Prices shown are the *upgrade* price — the difference between what the host
 * already paid for this event and the tier they are moving to.
 */

export interface UpgradeSheetProps {
  visible: boolean;
  celebrationId: string;
  /** The event's current package. `null` for a free or unresolved event. */
  currentPlan: PaywallPlan | null;
  /**
   * The tiers that would actually satisfy what the host was trying to do.
   *
   * Supplied by the caller rather than computed here, because only the caller
   * knows what was attempted — "I want unlimited guests" and "I want a
   * guestbook" have different answers, and offering a tier that would not do
   * the thing is worse than offering nothing.
   */
  options: PaywallPlan[];
  /** e.g. `Unlock Guestbook`. Says what the host was reaching for. */
  title: string;
  onClose: () => void;
  /**
   * Called after the tier is active, so the caller can resume what the host
   * was doing rather than making them find it again.
   */
  onUpgraded?: (planKey: string) => void;
}

export function UpgradeSheet({
  visible,
  celebrationId,
  currentPlan,
  options,
  title,
  onClose,
  onUpgraded,
}: UpgradeSheetProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(options[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((plan) => plan.id === selectedId) ?? options[0] ?? null;
  const isSingleOption = options.length === 1;
  const isStillsPlus = selected?.isRecommended ?? false;
  const heading = isStillsPlus ? 'Upgrade to Stills+' : `Upgrade to ${selected?.displayName ?? ''}`;
  const supportingCopy = isStillsPlus
    ? 'Unlock premium features for your event.'
    : selected
      ? upgradeSummary(currentPlan, selected)
      : title;

  const buy = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const planKey = await upgradeEventPlan({ celebrationId, from: currentPlan, to: selected });

      // Both keys, together: the entitlement cache is what unlocks the
      // controls, and the celebration cache is what the surrounding screen is
      // drawn from. Refreshing one and not the other leaves a screen that has
      // unlocked a feature it still thinks the event cannot use.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: eventPlanKeys.forEvent(celebrationId) }),
        queryClient.invalidateQueries({ queryKey: celebrationKeys.detail(celebrationId) }),
      ]);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setBusy(false);
      onClose();
      onUpgraded?.(planKey);
    } catch (e) {
      setBusy(false);
      // A cancelled purchase is a decision, not a failure. Saying "something
      // went wrong" to someone who deliberately tapped Cancel is how a sheet
      // starts feeling like it is arguing with you.
      if (e instanceof UpgradeError && e.code === 'cancelled') return;
      setError(e instanceof Error ? e.message : 'Could not complete the upgrade.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [selected, busy, celebrationId, currentPlan, queryClient, onClose, onUpgraded]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />

        <View style={[S.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
          <View style={S.sheetHandle} />
          <View style={S.copy}>
            <AppText variant="titleLarge" style={S.title}>
              {heading}
            </AppText>
            {selected ? (
              <AppText variant="bodyLarge" style={S.summary}>
                {supportingCopy}
              </AppText>
            ) : null}
          </View>

          <ScrollView style={S.scroll} showsVerticalScrollIndicator={false}>
            <View style={S.cards}>
              {options.map((plan) => {
                const isSelected = plan.id === selected?.id;
                const isPremium = plan.isRecommended;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedId(plan.id)}
                    disabled={busy || isSingleOption}
                    accessibilityRole={isSingleOption ? undefined : 'radio'}
                    accessibilityState={{ selected: isSelected, disabled: busy || isSingleOption }}
                    accessibilityLabel={planAccessibilityLabel(plan)}
                    style={[S.card, isPremium && S.cardPremium]}
                  >
                    {isPremium ? (
                      <LinearGradient
                        colors={UPGRADE_SHADER}
                        start={UPGRADE_SHADER_START}
                        end={UPGRADE_SHADER_END}
                        style={S.cardBorder}
                        pointerEvents="none"
                      >
                        <View style={S.cardBorderInset} />
                      </LinearGradient>
                    ) : null}
                    {isPremium ? (
                      <LinearGradient
                        colors={UPGRADE_SHADER}
                        start={UPGRADE_SHADER_START}
                        end={UPGRADE_SHADER_END}
                        style={S.badge}
                        pointerEvents="none"
                      >
                        <StarIcon />
                        <AppText variant="eyebrow" style={S.badgeText}>
                          Most popular
                        </AppText>
                      </LinearGradient>
                    ) : null}
                    {!isSingleOption ? (
                      <View style={[S.radio, isSelected && S.radioSelected]}>
                        {isSelected && <View style={S.radioDot} />}
                      </View>
                    ) : null}
                    <View style={S.cardCopy}>
                      <AppText variant="heading" style={S.cardName} numberOfLines={1}>
                        {plan.displayName}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                        {planGuestSubtitle(plan)}
                      </AppText>
                    </View>
                    {/* The difference, not the sticker price — the host has
                        already paid for the tier they are on. */}
                    <AppText variant="numericLarge" style={S.cardPrice} numberOfLines={1}>
                      {upgradePriceLabel(currentPlan, plan) ?? '—'}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {error ? (
            <AppText variant="bodySmall" style={S.error}>
              {error}
            </AppText>
          ) : null}

          <Pressable
            onPress={() => void buy()}
            disabled={busy || !selected}
            accessibilityRole="button"
            accessibilityLabel="Upgrade now"
            accessibilityState={{ disabled: busy || !selected, busy }}
            style={({ pressed }) => [S.upgradeButton, pressed && !busy && { opacity: 0.88 }]}
          >
            {busy ? (
              <ActivityIndicator color={colours.textOnBrand} />
            ) : (
              <AppText variant="button" style={S.upgradeButtonText}>
                Upgrade now
              </AppText>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
            style={({ pressed }) => [S.maybeLater, pressed && !busy && { opacity: 0.7 }]}
          >
            <AppText variant="bodySmall" style={S.maybeLaterText}>
              Maybe later
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    backgroundColor: '#0D0D0F',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    gap: spacing.md,
    maxHeight: '72%',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
  },
  copy: { gap: spacing.sm },
  title: { color: '#FFFFFF' },
  summary: { color: '#9A9A9F', lineHeight: 23 },
  scroll: { flexGrow: 0 },
  cards: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 68,
    borderRadius: radii.lg,
    backgroundColor: '#151517',
    overflow: 'visible',
  },
  cardPremium: { marginTop: spacing.sm },
  cardBorder: { ...StyleSheet.absoluteFill, borderRadius: radii.lg },
  cardBorderInset: {
    ...StyleSheet.absoluteFill,
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderRadius: radii.md + 2,
    backgroundColor: '#151517',
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    zIndex: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, letterSpacing: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#FFFFFF' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  cardCopy: { flex: 1, gap: 2 },
  cardName: { color: '#FFFFFF' },
  cardPrice: { color: '#FFFFFF' },
  error: { color: colours.error },
  upgradeButton: {
    minHeight: 54,
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: { color: colours.textOnBrand },
  maybeLater: {
    minHeight: 32,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  maybeLaterText: { color: '#9A9A9F' },
});
