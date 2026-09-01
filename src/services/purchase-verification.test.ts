import { verifyPurchase, VerificationError, toDatabasePlatform } from './purchase-verification';
import type { PurchaseReceipt } from '@/features/payments/types';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {} }));

// `mock` prefix is required: jest.mock factories are hoisted above the file,
// so only variables named this way may be referenced from inside one.
const mockGetSession = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  isBackendConfigured: true,
  requireSupabase: () => ({ auth: { getSession: () => mockGetSession() } }),
}));

const appleReceipt: PurchaseReceipt = {
  platform: 'apple_app_store',
  platformProductId: 'com.potoevents.eventcamera.package.stories_plus',
  platformTransactionId: 'txn_1',
};

function mockFetch(...responses: Array<{ ok: boolean; status: number } | 'throw'>) {
  const fn = jest.fn();
  for (const r of responses) {
    if (r === 'throw') fn.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    else fn.mockResolvedValueOnce(r as Response);
  }
  (globalThis as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } });
});
afterEach(() => jest.useRealTimers());

describe('verifyPurchase', () => {
  it('accepts a verified purchase', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200 });
    await expect(verifyPurchase(appleReceipt)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // The development provider never produces a store transaction, and the
  // server grants those under its own switch. Calling out would 404.
  it('skips verification for non-store platforms', async () => {
    const fetchMock = mockFetch();
    await expect(
      verifyPurchase({ ...appleReceipt, platform: 'development' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not retry a purchase that belongs to someone else', async () => {
    const fetchMock = mockFetch({ ok: false, status: 403 });
    await expect(verifyPurchase(appleReceipt)).rejects.toMatchObject({
      code: 'unauthenticated',
      recoverable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry an unrecorded purchase', async () => {
    const fetchMock = mockFetch({ ok: false, status: 404 });
    await expect(verifyPurchase(appleReceipt)).rejects.toMatchObject({
      code: 'not_recorded',
      recoverable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires a session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(verifyPurchase(appleReceipt)).rejects.toBeInstanceOf(VerificationError);
  });
});

describe('toDatabasePlatform', () => {
  // Regression: the client's 'development' platform was passed straight into
  // an RPC whose `purchase_platform` enum has no such value. Postgres
  // rejected the whole call, and it surfaced to the host as "payment went
  // through but the upgrade could not be applied" — a payment error for what
  // was really a type mismatch.
  it('maps development onto web, which the database enum has', () => {
    expect(toDatabasePlatform('development')).toBe('web');
  });

  it('passes the real stores through unchanged', () => {
    expect(toDatabasePlatform('apple_app_store')).toBe('apple_app_store');
    expect(toDatabasePlatform('google_play')).toBe('google_play');
    expect(toDatabasePlatform('web')).toBe('web');
  });
});
