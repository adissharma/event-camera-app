import { Platform } from 'react-native';

/**
 * Auto-seeds development mock data for testing without a backend.
 * Runs once per app session if data doesn't exist.
 */

const MOCK_EVENTS = [
  {
    id: 'demo-1',
    title: 'Demo Event',
    publicSlug: 'demo-slug',
    coverStoragePath: null,
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    primarySession: {
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      shot_limit_per_guest: 10,
    },
  },
  {
    id: 'test-event',
    title: 'Test Event',
    publicSlug: 'test-event',
    coverStoragePath: null,
    endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    primarySession: {
      ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      shot_limit_per_guest: 20,
    },
  },
];

/**
 * Seeds mock data if it doesn't exist.
 * Safe to call multiple times — only seeds once.
 */
export async function seedMockDataIfNeeded(): Promise<void> {
  try {
    // Only auto-seed on web in development
    if (Platform.OS !== 'web') return;

    if (typeof window === 'undefined' || !window.localStorage) return;

    const existing = window.localStorage.getItem('__mock_celebrations');
    if (existing) return; // Already seeded

    window.localStorage.setItem('__mock_celebrations', JSON.stringify(MOCK_EVENTS));
    console.log('✓ Mock events seeded');
  } catch (err) {
    console.warn('Failed to seed mock data:', err);
  }
}
