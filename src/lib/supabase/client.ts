import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { HAS_SUPABASE_CREDENTIALS, SUPABASE_CONFIG } from '@/config/app-config';
import type { Database } from '@/types/database';

/**
 * Session storage.
 *
 * Auth tokens are sensitive, so they go in the platform keystore rather than
 * AsyncStorage. Two complications this handles:
 *
 * 1. **SecureStore caps a value at 2048 bytes.** A Supabase session carrying a
 *    JWT with custom claims exceeds that, and the write fails *silently* on
 *    some platforms — which presents as the user being signed out on every
 *    launch. The adapter therefore chunks values across multiple keys.
 * 2. **SecureStore does not exist on web.** Expo Web falls back to
 *    AsyncStorage (localStorage). That is fine for the development preview and
 *    is NOT suitable for a production web deployment — see the note below.
 */
const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = '__chunks';

const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
    if (countRaw === null) {
      return SecureStore.getItemAsync(key);
    }

    const count = Number.parseInt(countRaw, 10);
    if (!Number.isFinite(count) || count <= 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      // A missing chunk means a partially written or partially cleared session.
      // Returning null forces a clean re-authentication rather than handing
      // supabase-js a corrupt token.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await clearChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}__${index}`, chunk)),
    );
    // Written last: the count key is what makes a chunked value readable, so
    // writing it only after every chunk lands means an interrupted write is
    // detected as "no session" rather than as a truncated one.
    await SecureStore.setItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

async function clearChunks(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
  if (countRaw === null) return;

  const count = Number.parseInt(countRaw, 10);
  if (Number.isFinite(count)) {
    await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`)),
    );
  }
  await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
}

/**
 * Web has no SecureStore. AsyncStorage maps to localStorage, which is readable
 * by any script on the origin — acceptable for the local development preview,
 * NOT acceptable for a production web deployment. Shipping the guest web app
 * will need httpOnly cookie-based auth instead.
 */
const storage = Platform.OS === 'web' ? AsyncStorage : secureStoreAdapter;

/** Null when no credentials are configured. Guard with `isBackendConfigured`. */
export const supabase: SupabaseClient<Database> | null = HAS_SUPABASE_CREDENTIALS
  ? createClient<Database>(SUPABASE_CONFIG.url!, SUPABASE_CONFIG.anonKey!, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        // The app handles the deep-link callback itself; letting the library
        // also parse the URL causes it to consume the code twice.
        detectSessionInUrl: false,
      },
    })
  : null;

export const isBackendConfigured = HAS_SUPABASE_CREDENTIALS;

/**
 * Returns the client, or throws with an actionable message.
 *
 * Repositories call this rather than reaching for the nullable export, so a
 * missing configuration fails loudly at the call site instead of surfacing as
 * "cannot read property from null" three layers away.
 */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart ' +
        'the dev server with `npx expo start --clear`.',
    );
  }
  return supabase;
}
