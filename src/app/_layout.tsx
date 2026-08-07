import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
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
import { CreationDraftProvider } from '@/features/celebrations/draft/store';
import { LiveActivitySyncManager } from '@/services/live-activity-sync';
import { seedMockDataIfNeeded } from '@/lib/mock-data-seed';

// Keep the splash up until fonts are ready, so no screen ever renders with a
// fallback face and then reflows into the real one.
void SplashScreen.preventAutoHideAsync();

/**
 * Root layout for the FULL app (host + guest).
 *
 * The App Clip does not use this tree at all. It builds against
 * `src/app-clip`, selected via the expo-router `root` option in
 * `app.config.js`, so nothing under `src/app` is bundled into the Clip.
 */
function RootNavigator() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colours.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="celebration/[celebrationId]/camera"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="celebration/[celebrationId]/photos/[photoId]"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
          // The screen pages between photos with its own horizontal
          // PanResponder drag — see the same-named component. Native
          // swipe-to-dismiss can't be told apart from that by iOS, so it
          // fires on every drag right alongside it. Off entirely: this
          // screen has no legitimate case for the native gesture.
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    OpenMojiBlack: require('../../assets/fonts/OpenMoji-black-glyf.ttf'),
  });

  useEffect(() => {
    // Hide on error too — a missing font must degrade to the documented system
    // fallback, never strand the user on a splash screen.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Auto-seed mock data on web for development testing
    void seedMockDataIfNeeded();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LiveActivitySyncManager />
          <AuthContextProvider>
            <CreationDraftProvider>
              {/* Light glyphs — the canvas is near-black on every screen. */}
              <StatusBar style="light" />
              <RootNavigator />
            </CreationDraftProvider>
          </AuthContextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
