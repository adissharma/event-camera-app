import { LOCALE_CONFIG } from '@/config/app-config';
import { formatPrice } from '@/services/plans';

/**
 * The commercial packaging as the host is shown it.
 *
 * One definition, two consumers: the paywall's hero entitlement list and its
 * pricing cards both read from here. That is the point — the previous screen
 * carried its own `FALLBACK_PLANS` array alongside the catalogue's, so "how
 * many guests does Stills Lite include" had two answers that could drift apart.
 * A number typed once cannot disagree with itself.
 *
 * This sits deliberately *beside* `services/plans.ts` rather than replacing
 * it. That module is the commercial catalogue — plan rows, prices and
 * entitlement grants loaded from the database so packaging can change without
 * an app release. This module is the presentation contract: which four tiers
 * the paywall offers, what each one promises in the host's own words, and
 * which catalogue key each maps to. `catalogueKey` is the join between them,
 * and it is what `publishDraft` carries into the purchase and publish stages.
 */

export type PaywallPlanId = 'free' | 'small_event' | 'stories' | 'stories_plus';

/** `'unlimited'` rather than a sentinel number: `99999 guests` is not a promise. */
export type Allowance = number | 'unlimited';

export interface PaywallPlan {
  id: PaywallPlanId;
  displayName: string;
  /**
   * The `plans.key` this tier buys. Everything downstream — the purchase
   * stage in `publishDraft`, `publish_celebration`'s entitlement grants —
   * keys off this, so it must match a row the catalogue actually serves.
   */
  catalogueKey: string;
  guestLimit: Allowance;
  /** Per guest, not per event. */
  photoAllowance: Allowance;
  videos: boolean;
  /**
   * Videos each guest can post, out of their photo allowance. `0` wherever
   * `videos` is false; Free allows one, as a taste of it.
   */
  videosPerGuest: Allowance;
  /** The Guestbook page: its cover, the host's message and settings. */
  guestbook: boolean;
  /**
   * Whether guests can record a message into the Guestbook. Free has the page
   * but not this: guests can open the cover full screen, and only Stills+
   * lets them leave something on it.
   */
  guestbookMessages: boolean;
  challenges: boolean;
  /** Tables and a floor plan guests can find their seat on. Not on Free or Small Event. */
  seating: boolean;
  /** Photos each guest can add from their camera roll. Matches the server's grant. */
  cameraRollUploadLimit: number;
  priceMinorUnits: number;
  currency: string;
  /**
   * The App Store product this maps to.
   *
   * Must be a CONSUMABLE. A package is bought per event, so a host running a
   * second wedding buys the same tier again — and a non-consumable can be
   * purchased once per Apple ID ever, which would hand them every later event
   * free and return the first purchase's transaction id into a `purchases`
   * table that is unique on it.
   *
   * The `.package.` segment exists because the original ids were created as
   * non-consumables and an id cannot be reused once it has existed.
   *
   * The prefix matches the bundle id rather than the product's name. Apple
   * only requires product ids to be unique, so it could have carried the
   * name — but these six already exist in App Store Connect under this
   * prefix, and an id cannot be reused once created. Renaming would mean
   * burning six more ids to buy nothing but tidiness.
   *
   * `null` for the free tier, which never reaches a store.
   *
   * The RevenueCat provider reads this on iOS; the development provider
   * ignores it and synthesises its own `dev.*` identifiers, which is why a
   * wrong or missing id here fails only on device.
   */
  storeProductId: string | null;
  isFree: boolean;
  isRecommended: boolean;
  sortOrder: number;
}

/**
 * Photos per guest on the paid tiers.
 *
 * `stories` is the figure the paywall promises; the capture-limit step offers
 * [5, 10, 16, 24, 36], so 20 is not currently one of the values a host can
 * actually pick. That is a real inconsistency between what this screen sells
 * and what the flow delivers, and it wants a product decision rather than a
 * quiet reconciliation in the UI — so the number lives here, named, where
 * changing it changes every place it is shown.
 */
const PHOTOS_PER_GUEST = {
  free: 10,
  smallEvent: 20,
  stories: 20,
} as const;

export const PAYWALL_PLANS: readonly PaywallPlan[] = [
  {
    id: 'free',
    displayName: 'Free',
    catalogueKey: 'guests_5',
    guestLimit: 5,
    photoAllowance: PHOTOS_PER_GUEST.free,
    videos: true,
    videosPerGuest: 1,
    guestbook: true,
    guestbookMessages: false,
    challenges: true,
    seating: false,
    cameraRollUploadLimit: 5,
    priceMinorUnits: 0,
    currency: LOCALE_CONFIG.currency,
    storeProductId: null,
    isFree: true,
    isRecommended: false,
    sortOrder: 0,
  },
  {
    id: 'small_event',
    displayName: 'Small Event',
    catalogueKey: 'guests_25',
    guestLimit: 25,
    photoAllowance: PHOTOS_PER_GUEST.smallEvent,
    videos: false,
    videosPerGuest: 0,
    guestbook: false,
    guestbookMessages: false,
    challenges: false,
    seating: false,
    cameraRollUploadLimit: 10,
    priceMinorUnits: 1499,
    currency: LOCALE_CONFIG.currency,
    storeProductId: 'com.potoevents.eventcamera.package.small_event',
    isFree: false,
    isRecommended: false,
    sortOrder: 1,
  },
  {
    id: 'stories',
    displayName: 'Stills Lite',
    catalogueKey: 'guests_100',
    guestLimit: 100,
    photoAllowance: PHOTOS_PER_GUEST.stories,
    videos: false,
    videosPerGuest: 0,
    guestbook: false,
    guestbookMessages: false,
    challenges: false,
    seating: true,
    cameraRollUploadLimit: 25,
    priceMinorUnits: 2999,
    currency: LOCALE_CONFIG.currency,
    storeProductId: 'com.potoevents.eventcamera.package.stories',
    isFree: false,
    isRecommended: false,
    sortOrder: 2,
  },
  {
    id: 'stories_plus',
    displayName: 'Stills+',
    catalogueKey: 'guests_unlimited',
    guestLimit: 'unlimited',
    photoAllowance: 'unlimited',
    videos: true,
    videosPerGuest: 'unlimited',
    guestbook: true,
    guestbookMessages: true,
    challenges: true,
    seating: true,
    cameraRollUploadLimit: 100,
    priceMinorUnits: 4999,
    currency: LOCALE_CONFIG.currency,
    storeProductId: 'com.potoevents.eventcamera.package.stories_plus',
    isFree: false,
    isRecommended: true,
    sortOrder: 3,
  },
] as const;

/**
 * Cheaper store products a promo code can charge instead of a package's own.
 *
 * Apple charges a product's fixed price, so a partial discount has to be its
 * own product. Each must exist in App Store Connect before its code can work.
 */
export const PROMO_STORE_PRODUCTS = [
  {
    storeProductId: 'com.potoevents.eventcamera.package.stories_plus_promo_75',
    grantsCatalogueKey: 'guests_unlimited',
  },
] as const;

/** The three cards, in display order. The free tier is a text link, not a card. */
export const PAID_PAYWALL_PLANS: readonly PaywallPlan[] = PAYWALL_PLANS.filter(
  (plan) => !plan.isFree,
).sort((a, b) => a.sortOrder - b.sortOrder);

export const FREE_PAYWALL_PLAN: PaywallPlan =
  PAYWALL_PLANS.find((plan) => plan.isFree) ?? PAYWALL_PLANS[0]!;

export const RECOMMENDED_PLAN_ID: PaywallPlanId =
  PAYWALL_PLANS.find((plan) => plan.isRecommended)?.id ?? 'stories_plus';

/**
 * The top tier's display name, for copy that names the thing being sold.
 *
 * Screens hard-coded "Stills+" in their own strings, which meant renaming the
 * tier renamed it in the paywall and nowhere else — a host would have read one
 * name on the pricing card and a different one on the locked row that sold it,
 * and a third on Apple's purchase sheet. The catalogue is the one place a tier
 * is named; everything else asks.
 */
export function topTierName(): string {
  return getPaywallPlan('stories_plus')?.displayName ?? 'Stills+';
}

export function getPaywallPlan(id: PaywallPlanId | null | undefined): PaywallPlan | null {
  if (!id) return null;
  return PAYWALL_PLANS.find((plan) => plan.id === id) ?? null;
}

/** Reverse lookup, for restoring a selection persisted as a catalogue key. */
export function planForCatalogueKey(key: string | null | undefined): PaywallPlan | null {
  if (!key) return null;
  return PAYWALL_PLANS.find((plan) => plan.catalogueKey === key) ?? null;
}

/**
 * Whether a catalogue key belongs to a tier the host pays nothing for.
 *
 * `publishDraft` asks this before entering the purchase stage. Deciding it
 * from the plan definition rather than from a price of zero keeps "free" a
 * property of the packaging instead of an accident of arithmetic — a paid
 * tier discounted to nothing for a promotion must still go through the store.
 */
export function isFreePlanKey(key: string | null | undefined): boolean {
  return planForCatalogueKey(key)?.isFree === true;
}

export interface PlanFeatureRow {
  key: string;
  label: string;
  included: boolean;
}

/**
 * The entitlement rows shown in the hero, derived from the plan rather than
 * written out per tier.
 *
 * Always the same six, in this order, whichever plan is selected — the rows
 * change wording and state but never count or position, so switching plans
 * reads as the same list answering differently rather than as the layout
 * rearranging itself.
 */
export function planFeatureRows(plan: PaywallPlan): PlanFeatureRow[] {
  return [
    {
      key: 'guests',
      label: plan.guestLimit === 'unlimited' ? 'Unlimited guests' : `${plan.guestLimit} guests`,
      included: true,
    },
    {
      key: 'photos',
      label:
        plan.photoAllowance === 'unlimited'
          ? 'Unlimited photos'
          : `${plan.photoAllowance} photos per guest`,
      included: true,
    },
    { key: 'seating', label: plan.seating ? 'Seating plan' : 'No seating plan', included: plan.seating },
    { key: 'videos', label: videosLabel(plan.videosPerGuest), included: plan.videos },
    {
      key: 'guestbook',
      label: !plan.guestbook
        ? 'No guestbook'
        : plan.guestbookMessages
        ? 'Guestbook'
        : 'Guestbook, no messages',
      included: plan.guestbook,
    },
    {
      key: 'challenges',
      label: plan.challenges ? 'Challenges' : 'No challenges',
      included: plan.challenges,
    },
  ];
}

function videosLabel(allowance: Allowance): string {
  if (allowance === 'unlimited') return 'Unlimited videos';
  if (allowance <= 0) return 'No videos';
  return `${allowance} video${allowance === 1 ? '' : 's'} per guest`;
}

/** The card's one-line capacity summary. */
export function planGuestSubtitle(plan: PaywallPlan): string {
  if (plan.guestLimit === 'unlimited') return 'Unlimited guests';
  return `Up to ${plan.guestLimit} guests`;
}

export function planPriceLabel(plan: PaywallPlan): string {
  return formatPrice(plan.priceMinorUnits, plan.currency, LOCALE_CONFIG.locale);
}

/** What VoiceOver reads for a plan card. */
export function planAccessibilityLabel(
  plan: PaywallPlan,
  priceLabel: string = planPriceLabel(plan),
): string {
  const parts = [plan.displayName, planGuestSubtitle(plan), priceLabel];
  if (plan.isRecommended) parts.push('Most popular');
  return parts.join(', ');
}
