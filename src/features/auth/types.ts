/**
 * Authentication abstraction.
 *
 * Screens depend on this interface, never on Supabase directly. Supports
 * Sign in with Apple, Sign in with Google, and Email OTP authentication.
 */

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  providers?: string[];
  createdAt?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  /** Epoch seconds. Used to detect an expired session on cold start. */
  expiresAt: number | null;
}

/**
 * Result of an auth operation.
 *
 * A discriminated union rather than throwing: every failure here is an expected
 * part of the flow (wrong code, expired code, rate limited, user cancelled), and a screen has
 * to render each differently.
 */
export type AuthResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AuthError };

export interface AuthError {
  code: AuthErrorCode;
  /** Safe to display. Never contains a token or internal detail. */
  message: string;
}

export type AuthErrorCode =
  | 'invalid_email'
  | 'invalid_code'
  | 'expired_code'
  | 'rate_limited'
  | 'cancelled'
  | 'network'
  | 'provider_error'
  | 'not_configured'
  | 'unknown';

export interface AuthProvider {
  /** Sends a six-digit code to the email address. */
  requestCode(email: string): Promise<AuthResult<void>>;

  /** Exchanges a code for a session. */
  verifyCode(email: string, code: string): Promise<AuthResult<AuthSession>>;

  /** Sign in with Apple (native iOS sheet or web OAuth). */
  signInWithApple(): Promise<AuthResult<AuthSession>>;

  /** Sign in with Google (native OAuth web-browser or web redirect). */
  signInWithGoogle(): Promise<AuthResult<AuthSession>>;

  /** Checks if native Apple authentication is available on the current device. */
  isAppleAuthAvailable(): Promise<boolean>;

  /** Restores a persisted session, refreshing it if needed. */
  restoreSession(): Promise<AuthSession | null>;

  /** Signs out and clears the local authenticated session. */
  signOut(): Promise<void>;

  /** Fires on sign-in, sign-out, token refresh and expiry. Returns an unsubscribe. */
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
}
