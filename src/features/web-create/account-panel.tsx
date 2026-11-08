import { useState } from 'react';

import { useAuth } from '@/features/auth/context';
import type { AuthResult, AuthSession } from '@/features/auth/types';
import { copy } from '@/i18n';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_LENGTH = 6;

/**
 * Signing in at the end of the form rather than the start.
 *
 * The host has already told us about their event by the time they see this,
 * which is the point: asking for an account first is where most of them would
 * have left. Every method the app offers is here, because the account they
 * make now is the one they must sign in to in the app — and a host who later
 * picks Apple there, having used Google here, would find an empty dashboard.
 */
export function AccountPanel({ onBeforeRedirect }: { onBeforeRedirect: () => void }) {
  const { user, isSignedIn, isBackendConfigured, requestCode, verifyCode, signInWithApple, signInWithGoogle, signOut } =
    useAuth();

  const [step, setStep] = useState<'choose' | 'code'>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'email' | 'code' | 'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | undefined>();

  if (isSignedIn) {
    const provider = user?.providers?.find((name) => name !== 'email') ?? 'email';
    const providerLabel = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'email';
    return (
      <div className="wc-account wc-account-signed-in">
        <div>
          <div className="wc-label">Signed in</div>
          <div className="wc-account-email">{user?.email ?? 'Your account'}</div>
          <p className="wc-help">
            In the app, sign in with {providerLabel === 'email' ? 'this email address' : providerLabel} to manage
            this event.
          </p>
        </div>
        <button type="button" className="wc-text-button" onClick={() => void signOut()}>
          Not you?
        </button>
      </div>
    );
  }

  const trimmedEmail = email.trim();

  async function sendCode(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(copy.auth.invalidEmail);
      return;
    }
    setError(undefined);
    setBusy('email');
    const result = await requestCode(trimmedEmail);
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCode('');
    setStep('code');
  }

  async function submitCode(value: string) {
    if (value.length !== CODE_LENGTH || busy) return;
    setError(undefined);
    setBusy('code');
    const result = await verifyCode(trimmedEmail, value);
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      setCode('');
    }
  }

  async function signInWith(provider: 'apple' | 'google', start: () => Promise<AuthResult<AuthSession>>) {
    setError(undefined);
    setBusy(provider);
    // The provider takes the whole page away. Everything typed so far is
    // already saved; this makes sure the last keystroke is too.
    onBeforeRedirect();
    const result = await start();
    setBusy(null);
    if (!result.ok && result.error.code !== 'cancelled') setError(result.error.message);
  }

  const disabled = busy !== null || !isBackendConfigured;

  return (
    <div className="wc-account">
      <div>
        <div className="wc-label">Your account</div>
        <p className="wc-help">
          Your event is saved to this account. Use the same sign-in in the Stills. app to manage it.
        </p>
      </div>

      {error ? (
        <div className="wc-notice wc-notice-error" role="alert">
          {error}
        </div>
      ) : null}

      {step === 'choose' ? (
        <>
          <div className="wc-auth-buttons">
            <button
              type="button"
              className="wc-button wc-button-secondary"
              disabled={disabled}
              onClick={() => void signInWith('apple', signInWithApple)}
            >
              <AppleGlyph />
              {busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
            </button>
            <button
              type="button"
              className="wc-button wc-button-secondary"
              disabled={disabled}
              onClick={() => void signInWith('google', signInWithGoogle)}
            >
              <GoogleGlyph />
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
          </div>

          <div className="wc-divider">
            <span>or</span>
          </div>

          <form className="wc-email-row" onSubmit={(event) => void sendCode(event)}>
            <label className="wc-visually-hidden" htmlFor="wc-email">
              Email address
            </label>
            <input
              id="wc-email"
              className="wc-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={copy.auth.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={disabled}
            />
            <button type="submit" className="wc-button wc-button-secondary" disabled={disabled || !trimmedEmail}>
              {busy === 'email' ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        </>
      ) : (
        <div className="wc-code">
          <label className="wc-label" htmlFor="wc-code">
            Enter the 6-digit code sent to {trimmedEmail}
          </label>
          <input
            id="wc-code"
            className="wc-input wc-input-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            autoFocus
            value={code}
            disabled={busy === 'code'}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
              setCode(value);
              void submitCode(value);
            }}
          />
          <div className="wc-code-actions">
            <button type="button" className="wc-text-button" onClick={() => setStep('choose')}>
              Use a different email
            </button>
            <button type="button" className="wc-text-button" disabled={busy !== null} onClick={() => void sendCode()}>
              Send a new code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.15.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.67zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.75-.96 2.79 1.01.08 2.05-.52 2.68-1.27z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.24 1.4-1.68 4.1-5.4 4.1-3.25 0-5.9-2.69-5.9-6s2.65-6 5.9-6c1.85 0 3.09.79 3.8 1.47l2.59-2.5C16.73 3.6 14.6 2.6 12 2.6 6.82 2.6 2.6 6.82 2.6 12s4.22 9.4 9.4 9.4c5.43 0 9.03-3.82 9.03-9.19 0-.62-.07-1.09-.15-1.56H12z" />
    </svg>
  );
}
