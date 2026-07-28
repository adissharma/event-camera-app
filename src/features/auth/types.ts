/**
 * Authentication abstraction.
 *
 * Screens depend on this interface, never on Supabase directly. Adding Sign in
 * with Apple — which the App Store requires alongside any third-party social
 * sign-in — becomes a second implementation rather than an edit to every screen
 * that touches identity.
 */

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
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
 * part of the flow (wrong code, expired code, rate limited), and a screen has
 * to render each differently. Exceptions would push that branching into a catch
 * block where the type is lost.
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
  | 'network'
  | 'not_configured'
  | 'unknown';

export interface AuthProvider {
  /** Sends a six-digit code to the address. */
  requestCode(email: string): Promise<AuthResult<void>>;

  /** Exchanges a code for a session. */
  verifyCode(email: string, code: string): Promise<AuthResult<AuthSession>>;

  /** Restores a persisted session, refreshing it if needed. */
  restoreSession(): Promise<AuthSession | null>;

  signOut(): Promise<void>;

  /** Fires on sign-in, sign-out, token refresh and expiry. Returns an unsubscribe. */
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
}
