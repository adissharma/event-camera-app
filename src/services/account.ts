import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { requireSupabase } from '@/lib/supabase/client';

export class AccountDeletionError extends Error {
  constructor() {
    super('We could not delete your account. Your account has not been changed. Please try again.');
    this.name = 'AccountDeletionError';
  }
}

/** Calls the authenticated server endpoint. It is never a profile-only delete. */
export async function deleteMyAccount(): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{ deleted?: boolean }>('delete-account');

  if (error || data?.deleted !== true) {
    throw new AccountDeletionError();
  }
}

/**
 * Authentication state is cleared by signOut; this removes user-specific
 * drafts and guest-session identifiers left on the device as well.
 */
export async function clearDeletedAccountLocalState(userId: string | null): Promise<void> {
  const keysToRemove = [`creation-draft:${userId ?? 'anonymous'}`];

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const keys = Object.keys(window.localStorage).filter(
        (key) => key.startsWith('guest_session_') || key.startsWith('reveal-acknowledgement:'),
      );
      keys.forEach((key) => window.localStorage.removeItem(key));
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      return;
    }

    const keys = await AsyncStorage.getAllKeys();
    const accountKeys = keys.filter(
      (key) =>
        keysToRemove.includes(key) ||
        key.startsWith('guest_session_') ||
        key.startsWith('reveal-acknowledgement:'),
    );
    if (accountKeys.length > 0) await AsyncStorage.multiRemove(accountKeys);
  } catch {
    // The server deletion is already complete. A stale local cache must never
    // make a successful destructive request look as though it failed.
  }
}
