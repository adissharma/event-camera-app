import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui/text';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { fetchCatalogue, formatPrice, planKeys, type PlanWithEntitlements } from '@/services/plans';
import { publishDraft, PublicationError } from '@/services/publication';
import { setPublicationResult } from '@/features/celebrations/creation/publication-result';
import { celebrationKeys } from '@/services/celebrations';
import { LOCALE_CONFIG } from '@/config/app-config';
import { fontFamilies, layout, radii, spacing } from '@/design';

const SCREEN_BG = '#090909';
const CARD_BG = '#131314';
const CARD_BORDER = 'rgba(255, 248, 239, 0.12)';
const CARD_BORDER_SELECTED = '#F3EADF';
const MUTED_TEXT = '#A79F96';
const GOLD_TEXT = '#E8C98F';
const PHONE_BG = '#171718';
const MOST_POPULAR_KEY = 'guests_50';
const PLAN_ORDER = [
  'guests_5',
  'guests_25',
  'guests_50',
  'guests_100',
  'guests_150',
  'guests_200',
  'guests_unlimited',
] as const;

const FALLBACK_PLANS: PlanWithEntitlements[] = [
  {
    id: 'guests_5',
    key: 'guests_5',
    name: '5 Guests',
    description: 'Up to 5 guests can join.',
    tierRank: 1,
    priceMinorUnits: 0,
    currency: 'USD',
    entitlements: { participant_limit: 5 },
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

const PHONE_IMAGES = [
  require('../../../assets/images/placeholders/christian_wedding.png'),
  require('../../../assets/images/placeholders/hindu_wedding.png'),
  require('../../../assets/images/placeholders/treatment_preview_1.png'),
  require('../../../assets/images/placeholders/treatment_preview_2.png'),
  require('../../../assets/images/placeholders/iphone_group_1.png'),
  require('../../../assets/images/placeholders/iphone_group_2.png'),
  require('../../../assets/images/placeholders/iphone_group_3.png'),
  require('../../../assets/images/placeholders/iphone_group_4.png'),
];

const BENEFITS = [
  {
    id: 'capture',
    headline: 'Everyone captures the night',
    body: 'Guests join instantly and take candid photos throughout the event.',
    eventName: 'James & Sofia',
    subtitle: 'Wedding Party',
    leftImage: require('../../../assets/images/placeholders/treatment_preview_1.png'),
    rightImage: require('../../../assets/images/placeholders/iphone_group_5.png'),
    phoneImages: PHONE_IMAGES,
  },
  {
    id: 'no-app',
    headline: 'No app needed',
    body: 'Guests scan the QR code and start snapping straight away.',
    eventName: 'Amara Turns 30',
    subtitle: 'Birthday Party',
    leftImage: require('../../../assets/images/placeholders/christian_wedding.png'),
    rightImage: require('../../../assets/images/placeholders/treatment_preview_2.png'),
    phoneImages: [...PHONE_IMAGES].reverse(),
  },
  {
    id: 'reveal',
    headline: 'Make the reveal part of the fun',
    body: 'Choose when everyone gets to see the photos and build anticipation.',
    eventName: 'Rooftop Afterparty',
    subtitle: 'Launch Night',
    leftImage: require('../../../assets/images/placeholders/hindu_wedding.png'),
    rightImage: require('../../../assets/images/placeholders/iphone_group_3.png'),
    phoneImages: [PHONE_IMAGES[4], PHONE_IMAGES[1], PHONE_IMAGES[6], PHONE_IMAGES[7], PHONE_IMAGES[0], PHONE_IMAGES[2]],
  },
  {
    id: 'games',
    headline: 'Photo Games, included',
    body: 'Give guests playful photo challenges at no extra cost.',
    eventName: 'Olivia & Marcus',
    subtitle: 'Garden Wedding',
    leftImage: require('../../../assets/images/placeholders/iphone_group_2.png'),
    rightImage: require('../../../assets/images/placeholders/treatment_preview_1.png'),
    phoneImages: [PHONE_IMAGES[2], PHONE_IMAGES[0], PHONE_IMAGES[5], PHONE_IMAGES[3], PHONE_IMAGES[1], PHONE_IMAGES[7]],
  },
] as const;

function BackChevronIcon({ size = 20, color = '#F3EADF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkleIcon({ size = 26, color = '#E8C98F' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l1.55 6.45L20 10l-6.45 1.55L12 18l-1.55-6.45L4 10l6.45-1.55L12 2Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CameraOutlineIcon({ size = 34, color = '#F3EADF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.08-1.58A1.6 1.6 0 0 1 10.59 4h2.82a1.6 1.6 0 0 1 1.31.42L15.8 6h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12.5} r={3.2} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

type Benefit = (typeof BENEFITS)[number];

function BenefitArtwork({
  benefit,
  width,
}: {
  benefit: Benefit;
  width: number;
}) {
  const phoneWidth = Math.min(width * 0.58, 236);
  const phoneHeight = phoneWidth * 1.98;
  const rearCardWidth = phoneWidth * 0.72;
  const rearCardHeight = rearCardWidth * 1.08;

  return (
    <View style={[styles.heroArtworkWrap, { height: phoneHeight + 62 }]}>
      <View
        style={[
          styles.rearPhotoCard,
          {
            width: rearCardWidth,
            height: rearCardHeight,
            left: width * 0.08,
            top: phoneHeight * 0.36,
            transform: [{ rotate: '-10deg' }],
          },
        ]}
      >
        <Image source={benefit.leftImage} style={styles.rearPhotoImage} resizeMode="cover" />
      </View>

      <View
        style={[
          styles.rearPhotoCard,
          {
            width: rearCardWidth,
            height: rearCardHeight,
            right: width * 0.06,
            top: phoneHeight * 0.36,
            transform: [{ rotate: '9deg' }],
          },
        ]}
      >
        <Image source={benefit.rightImage} style={styles.rearPhotoImage} resizeMode="cover" />
      </View>

      <View style={[styles.sparkleLeft, { left: width * 0.16, top: phoneHeight * 0.16 }]}>
        <SparkleIcon size={18} />
        <SparkleIcon size={30} />
      </View>

      <View style={[styles.sparkleRight, { right: width * 0.1, bottom: 12 }]}>
        <CameraOutlineIcon />
      </View>

      <View style={[styles.phoneShell, { width: phoneWidth, height: phoneHeight }]}>
        <View style={styles.phoneBezel} />
        <View style={styles.phoneHeader}>
          <View style={styles.phoneHeaderTop}>
            <View style={styles.phoneBackPill}>
              <BackChevronIcon size={14} color="#F5F2ED" />
            </View>
            <View style={styles.phoneStatusWrap}>
              <View style={styles.phoneDynamicIsland} />
              <AppText variant="caption" style={styles.phoneStatusText}>
                23:13
              </AppText>
            </View>
          </View>
          <View style={styles.phoneTitleRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" style={styles.phoneEventName} numberOfLines={1}>
                {benefit.eventName}
              </AppText>
              <AppText variant="bodySmall" style={styles.phoneEventSubtitle} numberOfLines={1}>
                {benefit.subtitle}
              </AppText>
            </View>
            <View style={styles.liveBadge}>
              <AppText variant="caption" style={styles.liveBadgeText}>
                LIVE
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.phoneGalleryGrid}>
          {benefit.phoneImages.slice(0, 6).map((imageSource, index) => {
            const isWide = index === 4;
            return (
              <View
                key={`${benefit.id}-${index}`}
                style={[
                  styles.phoneGalleryCell,
                  isWide && styles.phoneGalleryCellWide,
                ]}
              >
                <Image source={imageSource} style={styles.phoneGalleryImage} resizeMode="cover" />
              </View>
            );
          })}
        </View>
        <View style={styles.phoneBottomFade} pointerEvents="none" />
      </View>
    </View>
  );
}

function PaginationDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === activeIndex ? styles.dotActive : null,
          ]}
        />
      ))}
    </View>
  );
}

function getParticipantLimit(plan: PlanWithEntitlements): number | null {
  const value = plan.entitlements.participant_limit;
  if (value === null) return null;
  if (typeof value === 'number') {
    return value >= 99999 ? null : value;
  }
  return null;
}

function getCapacityDisplay(plan: PlanWithEntitlements): {
  topLabel: string;
  bottomLabel: string;
} {
  if (plan.key === 'guests_5') {
    return { topLabel: 'Free', bottomLabel: 'Up to 5 guests' };
  }

  const limit = getParticipantLimit(plan);
  if (limit === null) {
    return { topLabel: 'Unlimited', bottomLabel: 'guests' };
  }

  return { topLabel: String(limit), bottomLabel: 'guests' };
}

function getPillCopy(
  plan: PlanWithEntitlements,
  plans: PlanWithEntitlements[],
  locale: string,
): string {
  if (plan.key === 'guests_5') return 'Try it out';
  if (plan.key === 'guests_25') return 'Starting package';
  if (plan.key === 'guests_unlimited') return 'All your guests';

  const planIndex = plans.findIndex((candidate) => candidate.key === plan.key);
  const previous = planIndex > 0 ? plans[planIndex - 1] : null;
  const currentLimit = getParticipantLimit(plan);
  const previousLimit = previous ? getParticipantLimit(previous) : null;

  if (
    previous &&
    currentLimit !== null &&
    previousLimit !== null &&
    previousLimit > 0 &&
    previous.priceMinorUnits > 0
  ) {
    const requiredPreviousPlans = Math.ceil(currentLimit / previousLimit);
    const equivalentCost = previous.priceMinorUnits * requiredPreviousPlans;
    const saving = equivalentCost - plan.priceMinorUnits;
    if (saving > 0) {
      return `Save ${formatPrice(saving, plan.currency, locale)}`;
    }
  }

  if (plan.key === MOST_POPULAR_KEY) return 'Best value';
  if (plan.key === 'guests_100') return 'Big celebration';
  if (plan.key === 'guests_150') return 'Large guest list';
  if (plan.key === 'guests_200') return 'Maximum capacity';
  return 'Great choice';
}

function ctaPriceLabel(plan: PlanWithEntitlements | null): string {
  if (!plan) return '';
  if (plan.key === 'guests_5' && plan.priceMinorUnits === 0) return 'Free';
  if (plan.priceMinorUnits === 0) return 'Free';
  return formatPrice(plan.priceMinorUnits, plan.currency, LOCALE_CONFIG.locale);
}

export default function PackageStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { draft, update } = useCreationDraft();

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const benefitListRef = useRef<FlatList<Benefit>>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: planKeys.catalogue(),
    queryFn: fetchCatalogue,
  });

  const plans = useMemo(() => {
    const source = data?.plans && data.plans.length > 0 ? data.plans : FALLBACK_PLANS;
    const byKey = new Map(source.map((plan) => [plan.key, plan]));
    return PLAN_ORDER.map((key) => byKey.get(key)).filter((plan): plan is PlanWithEntitlements => Boolean(plan));
  }, [data]);

  const defaultPlanKey = plans.find((plan) => plan.key === MOST_POPULAR_KEY)?.key ?? plans[0]?.key ?? null;
  const selectedPlanKey = draft.planKey && plans.some((plan) => plan.key === draft.planKey)
    ? draft.planKey
    : defaultPlanKey;

  useEffect(() => {
    if (draft.addOnKeys.length > 0) {
      update({ addOnKeys: [] });
    }
  }, [draft.addOnKeys.length, update]);

  useEffect(() => {
    if (selectedPlanKey && draft.planKey !== selectedPlanKey) {
      update({ planKey: selectedPlanKey });
    }
  }, [draft.planKey, selectedPlanKey, update]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selectedPlanKey) ?? null,
    [plans, selectedPlanKey],
  );

  const carouselWidth = screenWidth - layout.gutter * 2;
  const cardWidth = Math.max(86, Math.min(98, Math.round(screenWidth * 0.23)));
  const cardHeight = Math.max(158, Math.min(212, Math.round(screenHeight * 0.205)));

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const scrollToSlide = useCallback(
    (index: number, animated = true) => {
      benefitListRef.current?.scrollToOffset({
        offset: index * carouselWidth,
        animated,
      });
      setActiveSlide(index);
    },
    [carouselWidth],
  );

  const restartAutoAdvance = useCallback(() => {
    clearAutoAdvanceTimer();
    autoAdvanceTimerRef.current = setTimeout(() => {
      const nextIndex = (activeSlide + 1) % BENEFITS.length;
      scrollToSlide(nextIndex);
    }, 2000);
  }, [activeSlide, clearAutoAdvanceTimer, scrollToSlide]);

  useEffect(() => {
    restartAutoAdvance();
    return clearAutoAdvanceTimer;
  }, [activeSlide, restartAutoAdvance, clearAutoAdvanceTimer]);

  const handleBenefitScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
      setActiveSlide(Math.max(0, Math.min(BENEFITS.length - 1, nextIndex)));
    },
    [carouselWidth],
  );

  async function handlePublish() {
    if (!selectedPlan) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      const result = await publishDraft({ ...draft, planKey: selectedPlan.key, addOnKeys: [] });
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

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={MUTED_TEXT} />
        </View>
      </View>
    );
  }

  if (isError || !plans.length) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingWrap}>
          <AppText variant="body" tone="error" align="center">
            Something went wrong loading packages.
          </AppText>
        </View>
      </View>
    );
  }

  const activeBenefit = BENEFITS[activeSlide] ?? BENEFITS[0];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 160,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <BackChevronIcon />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <AppText variant="displayLarge" align="center" style={styles.headerTitle}>
              Create your event
            </AppText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroSection}>
          <FlatList
            ref={benefitListRef}
            data={BENEFITS}
            horizontal
            pagingEnabled
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={clearAutoAdvanceTimer}
            onMomentumScrollEnd={handleBenefitScrollEnd}
            renderItem={({ item }) => (
              <View style={{ width: carouselWidth }}>
                <BenefitArtwork benefit={item} width={carouselWidth} />
              </View>
            )}
          />

          <View style={styles.heroCopyBlock}>
            <AppText variant="displayLarge" align="center" style={styles.heroHeadline}>
              {activeBenefit.headline}
            </AppText>
            <AppText variant="bodyLarge" align="center" style={styles.heroBody}>
              {activeBenefit.body}
            </AppText>
          </View>

          <PaginationDots count={BENEFITS.length} activeIndex={activeSlide} />
        </View>

        <View style={styles.packagesSection}>
          <AppText variant="heading" style={styles.capacityHeading}>
            Choose your guest capacity
          </AppText>

          <FlatList
            data={plans}
            horizontal
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.packageRail}
            decelerationRate="fast"
            snapToAlignment="start"
            renderItem={({ item }) => {
              const active = item.key === selectedPlanKey;
              const { topLabel, bottomLabel } = getCapacityDisplay(item);
              const isMostPopular = item.key === MOST_POPULAR_KEY;
              const valueCopy = getPillCopy(item, plans, LOCALE_CONFIG.locale);

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    update({ planKey: item.key });
                  }}
                  style={({ pressed }) => [
                    styles.packageCardWrap,
                    { width: cardWidth, height: cardHeight + (isMostPopular ? 16 : 0) },
                    pressed && styles.pressed,
                  ]}
                >
                  {isMostPopular ? (
                    <View style={styles.mostPopularBadge}>
                      <AppText variant="caption" style={styles.mostPopularLabel}>
                        MOST POPULAR
                      </AppText>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.packageCard,
                      { width: cardWidth, height: cardHeight },
                      active && styles.packageCardActive,
                      isMostPopular ? styles.packageCardWithBadge : null,
                    ]}
                  >
                    <View style={styles.packageCardTop}>
                      <AppText
                        variant="numericLarge"
                        align="center"
                        style={[
                          styles.packageCapacity,
                          item.key === 'guests_unlimited' ? styles.packageCapacityUnlimited : null,
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {topLabel}
                      </AppText>
                      <AppText
                        variant="bodyLarge"
                        align="center"
                        style={item.key === 'guests_5' ? styles.packageSubLabelFree : styles.packageSubLabel}
                        numberOfLines={2}
                      >
                        {bottomLabel}
                      </AppText>
                    </View>

                    <View style={styles.packageDivider} />

                    <View style={styles.packageCardBottom}>
                      <View style={styles.valuePill}>
                        <AppText variant="labelLarge" align="center" style={styles.valuePillText}>
                          {valueCopy}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.ctaDock,
          {
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {publishError ? (
          <AppText variant="caption" tone="error" align="center" style={styles.publishError}>
            {publishError}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectedPlan ? `Create my event for ${ctaPriceLabel(selectedPlan)}` : 'Create my event'}
          disabled={!selectedPlan || isPublishing}
          onPress={() => void handlePublish()}
          style={({ pressed }) => [
            styles.ctaButton,
            (!selectedPlan || isPublishing) && styles.ctaButtonDisabled,
            pressed && styles.ctaPressed,
          ]}
        >
          {isPublishing ? (
            <ActivityIndicator color="#111111" />
          ) : (
            <AppText variant="button" align="center" style={styles.ctaLabel}>
              {selectedPlan ? `Create my event  ·  ${ctaPriceLabel(selectedPlan)}` : 'Create my event'}
            </AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    backgroundColor: SCREEN_BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    color: '#F3EADF',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.25,
  },
  headerSpacer: {
    width: 48,
  },
  heroSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  heroArtworkWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rearPhotoCard: {
    position: 'absolute',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  rearPhotoImage: {
    width: '100%',
    height: '100%',
  },
  sparkleLeft: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    opacity: 0.92,
  },
  sparkleRight: {
    position: 'absolute',
    opacity: 0.92,
  },
  phoneShell: {
    position: 'relative',
    borderRadius: 42,
    overflow: 'hidden',
    backgroundColor: PHONE_BG,
    borderWidth: 6,
    borderColor: '#2D2B2C',
    shadowColor: '#000000',
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  phoneBezel: {
    position: 'absolute',
    top: 10,
    left: '50%',
    marginLeft: -34,
    width: 68,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#0A0A0B',
    zIndex: 3,
  },
  phoneHeader: {
    paddingTop: 16,
    paddingHorizontal: 14,
    gap: spacing.xxs,
  },
  phoneHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  phoneBackPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  phoneStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneDynamicIsland: {
    width: 44,
    height: 12,
    borderRadius: 8,
    backgroundColor: '#0A0A0B',
  },
  phoneStatusText: {
    color: '#ECE5DC',
    fontFamily: fontFamilies.textMedium,
    fontSize: 11,
  },
  phoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  phoneEventName: {
    color: '#F4EFE9',
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  phoneEventSubtitle: {
    color: 'rgba(244,239,233,0.78)',
    fontSize: 10,
    lineHeight: 14,
  },
  liveBadge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  liveBadgeText: {
    color: '#F3EADF',
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  phoneGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
  },
  phoneGalleryCell: {
    width: '48.5%',
    height: 78,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#242426',
  },
  phoneGalleryCellWide: {
    width: '100%',
    height: 92,
  },
  phoneGalleryImage: {
    width: '100%',
    height: '100%',
  },
  phoneBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '28%',
    backgroundColor: 'rgba(9,9,9,0.58)',
  },
  heroCopyBlock: {
    paddingHorizontal: layout.gutter + 8,
    gap: spacing.sm,
  },
  heroHeadline: {
    color: '#F3EADF',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.28,
  },
  heroBody: {
    color: MUTED_TEXT,
    maxWidth: 320,
    alignSelf: 'center',
    fontSize: 17,
    lineHeight: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#F3EADF',
  },
  packagesSection: {
    marginTop: spacing.xl + spacing.xs,
    gap: spacing.md,
  },
  capacityHeading: {
    color: MUTED_TEXT,
    paddingHorizontal: layout.gutter,
    fontFamily: fontFamilies.textRegular,
    fontSize: 18,
    lineHeight: 24,
  },
  packageRail: {
    paddingLeft: layout.gutter,
    paddingRight: layout.gutter * 2.5,
    gap: 10,
  },
  packageCardWrap: {
    position: 'relative',
  },
  packageCard: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  packageCardWithBadge: {
    marginTop: 10,
  },
  packageCardActive: {
    borderWidth: 2,
    borderColor: CARD_BORDER_SELECTED,
  },
  mostPopularBadge: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    alignItems: 'center',
    zIndex: 2,
  },
  mostPopularLabel: {
    backgroundColor: '#F3EADF',
    color: '#111111',
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  packageCardTop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 92,
  },
  packageCapacity: {
    color: '#F3EADF',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.2,
  },
  packageCapacityUnlimited: {
    fontSize: 27,
    lineHeight: 31,
  },
  packageSubLabel: {
    color: MUTED_TEXT,
    fontSize: 16,
    lineHeight: 20,
  },
  packageSubLabelFree: {
    color: MUTED_TEXT,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 72,
  },
  packageDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  packageCardBottom: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 54,
  },
  valuePill: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(232,201,143,0.28)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePillText: {
    color: GOLD_TEXT,
    fontFamily: fontFamilies.textMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  publishError: {
    marginBottom: spacing.sm,
  },
  ctaButton: {
    height: 64,
    borderRadius: 22,
    backgroundColor: '#EFE9E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.45,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  ctaLabel: {
    color: '#111111',
    fontFamily: fontFamilies.textSemiBold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.12,
  },
});
