import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isBackendConfigured } from '@/lib/supabase/client';
import { supabaseAuthProvider } from './supabase-provider';
import type { AuthProvider, AuthResult, AuthSession } from './types';

interface AuthContextValue {
  session: AuthSession | null;
  /** True until the persisted session has been checked on cold start. */
  isRestoring: boolean;
  isSignedIn: boolean;
  isBackendConfigured: boolean;
  requestCode: (email: string) => Promise<AuthResult<void>>;
  verifyCode: (email: string, code: string) => Promise<AuthResult<AuthSession>>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthContextProviderProps {
  children: ReactNode;
  /** Injectable so tests can supply a fake provider. */
  provider?: AuthProvider;
}

export function AuthContextProvider({
  children,
  provider = supabaseAuthProvider,
}: AuthContextProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Restore before rendering any protected route, so a signed-in user does
    // not see the welcome screen flash past on every cold start.
    provider
      .restoreSession()
      .then((restored) => {
        if (!cancelled) setSession(restored);
      })
      .catch(() => {
        // A failed restore is treated as signed out. Better to ask someone to
        // sign in again than to leave them in a broken half-authenticated state.
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    // Also covers token refresh and server-side expiry, so a session that dies
    // while the app is open redirects rather than failing every request.
    const unsubscribe = provider.onSessionChange((next) => {
      if (!cancelled) setSession(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [provider]);

  const requestCode = useCallback(
    (email: string) => provider.requestCode(email),
    [provider],
  );

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const result = await provider.verifyCode(email, code);
      if (result.ok) setSession(result.value);
      return result;
    },
    [provider],
  );

  const signOut = useCallback(async () => {
    await provider.signOut();
    setSession(null);
  }, [provider]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isRestoring,
      isSignedIn: session !== null,
      isBackendConfigured,
      requestCode,
      verifyCode,
      signOut,
    }),
    [session, isRestoring, requestCode, verifyCode, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthContextProvider');
  }
  return context;
}
