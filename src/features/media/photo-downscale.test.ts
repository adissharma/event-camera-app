import { downscalePhotoForUpload, MAX_PHOTO_LONG_SIDE } from './photo-downscale';

const mockManipulate = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: (...args: unknown[]) => mockManipulate(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockManipulate.mockResolvedValue({ uri: 'file://out.jpg', width: 2048, height: 1536 });
});

describe('downscalePhotoForUpload', () => {
  it('caps the LONG side of a landscape photo by its width', async () => {
    await downscalePhotoForUpload('file://in.jpg', { width: 4032, height: 3024 });
    const [, actions] = mockManipulate.mock.calls[0];
    expect(actions).toEqual([{ resize: { width: MAX_PHOTO_LONG_SIDE } }]);
  });

  // The case that is easy to get wrong: constraining width unconditionally
  // would leave a portrait photo's long edge (its height) above the cap.
  it('caps the LONG side of a portrait photo by its height', async () => {
    await downscalePhotoForUpload('file://in.jpg', { width: 3024, height: 4032 });
    const [, actions] = mockManipulate.mock.calls[0];
    expect(actions).toEqual([{ resize: { height: MAX_PHOTO_LONG_SIDE } }]);
  });

  it('leaves an already-small photo completely alone', async () => {
    const result = await downscalePhotoForUpload('file://in.jpg', { width: 1600, height: 1200 });
    expect(mockManipulate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ uri: 'file://in.jpg', skipped: true, width: 1600, height: 1200 });
  });

  it('reports the RESIZED dimensions, not the source ones', async () => {
    const result = await downscalePhotoForUpload('file://in.jpg', { width: 4032, height: 3024 });
    expect(result).toMatchObject({ width: 2048, height: 1536, skipped: false });
  });

  // A photo that cannot be resized must still be uploadable — a large photo
  // is enormously better than a lost one.
  it('falls back to the original when resizing fails', async () => {
    mockManipulate.mockRejectedValue(new Error('decoder exploded'));
    const result = await downscalePhotoForUpload('file://in.jpg', { width: 4032, height: 3024 });
    expect(result).toMatchObject({ uri: 'file://in.jpg', skipped: true, reason: 'resize failed' });
  });
});
