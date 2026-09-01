import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import { REVENUECAT_CONFIG } from '@/config/app-config';
import { PAYWALL_PLANS } from './plan-catalogue';
import { UPGRADE_PATHS } from './upgrade-catalogue';
import type { PaymentProvider, PurchaseProduct, PurchaseReceipt } from './types';

/**
 * What `getProducts` accepts, mapped to what the store calls it.
 *
 * Two kinds of entry, because there are two ways to buy a tier:
 *
 *  - a catalogue key (`guests_100`), for buying a package outright; and
 *  - an upgrade product id, for moving an event up from a package already
 *    paid for, priced at the difference.
 *
 * The upgrade ids map to themselves. They are not plan keys — no plan is
 * called `…upgrade.stories_to_stories_plus` — but callers hold a product id at
 * that point rather than a key, and an identity entry lets one lookup serve
 * both without the caller having to know which kind it is holding. Without
 * these the map simply misses, `getProducts` returns nothing, and every
 * upgrade fails as "not available to purchase" on device while continuing to
 * work against the development provider, which echoes any key back.
 */
const productByPlanKey = new Map<string, string>([
  ...PAYWALL_PLANS.flatMap((plan) =>
    plan.storeProductId ? [[plan.catalogueKey, plan.storeProductId] as const] : [],
  ),
  ...UPGRADE_PATHS.map((path) => [path.storeProductId, path.storeProductId] as const),
]);

/**
 * The reverse, used to label a product the store returned.
 *
 * An upgrade product reports the tier it *grants*, not its own id — that is
 * the plan the purchase ends up activating, and it is what the rest of the app
 * means by `planKey`.
 */
const planKeyByProductId = new Map<string, string>([
  ...PAYWALL_PLANS.flatMap((plan) =>
    plan.storeProductId ? [[plan.storeProductId, plan.catalogueKey] as const] : [],
  ),
  ...UPGRADE_PATHS.map((path) => [path.storeProductId, path.grantsCatalogueKey] as const),
]);

const productCache = new Map<string, PurchasesStoreProduct>();

let configurePromise: Promise<void> | null = null;

function isPurchasesError(error: unknown): error is PurchasesError {
  return Boolean(error && typeof error === 'object' && 'code' in error && 'message' in error);
}

async function ensureConfigured() {
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('RevenueCat purchases are only configured for iOS right now.');
    }
    if (!REVENUECAT_CONFIG.iosApiKey) {
      throw new Error('RevenueCat iOS API key is missing.');
    }

    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: REVENUECAT_CONFIG.iosApiKey });
  })();

  return configurePromise;
}

function toPurchaseProduct(planKey: string, product: PurchasesStoreProduct): PurchaseProduct {
  return {
    planKey,
    platformProductId: product.identifier,
    priceMinorUnits: Math.round(product.price * 100),
    currency: product.currencyCode,
  };
}

function toReceipt(result: Awaited<ReturnType<typeof Purchases.purchaseStoreProduct>>): PurchaseReceipt {
  return {
    platform: 'apple_app_store',
    platformProductId: result.productIdentifier,
    platformTransactionId: result.transaction.transactionIdentifier,
  };
}

export const revenueCatPaymentProvider: PaymentProvider = {
  platform: 'apple_app_store',

  async isAvailable() {
    return Platform.OS === 'ios' && Boolean(REVENUECAT_CONFIG.iosApiKey);
  },

  async getProducts(planKeys) {
    await ensureConfigured();

    const productIds = planKeys
      .map((planKey) => productByPlanKey.get(planKey))
      .filter((productId): productId is string => Boolean(productId));

    if (productIds.length === 0) return [];

    const products = await Purchases.getProducts(productIds, PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    products.forEach((product) => productCache.set(product.identifier, product));

    return products
      .map((product) => {
        const planKey = planKeyByProductId.get(product.identifier);
        return planKey ? toPurchaseProduct(planKey, product) : null;
      })
      .filter((product): product is PurchaseProduct => Boolean(product));
  },

  async purchase(product) {
    await ensureConfigured();

    const storeProduct =
      productCache.get(product.platformProductId) ??
      (await Purchases.getProducts([product.platformProductId], PRODUCT_CATEGORY.NON_SUBSCRIPTION))[0];

    if (!storeProduct) {
      return {
        status: 'failed',
        code: 'product_unavailable',
        message: 'That package is not available for purchase right now.',
      };
    }

    try {
      const result = await Purchases.purchaseStoreProduct(storeProduct);
      return { status: 'purchased', receipt: toReceipt(result) };
    } catch (error) {
      if (
        isPurchasesError(error) &&
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
      ) {
        return { status: 'cancelled' };
      }

      return {
        status: 'failed',
        code: isPurchasesError(error) ? String(error.code) : 'purchase_failed',
        message: isPurchasesError(error)
          ? error.message
          : 'The App Store purchase could not be completed.',
      };
    }
  },

  async restore() {
    await ensureConfigured();

    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.nonSubscriptionTransactions
      .filter((transaction) => planKeyByProductId.has(transaction.productIdentifier))
      .map((transaction) => ({
        platform: 'apple_app_store',
        platformProductId: transaction.productIdentifier,
        platformTransactionId: transaction.transactionIdentifier,
      }));
  },
};
