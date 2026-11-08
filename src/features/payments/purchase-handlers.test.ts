/**
 * The API handlers' half of purchase verification.
 *
 * Lives here rather than beside the handlers because Vercel deploys every file
 * under `api/` as a function. The database's half, that a product must really
 * buy the plan it claims, is covered by
 * supabase/tests/070_purchase_product_match.test.sql.
 */
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

import { createClient } from '@supabase/supabase-js';

import revenueCatWebhook from '../../../api/revenuecat-webhook';
import verifyPurchase from '../../../api/verify-purchase';
import { UPGRADE_PATHS } from './upgrade-catalogue';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const MISMATCH = { message: 'product does not grant this purchase' };
const CHEAP = 'com.potoevents.eventcamera.package.small_event';

function fakeResponse() {
  const response: any = { statusCode: 0, body: undefined };
  response.status = (code: number) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body: unknown) => {
    response.body = body;
    return response;
  };
  return response;
}

function fakeSupabase(rpcResult: { error: { message: string } | null }) {
  const rpc = jest.fn().mockResolvedValue(rpcResult);
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: {
        id: 'purchase-1',
        celebration_id: 'event-1',
        purchased_by: 'user-1',
        platform: 'apple_app_store',
        // The client's claim. Must play no part in the decision.
        platform_product_id: 'com.potoevents.eventcamera.package.stories_plus',
        status: 'pending',
      },
    }),
  };
  (createClient as jest.Mock).mockReturnValue({
    rpc,
    from: () => query,
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  });
  return rpc;
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'http://db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.REVENUECAT_SECRET_API_KEY = 'revenuecat';
  process.env.REVENUECAT_WEBHOOK_SECRET = 'hook';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      subscriber: {
        non_subscriptions: { [CHEAP]: [{ store_transaction_id: 'txn-1', purchase_date: '2026-11-08' }] },
      },
    }),
  }) as any;
});

afterEach(() => jest.restoreAllMocks());

describe('verify-purchase', () => {
  const request = {
    method: 'POST',
    headers: { authorization: 'Bearer user-token' },
    body: { transactionId: 'txn-1' },
  };

  it('hands the database the product RevenueCat confirmed, not the one recorded', async () => {
    const rpc = fakeSupabase({ error: null });
    const response = fakeResponse();

    await verifyPurchase(request, response);

    expect(rpc).toHaveBeenCalledWith('activate_verified_purchase', {
      p_platform: 'apple_app_store',
      p_platform_transaction_id: 'txn-1',
      p_verified_product_id: CHEAP,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'verified', celebrationId: 'event-1' });
  });

  it('reports a product that does not buy the plan, and claims no verification', async () => {
    fakeSupabase({ error: MISMATCH });
    const response = fakeResponse();

    await verifyPurchase(request, response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ error: 'product_mismatch' });
  });

  it('treats any other database failure as a failure to activate', async () => {
    fakeSupabase({ error: { message: 'connection reset' } });
    const response = fakeResponse();

    await verifyPurchase(request, response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'activation_failed' });
  });
});

describe('revenuecat-webhook', () => {
  const grant = (event: Record<string, unknown>) => ({
    method: 'POST',
    headers: { authorization: 'Bearer hook' },
    body: {
      event: { type: 'NON_RENEWING_PURCHASE', store: 'APP_STORE', transaction_id: 'txn-1', ...event },
    },
  });

  it('hands the database the product in the event', async () => {
    const rpc = fakeSupabase({ error: null });
    const response = fakeResponse();

    await revenueCatWebhook(grant({ product_id: CHEAP }), response);

    expect(rpc).toHaveBeenCalledWith(
      'activate_verified_purchase',
      expect.objectContaining({ p_platform_transaction_id: 'txn-1', p_verified_product_id: CHEAP }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'granted' });
  });

  it('passes no product when the event has none, so the database can refuse it', async () => {
    const rpc = fakeSupabase({ error: MISMATCH });
    const response = fakeResponse();

    await revenueCatWebhook(grant({}), response);

    expect(rpc).toHaveBeenCalledWith(
      'activate_verified_purchase',
      expect.objectContaining({ p_verified_product_id: null }),
    );
    expect(response.body).toEqual({ ignored: true, reason: 'product_mismatch' });
  });

  it('acknowledges a mismatch without granting, because a retry cannot help', async () => {
    fakeSupabase({ error: MISMATCH });
    const response = fakeResponse();

    await revenueCatWebhook(grant({ product_id: CHEAP }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ignored: true, reason: 'product_mismatch' });
  });

  it('still asks RevenueCat to retry a transient failure', async () => {
    fakeSupabase({ error: { message: 'connection reset' } });
    const response = fakeResponse();

    await revenueCatWebhook(grant({ product_id: CHEAP }), response);

    expect(response.statusCode).toBe(500);
  });
});

describe('upgrade products known to the server', () => {
  it('match the catalogue, or a paid upgrade would be refused', () => {
    const migrations = path.join(process.cwd(), 'supabase/migrations');
    const migration = readdirSync(migrations).find((name) =>
      name.endsWith('_purchase_product_must_match_plan.sql'),
    );
    const sql = readFileSync(path.join(migrations, migration!), 'utf8');
    const rows = [...sql.matchAll(/\('(com\.[^']+)', '(\w+)', '(\w+)'\)/g)].map(
      ([, product, from, to]) => `${product} ${from} ${to}`,
    );

    expect(rows.sort()).toEqual(
      UPGRADE_PATHS.map(
        (upgrade) => `${upgrade.storeProductId} ${upgrade.from.catalogueKey} ${upgrade.to.catalogueKey}`,
      ).sort(),
    );
  });
});
