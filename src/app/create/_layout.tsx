import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { CreationDraftProvider } from '@/features/celebrations/draft/store';
import { colours } from '@/design';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';
import { useAuth } from '@/features/auth/context';

/**
 * The draft provider wraps the whole flow rather than each screen, so moving
 * between steps never remounts it — which would drop the in-memory draft and
 * force a read from disk on every Next.
 */
export default function CreateLayout() {
  const router = useRouter();
  const { isSignedIn, isRestoring, isBackendConfigured } = useAuth();

  useEffect(() => {
    if (shouldBlockHostRouteOnWeb(Platform.OS)) {
      router.replace('/j/');
    }
  }, [router]);

  // `create_celebration_with_default_session` requires a real Supabase Auth
  // session — it's revoked from `anon` — but nothing on the welcome screen's
  // path into this flow enforces sign-in first. Without this guard, a host
  // can fill out every step and only discover they were never signed in when
  // publish fails at the very end, with a generic "check your connection"
  // error that has nothing to do with the actual problem. Skipped when the
  // backend isn't configured at all — that's the typed dev fallback, which
  // has no real auth concept. `isRestoring` must gate this too: session is
  // briefly null on cold start while the persisted session loads, and
  // redirecting during that window would kick out an already-signed-in host.
  useEffect(() => {
    if (isBackendConfigured && !isRestoring && !isSignedIn) {
      router.replace('/' as never);
    }
  }, [isBackendConfigured, isRestoring, isSignedIn, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colours.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
