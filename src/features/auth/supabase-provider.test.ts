/* eslint-disable import/first -- Jest hoists these native-module mocks. */
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'raw-nonce',
  digestStringAsync: async () => 'hashed-nonce',
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('@/lib/monitoring', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithIdToken: jest.fn(),
      getSession: jest.fn(),
    },
    rpc: jest.fn(),
  },
  requireSupabase: jest.fn(),
}));

import { Platform } from 'react-native';
import * as AppleAuth from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase/client';
import { supabaseAuthProvider } from './supabase-provider';
/* eslint-enable import/first */

const mockIsAvailable = AppleAuth.isAvailableAsync as jest.Mock;
const mockSignIn = AppleAuth.signInAsync as jest.Mock;
const mockSignInWithIdToken = supabase!.auth.signInWithIdToken as jest.Mock;
const mockGetSession = supabase!.auth.getSession as jest.Mock;
const mockRpc = supabase!.rpc as jest.Mock;

describe('native Apple sign in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockIsAvailable.mockResolvedValue(true);
    mockSignIn.mockResolvedValue({ identityToken: 'apple-token', fullName: null });
    mockSignInWithIdToken.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'person@example.com', identities: [] } } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });
  });

  it('returns a visible failure without trying browser OAuth when native auth is unavailable', async () => {
    mockIsAvailable.mockResolvedValue(false);

    const result = await supabaseAuthProvider.signInWithApple();

    expect(result).toMatchObject({ ok: false, error: { code: 'provider_error' } });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('does not claim success when Supabase returns no session', async () => {
    mockSignInWithIdToken.mockResolvedValue({ data: { session: null }, error: null });

    const result = await supabaseAuthProvider.signInWithApple();

    expect(result).toMatchObject({ ok: false });
  });

  it('reports a cancelled native sheet without creating a session', async () => {
    mockSignIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    const result = await supabaseAuthProvider.signInWithApple();

    expect(result).toMatchObject({ ok: false, error: { code: 'cancelled' } });
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it('gives a retry instruction when the Apple sheet cannot start', async () => {
    mockSignIn.mockRejectedValue({ code: '1000', message: 'Authorization failed' });

    const result = await supabaseAuthProvider.signInWithApple();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'provider_error', message: expect.stringContaining('Apple Account') },
    });
  });

  it('exchanges the Apple token and nonce for a real session', async () => {
    const result = await supabaseAuthProvider.signInWithApple();

    expect(mockSignIn).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }));
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple', token: 'apple-token', nonce: 'raw-nonce',
    });
    expect(result).toMatchObject({ ok: true, value: { user: { id: 'user-1' } } });
  });
});
