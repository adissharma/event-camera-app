import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { AuthResult, AuthSession, AuthUser } from '@/features/auth/types';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
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

const unsupported = async <T,>(): Promise<AuthResult<T>> => ({
  ok: false as const,
  error: { code: 'unknown' as const, message: 'Account sign-in is not available in the App Clip.' },
});

const AuthContext = createContext<AuthContextValue | null>(null);

/** Guest identity is owned by the event-scoped guest token, never an account. */
export function AuthContextProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      session: null,
      user: null,
      isRestoring: false,
      isSignedIn: false,
      isBackendConfigured: true,
      isAppleAuthAvailable: false,
      requestCode: unsupported,
      verifyCode: unsupported,
      signInWithApple: unsupported,
      signInWithGoogle: unsupported,
      signOut: async () => {},
    }),
    [],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthContextProvider');
  return context;
}
