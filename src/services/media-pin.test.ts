import AsyncStorage from '@react-native-async-storage/async-storage';
import { pinHostPhoto, unpinHostPhoto } from './media-pin';

describe('media-pin service', () => {
  const celebrationId = 'test-cel-123';
  const mockKey = `__mock_photos_${celebrationId}`;

  beforeEach(async () => {
    await AsyncStorage.clear();
    const initialPhotos = [
      { id: 'photo-1', uri: 'photo-1', takenBy: 'Host', isPinned: false, capturedAt: '2026-08-14T10:00:00Z' },
      { id: 'photo-2', uri: 'photo-2', takenBy: 'Guest 1', isPinned: false, capturedAt: '2026-08-14T10:05:00Z' },
      { id: 'photo-3', uri: 'photo-3', takenBy: 'Guest 2', isPinned: false, capturedAt: '2026-08-14T10:10:00Z' },
    ];
    await AsyncStorage.setItem(mockKey, JSON.stringify(initialPhotos));
  });

  it('allows pinning up to 2 items', async () => {
    const res1 = await pinHostPhoto({ mediaItemId: 'photo-1', celebrationId });
    expect(res1.isPinned).toBe(true);

    const res2 = await pinHostPhoto({ mediaItemId: 'photo-2', celebrationId });
    expect(res2.isPinned).toBe(true);

    const stored = await AsyncStorage.getItem(mockKey);
    const photos = JSON.parse(stored || '[]');
    const pinned = photos.filter((p: any) => p.isPinned);
    expect(pinned.length).toBe(2);
  });

  it('rejects pinning a 3rd item when 2 items are already pinned', async () => {
    await pinHostPhoto({ mediaItemId: 'photo-1', celebrationId });
    await pinHostPhoto({ mediaItemId: 'photo-2', celebrationId });

    await expect(
      pinHostPhoto({ mediaItemId: 'photo-3', celebrationId }),
    ).rejects.toThrow('Maximum of 2 pinned items allowed');
  });

  it('allows pinning another item after unpinning one', async () => {
    await pinHostPhoto({ mediaItemId: 'photo-1', celebrationId });
    await pinHostPhoto({ mediaItemId: 'photo-2', celebrationId });

    const unpinRes = await unpinHostPhoto({ mediaItemId: 'photo-1', celebrationId });
    expect(unpinRes.isPinned).toBe(false);

    const res3 = await pinHostPhoto({ mediaItemId: 'photo-3', celebrationId });
    expect(res3.isPinned).toBe(true);
  });
});
