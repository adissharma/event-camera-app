import { Platform } from 'react-native';
import type { AuthError as SupabaseAuthError, Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { makeRedirectUri } from 'expo-auth-session';

import { requireSupabase, supabase } from '@/lib/supabase/client';
import type {
  AuthErrorCode,
  AuthProvider,
  AuthResult,
  AuthSession,
} from './types';

// Complete any pending web browser auth sessions on web/mobile
WebBrowser.maybeCompleteAuthSession();

function toSession(session: Session | null): AuthSession | null {
  if (!session?.user) return null;
  const rawMeta = session.user.user_metadata ?? {};
  const displayName =
    (rawMeta.display_name as string | undefined) ??
    (rawMeta.full_name as string | undefined) ??
    (rawMeta.name as string | undefined) ??
    null;

  const avatarUrl =
    (rawMeta.avatar_url as string | undefined) ??
    (rawMeta.picture as string | undefined) ??
    null;

  const identities = session.user.identities ?? [];
  const providers = identities.map((i) => i.provider).filter(Boolean);

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      displayName,
      avatarUrl,
      providers: providers.length > 0 ? providers : ['email'],
      createdAt: session.user.created_at ?? null,
    },
    expiresAt: session.expires_at ?? null,
  };
}

/** Maps a Supabase or Native error to an AuthError code. */
function classify(error: unknown): { code: AuthErrorCode; message: string } {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Try again.' };
  }

  const err = error as { message?: string; status?: number; code?: string };
  const raw = (err.message ?? '').toLowerCase();
  const code = (err.code ?? '').toLowerCase();

  if (
    code.includes('cancel') ||
    code === 'err_request_canceled' ||
    code === 'err_canceled' ||
    code === '1001' || // Apple user cancelled code
    raw.includes('cancel') ||
    raw.includes('user closed')
  ) {
    return { code: 'cancelled', message: 'Sign in was cancelled.' };
  }

  if (raw.includes('rate limit') || err.status === 429) {
    return {
      code: 'rate_limited',
      message: 'Too many attempts. Wait a minute and try again.',
    };
  }
  if (raw.includes('expired')) {
    return { code: 'expired_code', message: 'That code has expired. Request a new one.' };
  }
  if (raw.includes('invalid') && (raw.includes('token') || raw.includes('otp'))) {
    return { code: 'invalid_code', message: 'That code is not right. Check it and try again.' };
  }
  if (raw.includes('email') && raw.includes('invalid')) {
    return { code: 'invalid_email', message: 'That email address does not look right.' };
  }
  if (
    raw.includes('unsupported provider') ||
    raw.includes('provider is not enabled') ||
    raw.includes('unable to detect issuer') ||
    (err.status === 400 && raw.includes('provider'))
  ) {
    return {
      code: 'provider_error',
      message: 'This sign-in provider is not enabled in your Supabase dashboard yet. Enable it under Authentication → Providers.',
    };
  }
  if (raw.includes('provider') || raw.includes('oauth')) {
    return { code: 'provider_error', message: 'Could not connect with authentication provider.' };
  }

  return { code: 'unknown', message: 'Something went wrong. Try again.' };
}

const notConfigured: AuthResult<never> = {
  ok: false,
  error: {
    code: 'not_configured',
    message: 'The app is not connected to a backend yet.',
  },
};

/** Helper to parse query and hash parameters from redirected URL */
function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');

  const extract = (str: string) => {
    const pairs = str.split('&');
    for (const pair of pairs) {
      const [k, v] = pair.split('=');
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  };

  if (hashIdx !== -1) {
    extract(url.substring(hashIdx + 1));
  }
  if (queryIdx !== -1) {
    const end = hashIdx !== -1 && hashIdx > queryIdx ? hashIdx : url.length;
    extract(url.substring(queryIdx + 1, end));
  }

  return params;
}

/** Idempotent workspace and profile repair after successful login */
async function repairWorkspaceIfNeeded() {
  if (!supabase) return;
  try {
    await supabase.rpc('ensure_personal_workspace');
  } catch {
    // Non-fatal. Home surfaces failure if missing.
  }
}

export const supabaseAuthProvider: AuthProvider = {
  async requestCode(email) {
    if (!supabase) return notConfigured;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) return { ok: false, error: classify(error) };
    return { ok: true, value: undefined };
  },

  async verifyCode(email, code) {
    if (!supabase) return notConfigured;

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });

    if (error) return { ok: false, error: classify(error) };

    const session = toSession(data.session);
    if (!session) {
      return {
        ok: false,
        error: { code: 'unknown', message: 'Signed in, but no session was returned.' },
      };
    }

    await repairWorkspaceIfNeeded();
    return { ok: true, value: session };
  },

  async isAppleAuthAvailable() {
    if (Platform.OS !== 'ios') return false;
    try {
      const AppleAuth = await import('expo-apple-authentication');
      return await AppleAuth.isAvailableAsync();
    } catch {
      return false;
    }
  },

  async signInWithApple() {
    if (!supabase) return notConfigured;

    try {
      // 1. Native iOS Apple Sign-In
      if (Platform.OS === 'ios') {
        const AppleAuth = await import('expo-apple-authentication');
        const isAvailable = await AppleAuth.isAvailableAsync();

        if (isAvailable) {
          const rawNonce = Crypto.randomUUID();
          const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            rawNonce,
          );

          const credential = await AppleAuth.signInAsync({
            requestedScopes: [
              AppleAuth.AppleAuthenticationScope.FULL_NAME,
              AppleAuth.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
          });

          if (!credential.identityToken) {
            return {
              ok: false,
              error: { code: 'unknown', message: 'Apple sign-in did not return an identity token.' },
            };
          }

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
          });

          if (error) return { ok: false, error: classify(error) };

          const session = toSession(data.session);
          if (!session) {
            return {
              ok: false,
              error: { code: 'unknown', message: 'Signed in with Apple, but no session returned.' },
            };
          }

          // If Apple returned a full name on first sign-up, sync to profile
          const givenName = credential.fullName?.givenName ?? '';
          const familyName = credential.fullName?.familyName ?? '';
          const fullName = `${givenName} ${familyName}`.trim();
          if (fullName && data.session?.user) {
            try {
              await supabase.auth.updateUser({ data: { display_name: fullName } });
              await supabase.from('profiles').update({ display_name: fullName }).eq('id', data.session.user.id);
              session.user.displayName = fullName;
            } catch {
              // Ignore profile update error
            }
          }

          await repairWorkspaceIfNeeded();
          return { ok: true, value: session };
        }
      }

      // 2. Web or Non-iOS OAuth
      const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : makeRedirectUri({ scheme: 'eventcamera' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) return { ok: false, error: classify(error) };

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return { ok: false, error: { code: 'cancelled', message: 'Sign in was cancelled.' } };
        }

        if (result.type === 'success' && result.url) {
          const params = parseUrlParams(result.url);
          if (params.access_token && params.refresh_token) {
            const { data: sData, error: sErr } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });
            if (sErr) return { ok: false, error: classify(sErr) };
            const session = toSession(sData.session);
            if (session) {
              await repairWorkspaceIfNeeded();
              return { ok: true, value: session };
            }
          } else if (params.code) {
            const { data: exData, error: exErr } = await supabase.auth.exchangeCodeForSession(params.code);
            if (exErr) return { ok: false, error: classify(exErr) };
            const session = toSession(exData.session);
            if (session) {
              await repairWorkspaceIfNeeded();
              return { ok: true, value: session };
            }
          }
        }
      }

      const { data: currentSession } = await supabase.auth.getSession();
      const session = toSession(currentSession.session);
      if (session) return { ok: true, value: session };

      return { ok: true, value: { user: { id: '', email: null, displayName: null }, expiresAt: null } };
    } catch (e) {
      return { ok: false, error: classify(e) };
    }
  },

  async signInWithGoogle() {
    if (!supabase) return notConfigured;

    try {
      const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : makeRedirectUri({ scheme: 'eventcamera' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: Platform.OS !== 'web',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) return { ok: false, error: classify(error) };

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return { ok: false, error: { code: 'cancelled', message: 'Google sign in was cancelled.' } };
        }

        if (result.type === 'success' && result.url) {
          const params = parseUrlParams(result.url);
          if (params.access_token && params.refresh_token) {
            const { data: sData, error: sErr } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });
            if (sErr) return { ok: false, error: classify(sErr) };
            const session = toSession(sData.session);
            if (session) {
              await repairWorkspaceIfNeeded();
              return { ok: true, value: session };
            }
          } else if (params.code) {
            const { data: exData, error: exErr } = await supabase.auth.exchangeCodeForSession(params.code);
            if (exErr) return { ok: false, error: classify(exErr) };
            const session = toSession(exData.session);
            if (session) {
              await repairWorkspaceIfNeeded();
              return { ok: true, value: session };
            }
          }
        }
      }

      const { data: currentSession } = await supabase.auth.getSession();
      const session = toSession(currentSession.session);
      if (session) return { ok: true, value: session };

      return { ok: true, value: { user: { id: '', email: null, displayName: null }, expiresAt: null } };
    } catch (e) {
      return { ok: false, error: classify(e) };
    }
  },

  async restoreSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return toSession(data.session);
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  onSessionChange(listener) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      listener(toSession(session));
    });
    return () => data.subscription.unsubscribe();
  },
};

export { requireSupabase };
