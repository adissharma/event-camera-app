import type { AuthError as SupabaseAuthError, Session } from '@supabase/supabase-js';

import { requireSupabase, supabase } from '@/lib/supabase/client';
import type {
  AuthErrorCode,
  AuthProvider,
  AuthResult,
  AuthSession,
} from './types';

/**
 * Supabase implementation of the auth abstraction.
 *
 * Uses six-digit email OTP rather than magic links. In a native app a magic
 * link means leaving the app for a mail client and hoping the deep link
 * survives the round trip — and mail clients that pre-fetch links can consume a
 * single-use token before the user ever taps it. A code the user reads and
 * types works from any mail client, on any device, including one that is not
 * the phone running the app.
 *
 * SETUP REQUIRED: the Supabase "Magic Link" email template must contain
 * `{{ .Token }}`. The stock template only includes `{{ .ConfirmationURL }}`,
 * so the email arrives without a code and verification cannot succeed. See
 * docs/auth-setup.md.
 */

function toSession(session: Session | null): AuthSession | null {
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      displayName:
        (session.user.user_metadata?.display_name as string | undefined) ?? null,
    },
    expiresAt: session.expires_at ?? null,
  };
}

/** Maps a Supabase error to a code a screen can branch on. */
function classify(error: SupabaseAuthError): { code: AuthErrorCode; message: string } {
  const raw = error.message.toLowerCase();

  if (raw.includes('rate limit') || error.status === 429) {
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
  if (raw.includes('network') || raw.includes('fetch')) {
    return { code: 'network', message: 'No connection. Check your network and try again.' };
  }
  // Deliberately generic: an auth error message can leak whether an account
  // exists, which is a user-enumeration weakness.
  return { code: 'unknown', message: 'Something went wrong. Try again.' };
}

const notConfigured: AuthResult<never> = {
  ok: false,
  error: {
    code: 'not_configured',
    message: 'The app is not connected to a backend yet.',
  },
};

export const supabaseAuthProvider: AuthProvider = {
  async requestCode(email) {
    if (!supabase) return notConfigured;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // Registration and sign-in are the same journey. A separate "create
        // account" path would ask the user to remember whether they have one.
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

    // Idempotent repair path. The database trigger creates the personal
    // workspace, but a user created before that trigger existed — or one whose
    // bootstrap failed — would otherwise be able to sign in and then be unable
    // to create an event. Cheap to call, and it fixes the account in place.
    try {
      await supabase.rpc('ensure_personal_workspace');
    } catch {
      // Non-fatal. Home will surface the failure if the workspace is genuinely
      // missing; blocking sign-in over it would be worse.
    }

    return { ok: true, value: session };
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
