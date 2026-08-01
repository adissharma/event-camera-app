import { Stack } from 'expo-router';

import { CreationDraftProvider } from '@/features/celebrations/draft/store';
import { colours } from '@/design';

/**
 * The draft provider wraps the whole flow rather than each screen, so moving
 * between steps never remounts it — which would drop the in-memory draft and
 * force a read from disk on every Next.
 */
export default function CreateLayout() {
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
