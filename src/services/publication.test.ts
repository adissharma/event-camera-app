import { purchaseOrThrow, PublicationError } from './publication';
import type { PaymentProvider, PurchaseProduct } from '@/features/payments/types';

// `react-native-purchases` ships untranspiled ESM that Jest cannot parse, and
// importing `publication` pulls it in transitively via `@/features/payments`.
// Nothing here exercises RevenueCat — every test drives a hand-built provider —
// so the native SDK is stubbed rather than added to transformIgnorePatterns.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: {},
  PRODUCT_CATEGORY: {},
  PURCHASES_ERROR_CODE: {},
}));

const product = { id: 'com.example.plan' } as unknown as PurchaseProduct;

function providerReturning(
  products: PurchaseProduct[],
  outcome?: Awaited<ReturnType<PaymentProvider['purchase']>>,
): { provider: PaymentProvider; purchases: PurchaseProduct[] } {
  const purchases: PurchaseProduct[] = [];
  const provider = {
    isAvailable: () => true,
    getProducts: async () => products,
    purchase: async (p: PurchaseProduct) => {
      purchases.push(p);
      return outcome ?? { status: 'purchased' as const, transactionId: 'tx_1' };
    },
    restore: async () => [],
  } as unknown as PaymentProvider;
  return { provider, purchases };
}

describe('purchaseOrThrow', () => {
  it('purchases when the store returns the product', async () => {
    const { provider, purchases } = providerReturning([product]);
    await expect(purchaseOrThrow(provider, 'com.example.plan')).resolves.toBeUndefined();
    expect(purchases).toEqual([product]);
  });

  // The regression this whole helper exists for: an unresolvable product used
  // to SKIP the purchase and let publication continue, giving the paid tier
  // away for free with nothing logged.
  it('throws rather than skipping when the store returns no product', async () => {
    const { provider, purchases } = providerReturning([]);
    await expect(purchaseOrThrow(provider, 'com.example.plan')).rejects.toThrow(PublicationError);
    expect(purchases).toEqual([]);
  });

  it('reports the stage as "purchase" so the caller can tell it apart from a publish failure', async () => {
    const { provider } = providerReturning([]);
    await expect(purchaseOrThrow(provider, 'com.example.plan')).rejects.toMatchObject({
      stage: 'purchase',
    });
  });

  it('throws when the host cancels', async () => {
    const { provider } = providerReturning([product], { status: 'cancelled' });
    await expect(purchaseOrThrow(provider, 'com.example.plan')).rejects.toThrow('Purchase cancelled');
  });

  it('surfaces the store’s own message when the purchase fails', async () => {
    const { provider } = providerReturning([product], {
      status: 'failed',
      code: 'payment_declined',
      message: 'Your card was declined.',
    });
    await expect(purchaseOrThrow(provider, 'com.example.plan')).rejects.toThrow(
      'Your card was declined.',
    );
  });
});
