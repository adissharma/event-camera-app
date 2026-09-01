import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CloseIcon } from '@/components/ui/icons';
import {
  planAccessibilityLabel,
  planFeatureRows,
  planGuestSubtitle,
  type PaywallPlan,
} from '@/features/payments/plan-catalogue';
import { upgradePriceLabel } from '@/features/payments/upgrade-catalogue';
import { UpgradeError, eventPlanKeys, upgradeEventPlan } from '@/services/event-plan';
import { celebrationKeys } from '@/services/celebrations';
import { upgradeSummary } from './event-entitlements';
import { colours, layout, radii, spacing } from '@/design';

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
          <View style={S.header}>
            <AppText variant="heading" style={S.title}>
              {title}
            </AppText>
            <Pressable
              onPress={onClose}
              disabled={busy}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <CloseIcon size={16} color={colours.textSecondary} />
            </Pressable>
          </View>

          {/* Built from the two plans' real entitlements, so it cannot promise
              something the tier does not actually grant. */}
          {selected ? (
            <AppText variant="bodySmall" tone="secondary" style={S.summary}>
              {upgradeSummary(currentPlan, selected)}
            </AppText>
          ) : null}

          <ScrollView style={S.scroll} showsVerticalScrollIndicator={false}>
            <View style={S.cards}>
              {options.map((plan) => {
                const isSelected = plan.id === selected?.id;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedId(plan.id)}
                    disabled={busy}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, disabled: busy }}
                    accessibilityLabel={planAccessibilityLabel(plan)}
                    style={[S.card, isSelected ? S.cardSelected : S.cardIdle]}
                  >
                    <View style={[S.radio, isSelected && S.radioSelected]}>
                      {isSelected && <View style={S.radioDot} />}
                    </View>
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

            {selected ? (
              <View style={S.features}>
                {planFeatureRows(selected)
                  .filter((row) => row.included)
                  .map((row) => (
                    <AppText key={row.key} variant="bodySmall" tone="secondary">
                      {row.label}
                    </AppText>
                  ))}
              </View>
            ) : null}
          </ScrollView>

          {error ? (
            <AppText variant="bodySmall" style={S.error}>
              {error}
            </AppText>
          ) : null}

          <Button
            label={busy ? 'Upgrading…' : `Upgrade to ${selected?.displayName ?? ''}`}
            fullWidth
            haptic
            disabled={busy || !selected}
            onPress={() => void buy()}
            leading={busy ? <ActivityIndicator size="small" color={colours.textOnBrand} /> : undefined}
          />
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colours.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    gap: spacing.md,
    maxHeight: '86%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colours.textPrimary, flex: 1 },
  summary: { lineHeight: 20 },
  scroll: { flexGrow: 0 },
  cards: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 68,
    borderRadius: radii.lg,
    borderWidth: layout.hairline,
  },
  cardIdle: { borderColor: colours.borderSubtle, backgroundColor: colours.surfaceMuted },
  cardSelected: { borderColor: colours.textPrimary, borderWidth: 1.5 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colours.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colours.textPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colours.textPrimary },
  cardCopy: { flex: 1, gap: 2 },
  cardName: { color: colours.textPrimary },
  cardPrice: { color: colours.textPrimary },
  features: { gap: 4, paddingTop: spacing.md },
  error: { color: colours.error },
});
