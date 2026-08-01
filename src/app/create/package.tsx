import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { CloseIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { fetchCatalogue, formatPrice, planKeys } from '@/services/plans';
import { publishDraft, PublicationError } from '@/services/publication';
import { setPublicationResult } from '@/features/celebrations/creation/publication-result';
import { celebrationKeys } from '@/services/celebrations';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, layout, radii, spacing } from '@/design';

/**
 * The Package selection screen.
 *
 * Highly visual selection of guest capacity using a card grid, an exciting
 * image-faded tile for photo games (with modal info trigger), and an upgrade card
 * for the combined Media Bundle, showing final summary pricing at the bottom.
 */
export default function PackageStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { draft, update, reset } = useCreationDraft();
  const [gamesInfoVisible, setGamesInfoVisible] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    setIsPublishing(true);
    setPublishError(null);
    try {
      const result = await publishDraft(draft);
      setPublicationResult(result);
      await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
      router.replace('/create/success');
    } catch (error) {
      const stage = error instanceof PublicationError ? error.stage : null;
      setPublishError(
        stage === 'purchase'
          ? 'That payment did not go through. Nothing has been charged.'
          : stage === 'publish'
            ? 'Your event was saved but could not be published. Try again.'
            : 'We could not create your event. Check your connection and try again.',
      );
    } finally {
      setIsPublishing(false);
    }
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: planKeys.catalogue(),
    queryFn: fetchCatalogue,
  });

const MOCK_PLANS = [
  {
    id: 'guests_5',
    key: 'guests_5',
    name: '5 Guests',
    description: 'Up to 5 guests can join.',
    tierRank: 1,
    priceMinorUnits: 200,
    currency: 'USD',
    entitlements: { participant_limit: 5 },
  },
  {
    id: 'guests_10',
    key: 'guests_10',
    name: '10 Guests',
    description: 'Up to 10 guests can join.',
    tierRank: 2,
    priceMinorUnits: 1500,
    currency: 'USD',
    entitlements: { participant_limit: 10 },
  },
  {
    id: 'guests_25',
    key: 'guests_25',
    name: '25 Guests',
    description: 'Up to 25 guests can join.',
    tierRank: 3,
    priceMinorUnits: 3000,
    currency: 'USD',
    entitlements: { participant_limit: 25 },
  },
  {
    id: 'guests_50',
    key: 'guests_50',
    name: '50 Guests',
    description: 'Up to 50 guests can join.',
    tierRank: 4,
    priceMinorUnits: 5000,
    currency: 'USD',
    entitlements: { participant_limit: 50 },
  },
  {
    id: 'guests_100',
    key: 'guests_100',
    name: '100 Guests',
    description: 'Up to 100 guests can join.',
    tierRank: 5,
    priceMinorUnits: 10000,
    currency: 'USD',
    entitlements: { participant_limit: 100 },
  },
  {
    id: 'guests_150',
    key: 'guests_150',
    name: '150 Guests',
    description: 'Up to 150 guests can join.',
    tierRank: 6,
    priceMinorUnits: 15000,
    currency: 'USD',
    entitlements: { participant_limit: 150 },
  },
  {
    id: 'guests_200',
    key: 'guests_200',
    name: '200 Guests',
    description: 'Up to 200 guests can join.',
    tierRank: 7,
    priceMinorUnits: 20000,
    currency: 'USD',
    entitlements: { participant_limit: 200 },
  },
  {
    id: 'guests_unlimited',
    key: 'guests_unlimited',
    name: 'Unlimited Guests',
    description: 'Unlimited guests can join.',
    tierRank: 8,
    priceMinorUnits: 10000,
    currency: 'USD',
    entitlements: { participant_limit: 99999 },
  },
];

  // Sort and filter guest plans from the database catalogue, fall back to local mock plans if empty
  const plans = useMemo(() => {
    if (!data?.plans || data.plans.length === 0) return MOCK_PLANS;
    const filtered = data.plans
      .filter((p) => p.key.startsWith('guests_'))
      .sort((a, b) => a.tierRank - b.tierRank);
    return filtered.length > 0 ? filtered : MOCK_PLANS;
  }, [data]);

  // Handle plan key fallback
  const selectedPlanKey = draft.planKey ?? plans[3]?.key ?? plans[0]?.key ?? null;

  // Sync plan key back to draft store if none set
  useMemo(() => {
    if (!draft.planKey && selectedPlanKey) {
      update({ planKey: selectedPlanKey });
    }
  }, [draft.planKey, selectedPlanKey, update]);

  const selectedPlan = useMemo(() => {
    return plans.find((p) => p.key === selectedPlanKey);
  }, [plans, selectedPlanKey]);

  if (isLoading) {
    return (
      <CreationStepScreen step="package" heading="Choose your package">
        <View style={{ paddingVertical: spacing.giant, alignItems: 'center' }}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </CreationStepScreen>
    );
  }

  if (isError || !plans || plans.length === 0) {
    return (
      <CreationStepScreen step="package" heading="Choose your package">
        <AppText variant="body" tone="error">
          Something went wrong loading packages.
        </AppText>
      </CreationStepScreen>
    );
  }

  const isMediaBundleEnabled = draft.addOnKeys.includes('media_bundle');

  const toggleMediaBundle = () => {
    void Haptics.selectionAsync().catch(() => {});
    const nextKeys = isMediaBundleEnabled ? [] : ['media_bundle'];
    update({ addOnKeys: nextKeys });
  };

  const getGuestCountLabel = (key: string) => {
    if (key === 'guests_unlimited') return 'Unlimited';
    return key.replace('guests_', '') + ' guests';
  };

  const planPrice = selectedPlan?.priceMinorUnits ?? 0;
  const addOnPrice = isMediaBundleEnabled ? 1500 : 0;
  const totalPrice = planPrice + addOnPrice;
  const currency = selectedPlan?.currency ?? 'USD';

  return (
    <CreationStepScreen
      step="package"
      heading="Choose your package"
      scrollable={true}
      action={
        <View style={{ gap: spacing.sm }}>
          {publishError ? (
            <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">
              {publishError}
            </AppText>
          ) : null}
          <Button
            label="Create Event 🥳"
            loading={isPublishing}
            haptic
            onPress={() => void handlePublish()}
          />
        </View>
      }
    >
      <View style={{ gap: spacing.lg, paddingBottom: spacing.giant }}>

        {/* Section 1: Guest Capacity Chips */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="secondary">
            Select guest capacity
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xs }}
          >
            {[
              { key: 'guests_5', label: '5' },
              { key: 'guests_10', label: '10' },
              { key: 'guests_50', label: '50' },
              { key: 'guests_100', label: '100' },
              { key: 'guests_200', label: '200' },
              { key: 'guests_unlimited', label: '∞' },
            ].map((opt) => {
              const active = opt.key === selectedPlanKey;
              const isUnlimited = opt.key === 'guests_unlimited';
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    update({ planKey: opt.key });
                  }}
                  style={[
                    styles.toggleChip,
                    active && styles.toggleChipActive,
                    isUnlimited && !active && styles.toggleChipGold,
                  ]}
                >
                  <AppText
                    variant="label"
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: active
                        ? colours.textOnBrand
                        : isUnlimited
                          ? '#DAA520'
                          : colours.textPrimary,
                    }}
                  >
                    {opt.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Section 2: Feature Quadrant */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="secondary">
            What’s included
          </AppText>
          <View style={styles.featureGrid}>
            {/* Photo Games — Exclusive */}
            <Pressable
              style={styles.featureTile}
              onPress={() => setGamesInfoVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Learn more about photo games"
            >
              <View style={styles.featureTileHeader}>
                <AppText style={{ fontSize: 20 }}>🏆</AppText>
                <View style={styles.exclusiveBadge}>
                  <AppText variant="caption" style={{ color: '#DAA520', fontWeight: '800', fontSize: 9, letterSpacing: 0.5 }}>
                    EXCLUSIVE
                  </AppText>
                </View>
              </View>
              <AppText variant="label" style={{ color: colours.textPrimary, fontWeight: '700', fontSize: 13 }}>
                Photo Games
              </AppText>
              <AppText variant="caption" tone="secondary" style={{ fontSize: 11, lineHeight: 14 }}>
                Fun challenges for guests
              </AppText>
            </Pressable>

            {/* Shared Gallery */}
            <View style={styles.featureTile}>
              <AppText style={{ fontSize: 20 }}>🖼️</AppText>
              <AppText variant="label" style={{ color: colours.textPrimary, fontWeight: '700', fontSize: 13, marginTop: spacing.xs }}>
                Shared Gallery
              </AppText>
              <AppText variant="caption" tone="secondary" style={{ fontSize: 11, lineHeight: 14 }}>
                Everyone’s photos, one place
              </AppText>
            </View>

            {/* Custom Themes */}
            <View style={styles.featureTile}>
              <AppText style={{ fontSize: 20 }}>🎨</AppText>
              <AppText variant="label" style={{ color: colours.textPrimary, fontWeight: '700', fontSize: 13, marginTop: spacing.xs }}>
                Custom Themes
              </AppText>
              <AppText variant="caption" tone="secondary" style={{ fontSize: 11, lineHeight: 14 }}>
                Match your event’s style
              </AppText>
            </View>

            {/* QR Invite */}
            <View style={styles.featureTile}>
              <AppText style={{ fontSize: 20 }}>📲</AppText>
              <AppText variant="label" style={{ color: colours.textPrimary, fontWeight: '700', fontSize: 13, marginTop: spacing.xs }}>
                QR Invite
              </AppText>
              <AppText variant="caption" tone="secondary" style={{ fontSize: 11, lineHeight: 14 }}>
                Guests join instantly
              </AppText>
            </View>
          </View>
        </View>

        {/* Section 3: Premium Media Bundle (Add-on) */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label" tone="secondary">
            Recommended Upgrade
          </AppText>
          <Pressable
            accessibilityState={{ checked: isMediaBundleEnabled }}
            onPress={toggleMediaBundle}
            style={[
              styles.upgradeCard,
              isMediaBundleEnabled && styles.upgradeCardActive
            ]}
          >
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <AppText style={{ fontSize: 20 }}>🎙️</AppText>
                  <AppText variant="labelLarge" style={{ color: colours.textPrimary, fontWeight: '700' }}>
                    Guestbook & Video Pack
                  </AppText>
                </View>
                <AppText variant="bodySmall" tone="secondary" style={{ lineHeight: 18, marginTop: spacing.xxs }}>
                  Let guests leave spoken audio messages and upload up to 10 one-minute videos. The ultimate audio-visual record of your day.
                </AppText>
              </View>
              
              <View style={{ alignItems: 'flex-end', gap: spacing.xs, minWidth: 60 }}>
                <AppText variant="labelLarge" tone="brand" style={{ fontSize: 16, fontWeight: '700' }}>
                  {formatPrice(1500, currency, LOCALE_CONFIG.locale)}
                </AppText>
                <View
                  style={[
                    styles.checkboxCircle,
                    isMediaBundleEnabled && styles.checkboxCircleActive
                  ]}
                >
                  {isMediaBundleEnabled ? (
                    <AppText variant="caption" tone="onBrand">✓</AppText>
                  ) : null}
                </View>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Section 4: Dynamic Pricing Checkout Summary Footer */}
        <View style={styles.footerPanel}>
          <View style={styles.footerRow}>
            <AppText variant="bodySmall" tone="secondary">
              {selectedPlan ? getGuestCountLabel(selectedPlan.key) : ''}
            </AppText>
            <AppText variant="bodySmall" style={{ color: colours.textPrimary, fontWeight: '600' }}>
              {selectedPlan ? formatPrice(selectedPlan.priceMinorUnits, selectedPlan.currency, LOCALE_CONFIG.locale) : ''}
            </AppText>
          </View>
          
          {isMediaBundleEnabled && (
            <View style={styles.footerRow}>
              <AppText variant="bodySmall" tone="secondary">
                Guestbook & Video Pack
              </AppText>
              <AppText variant="bodySmall" style={{ color: colours.textPrimary, fontWeight: '600' }}>
                {formatPrice(1500, currency, LOCALE_CONFIG.locale)}
              </AppText>
            </View>
          )}
          
          <View style={styles.footerDivider} />
          
          <View style={styles.footerTotalRow}>
            <AppText variant="labelLarge" style={{ fontSize: 18, color: colours.textPrimary }}>
              Total price
            </AppText>
            <AppText variant="serifHeading" style={{ fontSize: 24, color: colours.brandPrimary }}>
              {formatPrice(totalPrice, currency, LOCALE_CONFIG.locale)}
            </AppText>
          </View>
        </View>

      </View>

      {/* Info Modal for Event Games */}
      <Modal
        visible={gamesInfoVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setGamesInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <AppText variant="labelLarge" style={{ fontSize: 18, fontWeight: '700' }}>
                Interactive Photo Games 🏆
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close info modal"
                onPress={() => setGamesInfoVisible(false)}
                style={styles.modalCloseButton}
              >
                <CloseIcon size={16} color={colours.textPrimary} />
              </Pressable>
            </View>
            <AppText variant="body" tone="secondary" style={{ lineHeight: 22 }}>
              We are the only app that lets you run custom games for your guests. Challenge them to capture the magic of your day: with a grandparent, a candid toast, a secret dancer, or the best dressed guest. Choose from our pre-made templates or write your own custom challenges. Fully integrated and 100% free!
            </AppText>
            <Button
              label="Got it"
              variant="secondary"
              onPress={() => setGamesInfoVisible(false)}
              style={{ marginTop: spacing.xs }}
            />
          </View>
        </View>
      </Modal>
    </CreationStepScreen>
  );
}

const styles = StyleSheet.create({
  toggleChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
    backgroundColor: colours.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  toggleChipActive: {
    borderColor: colours.brandPrimary,
    backgroundColor: colours.brandPrimary,
  },
  toggleChipGold: {
    borderColor: '#DAA520',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  featureTile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
    padding: spacing.md,
    gap: 2,
  },
  featureTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  exclusiveBadge: {
    borderWidth: 1,
    borderColor: '#DAA520',
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  upgradeCard: {
    backgroundColor: colours.surface,
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
  },
  upgradeCardActive: {
    borderColor: colours.brandPrimary,
    backgroundColor: colours.brandSoft,
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
  },
  checkboxCircleActive: {
    borderWidth: 0,
    backgroundColor: colours.brandPrimary,
  },
  footerPanel: {
    backgroundColor: colours.surface,
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerDivider: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
    marginVertical: spacing.xxs,
  },
  footerTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalContainer: {
    backgroundColor: colours.surface,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    gap: spacing.base,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseButton: {
    padding: spacing.xxs,
  },
});
