import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';

export interface PinMediaResult {
  mediaItemId: string;
  isPinned: boolean;
  pinnedAt?: string | null;
}

/**
 * Pins a photo or video to the top of the gallery for the host (max 2 items).
 */
export async function pinHostPhoto({
  mediaItemId,
  celebrationId,
}: {
  mediaItemId: string;
  celebrationId: string;
}): Promise<PinMediaResult> {
  if (!isBackendConfigured) {
    // Local mock data fallback
    const key = `__mock_photos_${celebrationId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as any[];
      const currentlyPinned = parsed.filter((p) => p.isPinned === true);
      const target = parsed.find((p) => p.id === mediaItemId || p.uri === mediaItemId);

      if (target && !target.isPinned && currentlyPinned.length >= 2) {
        throw new Error('Maximum of 2 pinned items allowed');
      }

      const now = new Date().toISOString();
      const updated = parsed.map((p) => {
        if (p.id === mediaItemId || p.uri === mediaItemId) {
          return { ...p, isPinned: true, pinnedAt: now };
        }
        return p;
      });

      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return { mediaItemId, isPinned: true, pinnedAt: now };
    }
    return { mediaItemId, isPinned: true, pinnedAt: new Date().toISOString() };
  }

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('pin_host_media_item', {
    p_media_item_id: mediaItemId,
  });

  if (error) {
    throw error;
  }

  const result = data as { media_item_id: string; is_pinned: boolean; pinned_at?: string };
  return {
    mediaItemId: result.media_item_id,
    isPinned: result.is_pinned,
    pinnedAt: result.pinned_at ?? null,
  };
}

/**
 * Unpins a photo or video from the top of the gallery.
 */
export async function unpinHostPhoto({
  mediaItemId,
  celebrationId,
}: {
  mediaItemId: string;
  celebrationId: string;
}): Promise<PinMediaResult> {
  if (!isBackendConfigured) {
    // Local mock data fallback
    const key = `__mock_photos_${celebrationId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as any[];
      const updated = parsed.map((p) => {
        if (p.id === mediaItemId || p.uri === mediaItemId) {
          return { ...p, isPinned: false, pinnedAt: null };
        }
        return p;
      });

      await AsyncStorage.setItem(key, JSON.stringify(updated));
    }
    return { mediaItemId, isPinned: false, pinnedAt: null };
  }

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('unpin_host_media_item', {
    p_media_item_id: mediaItemId,
  });

  if (error) {
    throw error;
  }

  const result = data as { media_item_id: string; is_pinned: boolean };
  return {
    mediaItemId: result.media_item_id,
    isPinned: result.is_pinned,
    pinnedAt: null,
  };
}
