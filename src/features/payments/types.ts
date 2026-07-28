/**
 * Payment abstraction.
 *
 * Nothing in the app calls a billing SDK directly. That matters more here than
 * in most products, because the platform rules differ per surface and getting
 * them wrong is a store rejection rather than a bug:
 *
 * - iOS unlocks digital functionality, so App Store guideline 3.1.1 requires
 *   StoreKit. Stripe is not permitted for this.
 * - Android requires Play Billing on the same basis.
 * - Web checkout is only valid in genuinely external contexts.
 *
 * See docs/payments.md for the classification decisions that still need a human.
 */

export type PaymentPlatform = 'apple_app_store' | 'google_play' | 'web' | 'development';

export interface PurchaseProduct {
  /** Catalogue key, e.g. `signature`. Stable across platforms. */
  planKey: string;
  /** The store's own identifier for this platform. */
  platformProductId: string;
  priceMinorUnits: number;
  currency: string;
}

export interface PurchaseReceipt {
  platform: PaymentPlatform;
  platformProductId: string;
  /** The store's transaction id. The idempotency key for verification. */
  platformTransactionId: string;
  /** Opaque signed payload, verified server-side. Never trusted client-side. */
  signedPayload?: string;
}

export type PurchaseOutcome =
  | { status: 'purchased'; receipt: PurchaseReceipt }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'failed'; code: string; message: string };

export interface PaymentProvider {
  readonly platform: PaymentPlatform;

  /** True when this provider can actually transact on the current device. */
  isAvailable(): Promise<boolean>;

  /** Prices and availability as the store reports them. */
  getProducts(planKeys: string[]): Promise<PurchaseProduct[]>;

  purchase(product: PurchaseProduct): Promise<PurchaseOutcome>;

  /**
   * Replays past transactions.
   *
   * Required by App Store review: a user who reinstalls, or signs in on a
   * second device, must recover what they paid for without paying again. This
   * is why server-side activation has to be idempotent — a restore delivers
   * every past transaction again.
   */
  restore(): Promise<PurchaseReceipt[]>;
}
