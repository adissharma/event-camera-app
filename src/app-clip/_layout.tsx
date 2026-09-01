import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
} from '@expo-google-fonts/newsreader';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from '@expo-google-fonts/instrument-sans';

import { colours } from '@/design';
import { queryClient } from '@/lib/query-client';
import { AuthContextProvider } from '@/features/auth/context';

/**
 * Root layout for the APP CLIP.
 *
 * This is a separate expo-router route tree from `src/app`. The Clip build
 * points `expo-router`'s `root` option here (see `app.config.js`), so
 * `require.context` only ever walks this directory — the full app's welcome
 * screen, its background video, sign-in, event creation and host dashboard are
 * never reachable by the bundler and are absent from the Clip binary.
 *
 * Deliberately absent compared to the full app's layout:
 * - `CreationDraftProvider` — event creation only.
 * - `LiveActivitySyncManager` — driven by the host's celebration list.
 * - `seedMockDataIfNeeded` — development seeding for the full app.
 *
 * `AuthContextProvider` is retained because shared guest screens read
 * `session` from it to distinguish a signed-in host viewing their own event.
 * In the Clip there is no sign-in route, so the session is always null and
 * every screen renders its guest branch.
 */
export default function AppClipLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    OpenMojiBlack: require('../../assets/fonts/OpenMoji-black-glyf.ttf'),
  });

  useEffect(() => {
    // Hide on error too — a missing font must degrade to the documented system
    // fallback, never strand the guest on a splash screen.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthContextProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colours.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen
                name="celebration/[celebrationId]/photos/[photoId]"
                options={{
                  presentation: 'transparentModal',
                  animation: 'fade',
                  contentStyle: { backgroundColor: 'transparent' },
                  // The screen pages between photos with its own horizontal
                  // PanResponder drag — see the same-named component. Native
                  // swipe-to-dismiss can't be told apart from that by iOS, so
                  // it fires on every drag right alongside it. Off entirely:
                  // this screen has no legitimate case for the native gesture.
                  gestureEnabled: false,
                }}
              />
            </Stack>
          </AuthContextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
