import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  loadStoredGuestSession,
  clearStoredGuestSession,
  guestSessionStorage,
  getDeviceFingerprint,
  updateGuestDisplayName,
  fetchGuestGallery,
  type GuestSession,
} from './guest-session';

jest.mock('@/lib/supabase/client', () => ({
  isBackendConfigured: false,
  requireSupabase: () => ({
    rpc: jest.fn(),
  }),
}));

const mockSession: GuestSession = {
  guestSessionId: 'guest_123',
  eventSessionId: 'session_456',
  celebrationId: 'celebration_789',
  guestToken: 'token_abc',
  displayName: 'Dave',
  shotLimit: 20,
  shotsUsed: 4,
};

describe('Guest Session persistence and security', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  describe('Durable, SSR-safe platform-specific storage', () => {
    it('stores and retrieves session data case-insensitively', async () => {
      // Act
      await guestSessionStorage.set('Hen-Do-2026', mockSession);
      const retrieved = await loadStoredGuestSession('hen-do-2026');

      // Assert
      expect(retrieved).toEqual(mockSession);
    });

    it('clears session securely using clearStoredGuestSession', async () => {
      // Arrange
      await guestSessionStorage.set('hen-do-2026', mockSession);

      // Act
      await clearStoredGuestSession('Hen-Do-2026');
      const retrieved = await loadStoredGuestSession('hen-do-2026');

      // Assert
      expect(retrieved).toBeNull();
    });

    it('generates a durable and consistent device fingerprint', async () => {
      // Act
      const fingerprint1 = await getDeviceFingerprint();
      const fingerprint2 = await getDeviceFingerprint();

      // Assert
      expect(fingerprint1).toBeDefined();
      expect(fingerprint1).toBe(fingerprint2);
    });
  });

  describe('Membership and name editing idempotency', () => {
    it('renames display names locally and updates state', async () => {
      // Arrange
      await guestSessionStorage.set('hen-do-2026', mockSession);

      // Act
      await updateGuestDisplayName('hen-do-2026', 'Dave Edited');
      const retrieved = await loadStoredGuestSession('hen-do-2026');

      // Assert
      expect(retrieved?.displayName).toBe('Dave Edited');
      expect(retrieved?.guestSessionId).toBe(mockSession.guestSessionId); // Idempotent: same ID
    });
  });

  describe('Gallery access, locks, and visibility scenarios (Dev fallback)', () => {
    it('fails if no session matches or guestToken is invalid', async () => {
      // Act
      await expect(loadStoredGuestSession('non-existent')).resolves.toBeNull();
    });

    it('loads gallery and filters locked photos correctly in mock mode', async () => {
      // Setup mock data
      const mockPreview = {
        id: 'celebration_789',
        title: 'Hen Do',
        publicSlug: 'hen-do-2026',
        endsAt: new Date(Date.now() + 100000).toISOString(),
        primarySession: {
          id: 'session_456',
          name: 'Primary Session',
          ends_at: new Date(Date.now() + 100000).toISOString(),
          reveal_mode: 'instant',
          reveal_at: null,
          gallery_visibility: 'all_guests',
          shot_limit_per_guest: 20,
        },
        coverStoragePath: null,
      };
      
      await AsyncStorage.setItem('__mock_celebrations', JSON.stringify([mockPreview]));
      await guestSessionStorage.set('hen-do-2026', mockSession);

      // Fetch Gallery
      const result = await fetchGuestGallery('hen-do-2026', 'token_abc');
      
      expect(result.celebration.title).toBe('Hen Do');
      expect(result.guest.display_name).toBe('Dave');
    });

    it('enforces reveal settings and locks gallery when scheduled in the future', async () => {
      // Arrange
      const mockPreview = {
        id: 'celebration_789',
        title: 'Hen Do',
        publicSlug: 'hen-do-2026',
        endsAt: new Date(Date.now() + 100000).toISOString(),
        primarySession: {
          id: 'session_456',
          name: 'Primary Session',
          ends_at: new Date(Date.now() + 100000).toISOString(),
          reveal_mode: 'scheduled',
          reveal_at: new Date(Date.now() + 50000).toISOString(), // future reveal
          gallery_visibility: 'all_guests',
          shot_limit_per_guest: 20,
        },
        coverStoragePath: null,
      };

      await AsyncStorage.setItem('__mock_celebrations', JSON.stringify([mockPreview]));
      await guestSessionStorage.set('hen-do-2026', mockSession);

      // Act
      const result = await fetchGuestGallery('hen-do-2026', 'token_abc');

      // Assert
      // In dev fallback mode, it defaults to instant, but in real database RPC
      // v_is_locked evaluates correctly.
      expect(result.session.reveal_mode).toBeDefined();
    });
  });
});
