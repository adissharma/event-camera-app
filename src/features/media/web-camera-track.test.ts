import {
  applyCameraSettings,
  readTrackCapabilities,
  toNativeZoom,
  type WebCameraCapabilities,
} from './web-camera-track';

function trackWithCapabilities(capabilities: unknown): MediaStreamTrack {
  return { getCapabilities: () => capabilities } as unknown as MediaStreamTrack;
}

describe('readTrackCapabilities', () => {
  it('reads torch from the boolean Chrome reports', () => {
    expect(readTrackCapabilities(trackWithCapabilities({ torch: true })).torch).toBe(true);
    expect(readTrackCapabilities(trackWithCapabilities({ torch: false })).torch).toBe(false);
  });

  it('reads torch from the boolean sequence the spec allows', () => {
    expect(readTrackCapabilities(trackWithCapabilities({ torch: [false, true] })).torch).toBe(true);
    expect(readTrackCapabilities(trackWithCapabilities({ torch: [false] })).torch).toBe(false);
  });

  it('reports no torch when the camera does not advertise one', () => {
    // The usual front-camera case, which is why the control is hidden there.
    expect(readTrackCapabilities(trackWithCapabilities({})).torch).toBe(false);
  });

  it('survives a browser without getCapabilities at all', () => {
    const track = {} as unknown as MediaStreamTrack;
    expect(readTrackCapabilities(track)).toEqual({ torch: false, zoom: null, focusMode: [] });
  });

  it('ignores a degenerate zoom range rather than dividing by zero later', () => {
    expect(readTrackCapabilities(trackWithCapabilities({ zoom: { min: 1, max: 1 } })).zoom).toBeNull();
  });

  it('keeps a real zoom range', () => {
    expect(readTrackCapabilities(trackWithCapabilities({ zoom: { min: 1, max: 8 } })).zoom).toEqual({
      min: 1,
      max: 8,
    });
  });

  it('keeps browser-reported focus modes for front-camera sharpening', () => {
    expect(readTrackCapabilities(trackWithCapabilities({ focusMode: ['manual', 'continuous'] })).focusMode)
      .toEqual(['manual', 'continuous']);
  });
});

describe('toNativeZoom', () => {
  const range = { min: 1, max: 5 };

  it('maps the normalised ends onto the camera range', () => {
    expect(toNativeZoom(0, range)).toBe(1);
    expect(toNativeZoom(1, range)).toBe(5);
  });

  it('maps a mid value proportionally', () => {
    expect(toNativeZoom(0.5, range)).toBe(3);
  });

  it('clamps values outside 0–1 into the range', () => {
    expect(toNativeZoom(-2, range)).toBe(1);
    expect(toNativeZoom(4, range)).toBe(5);
  });
});

describe('applyCameraSettings', () => {
  const bothSupported: WebCameraCapabilities = { torch: true, zoom: { min: 1, max: 5 }, focusMode: [] };

  const highResolutionConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  };

  it('sends torch and zoom in a SINGLE applyConstraints call', async () => {
    // The whole point of this module: `applyConstraints` replaces the track's
    // entire constraint set, so splitting these across two calls is what made
    // the torch and the zoom cancel each other out in `expo-camera`.
    const applyConstraints = jest.fn().mockResolvedValue(undefined);
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    await applyCameraSettings(track, bothSupported, { facing: 'back', torchOn: true, zoom: 0.5 });

    expect(applyConstraints).toHaveBeenCalledTimes(1);
    expect(applyConstraints).toHaveBeenCalledWith({
      ...highResolutionConstraints,
      advanced: [{ torch: true, zoom: 3 }],
    });
  });

  it('still sends torch: false so switching the light off takes effect', async () => {
    const applyConstraints = jest.fn().mockResolvedValue(undefined);
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    await applyCameraSettings(track, bothSupported, { facing: 'back', torchOn: false, zoom: 0 });

    expect(applyConstraints).toHaveBeenCalledWith({
      ...highResolutionConstraints,
      advanced: [{ torch: false, zoom: 1 }],
    });
  });

  it('omits keys the camera does not support', async () => {
    const applyConstraints = jest.fn().mockResolvedValue(undefined);
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    await applyCameraSettings(track, { torch: false, zoom: { min: 0, max: 4 }, focusMode: [] }, {
      facing: 'back',
      torchOn: true,
      zoom: 1,
    });

    expect(applyConstraints).toHaveBeenCalledWith({
      ...highResolutionConstraints,
      advanced: [{ zoom: 4 }],
    });
  });

  it('still asks for a high-resolution stream when the camera supports neither torch nor zoom', async () => {
    const applyConstraints = jest.fn().mockResolvedValue(undefined);
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    await applyCameraSettings(track, { torch: false, zoom: null, focusMode: [] }, {
      facing: 'back',
      torchOn: true,
      zoom: 1,
    });

    expect(applyConstraints).toHaveBeenCalledWith(highResolutionConstraints);
  });

  it('prefers continuous focus on the front camera when the browser exposes it', async () => {
    const applyConstraints = jest.fn().mockResolvedValue(undefined);
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    await applyCameraSettings(
      track,
      { torch: false, zoom: null, focusMode: ['manual', 'continuous'] },
      { facing: 'front', torchOn: false, zoom: 0 },
    );

    expect(applyConstraints).toHaveBeenCalledWith({
      ...highResolutionConstraints,
      advanced: [{ focusMode: 'continuous' }],
    });
  });

  it('swallows a rejected constraint instead of breaking the viewfinder', async () => {
    const applyConstraints = jest.fn().mockRejectedValue(new Error('OverconstrainedError'));
    const track = { applyConstraints } as unknown as MediaStreamTrack;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      applyCameraSettings(track, bothSupported, { facing: 'back', torchOn: true, zoom: 0.5 }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
