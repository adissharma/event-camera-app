import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
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
import { AuthContextProvider, useAuth } from '@/features/auth/context';

// Keep the splash up until fonts are ready, so no screen ever renders with a
// fallback face and then reflows into the real one.
void SplashScreen.preventAutoHideAsync();

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_ROUTES = new Set(['index', 'sign-in', 'verify']);

function RootNavigator() {
  const { isSignedIn, isRestoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait for the persisted session to be checked. Redirecting before that
    // bounces a signed-in user out to the welcome screen on every cold start.
    if (isRestoring) return;

    // Widened to string deliberately. With typed routes, `segments[0]` is a
    // union of known route names that excludes the root — at `/` the array is
    // empty, so the fallback below is the only way the root is ever named.
    const current: string = segments[0] ?? 'index';
    const isPublic = PUBLIC_ROUTES.has(current);

    if (!isSignedIn && !isPublic) {
      // `replace`, not `push` — an expired session must not leave a protected
      // screen sitting in the back stack.
      router.replace('/');
    } else if (isSignedIn && isPublic && current !== 'index') {
      router.replace('/home');
    }
  }, [isSignedIn, isRestoring, segments, router]);

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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  useEffect(() => {
    // Hide on error too — a missing font must degrade to the documented system
    // fallback, never strand the user on a splash screen.
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
            {/* Light glyphs — the canvas is near-black on every screen. */}
            <StatusBar style="light" />
            <RootNavigator />
          </AuthContextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
