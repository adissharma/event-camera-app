describe('Gallery Photo Review & Captions', () => {
  const MAX_CAPTION_LENGTH = 120;

  function calculateRemainingCharacters(input: string): number {
    return Math.max(0, MAX_CAPTION_LENGTH - input.length);
  }

  function formatGalleryPhotoMetadata(caption?: string) {
    const trimmed = caption?.trim();
    return trimmed ? { caption: trimmed } : undefined;
  }

  it('calculates remaining character count correctly for 120-char limit', () => {
    expect(calculateRemainingCharacters('')).toBe(120);
    expect(calculateRemainingCharacters('A lovely day')).toBe(108);
    const maxStr = 'a'.repeat(120);
    expect(calculateRemainingCharacters(maxStr)).toBe(0);
  });

  it('includes caption in metadata when non-empty string is provided', () => {
    const meta = formatGalleryPhotoMetadata('  Party vibes!  ');
    expect(meta).toEqual({
      caption: 'Party vibes!',
    });
  });

  it('returns undefined when caption is empty or blank', () => {
    const metaEmpty = formatGalleryPhotoMetadata('   ');
    expect(metaEmpty).toBeUndefined();

    const metaUndefined = formatGalleryPhotoMetadata();
    expect(metaUndefined).toBeUndefined();
  });
});
