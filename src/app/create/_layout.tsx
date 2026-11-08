import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { useCreationDraft } from '@/features/celebrations/draft/store';
import { colours } from '@/design';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';

/**
 * The draft provider wraps the whole flow rather than each screen, so moving
 * between steps never remounts it — which would drop the in-memory draft and
 * force a read from disk on every Next.
 */
export default function CreateLayout() {
  const router = useRouter();

  useEffect(() => {
    if (shouldBlockHostRouteOnWeb(Platform.OS)) {
      router.replace('/j/');
    }
  }, [router]);

  // No sign-in gate here. Nothing in this flow touches the server until the
  // paywall, which asks for an account at the moment one is needed.

  // Leaving the flow discards it.
  //
  // This layout unmounts when the host navigates out of `/create` by any
  // route — the Back control on the first step, the swipe-back gesture, a
  // deep link, a sign-out — which is a far more reliable
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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colours.background },
        // CreationStepScreen owns the body entrance animation. Keeping the
        // native route transition still lets the header stay mounted and
        // visually fixed while only the step body moves.
        animation: 'none',
      }}
    />
  );
}
