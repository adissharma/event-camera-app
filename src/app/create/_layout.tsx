import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { useCreationDraft } from '@/features/celebrations/draft/store';
import { PreviewStageProvider } from '@/features/celebrations/creation/preview-stage';
import {
  CaptureLayer,
  CoverLayer,
  GalleryLayer,
} from '@/features/celebrations/creation/preview-stage-layers';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';
import { useAuth } from '@/features/auth/context';
import { resetToUnauthenticatedRoot } from '@/lib/navigation/session-root';

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
      resetToUnauthenticatedRoot(router);
    }
  }, [isBackendConfigured, isRestoring, isSignedIn, router]);

  // Leaving the flow discards it.
  //
  // This layout unmounts when the host navigates out of `/create` by any
  // route — the Back control on the first step, the swipe-back gesture, a
  // deep link, the sign-out redirect above — which is a far more reliable
  // "they left" signal than trying to intercept each of those separately.
  // It does NOT unmount moving between steps, or on the way to `success`,
  // because the whole flow lives under this one layout.
  //
  // A published event is safe: `success` resets the draft first, so there is
  // no `serverCelebrationId` left for this to act on.
  const { draft, reset } = useCreationDraft();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    return () => {
      if (!draftRef.current.serverCelebrationId) return;
      void reset({ discardServerDraft: true });
    };
  }, [reset]);

  return (
    // The phone lives here, above the navigator, so it survives every step in
    // the flow. Inside a step it would be destroyed on navigation, which is
    // the flash this whole arrangement exists to prevent.
    <PreviewStageProvider
      renderLayer={(layer, stageDraft) => {
        if (layer === 'cover') return <CoverLayer draft={stageDraft} />;
        if (layer === 'capture') return <CaptureLayer draft={stageDraft} />;
        return <GalleryLayer draft={stageDraft} />;
      }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          // Transparent, so the phone behind the navigator shows through
          // while it moves. An opaque screen would hide the very thing
          // that is meant to stay continuous.
          contentStyle: { backgroundColor: 'transparent' },
          // The creation chrome performs a deliberate fade → phone move →
          // fade sequence. A native push animation would slide a second page
          // over that composition and make it read as a screen replacement.
          animation: 'none',
        }}
      />
    </PreviewStageProvider>
  );
}
