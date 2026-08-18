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
import { queryClient } from '@/lib/query-client';
import { supabaseAuthProvider } from './supabase-provider';
import type { AuthProvider, AuthResult, AuthSession, AuthUser } from './types';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  /** True until the persisted session has been checked on cold start. */
  isRestoring: boolean;
  isSignedIn: boolean;
  isBackendConfigured: boolean;
  isAppleAuthAvailable: boolean;
  requestCode: (email: string) => Promise<AuthResult<void>>;
  verifyCode: (email: string, code: string) => Promise<AuthResult<AuthSession>>;
  signInWithApple: () => Promise<AuthResult<AuthSession>>;
  signInWithGoogle: () => Promise<AuthResult<AuthSession>>;
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
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Check Apple Auth availability
    provider.isAppleAuthAvailable().then((avail) => {
      if (!cancelled) setIsAppleAuthAvailable(avail);
    });

    // Restore before rendering any protected route, so a signed-in user does
    // not see the welcome screen flash past on every cold start.
    provider
      .restoreSession()
      .then((restored) => {
        if (!cancelled) setSession(restored);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    // Covers token refresh and server-side expiry
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

  const signInWithApple = useCallback(async () => {
    const result = await provider.signInWithApple();
    if (result.ok) setSession(result.value);
    return result;
  }, [provider]);

  const signInWithGoogle = useCallback(async () => {
    const result = await provider.signInWithGoogle();
    if (result.ok) setSession(result.value);
    return result;
  }, [provider]);

  const signOut = useCallback(async () => {
    try {
      await provider.signOut();
    } finally {
      setSession(null);
      queryClient.clear();
    }
  }, [provider]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isRestoring,
      isSignedIn: session !== null,
      isBackendConfigured,
      isAppleAuthAvailable,
      requestCode,
      verifyCode,
      signInWithApple,
      signInWithGoogle,
      signOut,
    }),
    [
      session,
      isRestoring,
      isAppleAuthAvailable,
      requestCode,
      verifyCode,
      signInWithApple,
      signInWithGoogle,
      signOut,
    ],
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
