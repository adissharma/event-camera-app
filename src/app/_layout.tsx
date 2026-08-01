import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
import { CreationDraftProvider } from '@/features/celebrations/draft/store';
import { LiveActivitySyncManager } from '@/services/live-activity-sync';
import { AppText } from '@/components/ui/text';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';

// Keep the splash up until fonts are ready, so no screen ever renders with a
// fallback face and then reflows into the real one.
void SplashScreen.preventAutoHideAsync();

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_ROUTES = new Set(['index', 'sign-in', 'verify', 'create']);

function RootNavigator() {
  // ── WEB ACCESS GUARD ──
  // On web, only guest-facing routes are allowed. Block host-only routes.
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!shouldBlockHostRouteOnWeb(Platform.OS)) return;

    const current: string = segments[0] ?? 'index';
    const hostOnlyRoutes = new Set([
      'index', // Welcome/home selector
      'home', // Host dashboard
      'sign-in', // Host sign-in
      'verify', // Email verification
      'your-name', // Name entry
      'create', // Event creation wizard
    ]);

    if (hostOnlyRoutes.has(current)) {
      router.replace('/j/');
    }
  }, [segments, router]);

  // ── AUTH BYPASSED FOR TESTING ──
  // The auth redirect logic is temporarily disabled so that every screen is
  // reachable without signing in. Remove this block and restore the original
  // guard when auth is re-enabled.
  //
  // const { isSignedIn, isRestoring } = useAuth();
  // const segments = useSegments();
  // const router = useRouter();
  //
  // useEffect(() => {
  //   if (isRestoring) return;
  //   const current: string = segments[0] ?? 'index';
  //   const isPublic = PUBLIC_ROUTES.has(current);
  //   if (!isSignedIn && !isPublic) {
  //     router.replace('/');
  //   } else if (isSignedIn && isPublic && current !== 'index') {
  //     router.replace('/home');
  //   }
  // }, [isSignedIn, isRestoring, segments, router]);

  return (
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
