import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { CreationDraftProvider } from '@/features/celebrations/draft/store';
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
