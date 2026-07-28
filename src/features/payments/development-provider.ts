import type {
  PaymentProvider,
  PurchaseOutcome,
  PurchaseProduct,
  PurchaseReceipt,
} from './types';

/**
 * Development payment provider.
 *
 * Contacts no billing service and takes no money. It exists so the whole host
 * journey — configure, publish, share — is exercisable before StoreKit and Play
 * Billing are wired up, which needs a paid Apple Developer account, signed
 * builds and store product records.
 *
 * It is selected only when `FEATURE_FLAGS.realPurchases` is false. The flag is
 * the single switch, so shipping with real purchases enabled cannot
 * accidentally leave this in the path.
 */
export const developmentPaymentProvider: PaymentProvider = {
  platform: 'development',

  async isAvailable() {
    return true;
  },

  async getProducts(planKeys: string[]): Promise<PurchaseProduct[]> {
    // Prices come from the database catalogue, not from here — this provider
    // only reports which keys it can "sell".
    return planKeys.map((planKey) => ({
      planKey,
      platformProductId: `dev.${planKey}`,
      priceMinorUnits: 0,
      currency: 'GBP',
    }));
  },

  async purchase(product: PurchaseProduct): Promise<PurchaseOutcome> {
    return {
      status: 'purchased',
      receipt: {
        platform: 'development',
        platformProductId: product.platformProductId,
        // Deterministic per plan so repeated runs converge on one purchase row
        // rather than accumulating rubbish, exercising the same idempotency
        // path a real store retry would.
        platformTransactionId: `dev-${product.planKey}`,
      },
    };
  },

  async restore(): Promise<PurchaseReceipt[]> {
    // Nothing to restore: no real transaction ever happened.
    return [];
  },
};
