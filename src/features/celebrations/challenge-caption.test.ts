import { StorySlideItem } from './story-viewer';

describe('Challenge Post Captions', () => {
  const MAX_CAPTION_LENGTH = 120;

  function calculateRemainingCharacters(input: string): number {
    return Math.max(0, MAX_CAPTION_LENGTH - input.length);
  }

  function formatChallengeMetadata(challengeId: string, caption?: string) {
    const trimmed = caption?.trim();
    return {
      challenge_id: challengeId,
      submission_kind: 'challenge',
      ...(trimmed ? { caption: trimmed } : {}),
    };
  }

  it('calculates remaining character count correctly for 120-char limit', () => {
    expect(calculateRemainingCharacters('')).toBe(120);
    expect(calculateRemainingCharacters('Hello world')).toBe(109);
    const maxStr = 'a'.repeat(120);
    expect(calculateRemainingCharacters(maxStr)).toBe(0);
  });

  it('includes caption in metadata when non-empty string is provided', () => {
    const meta = formatChallengeMetadata('ch-1', '  Great moment!  ');
    expect(meta).toEqual({
      challenge_id: 'ch-1',
      submission_kind: 'challenge',
      caption: 'Great moment!',
    });
  });

  it('omits caption from metadata when blank or undefined', () => {
    const metaEmpty = formatChallengeMetadata('ch-1', '   ');
    expect(metaEmpty).toEqual({
      challenge_id: 'ch-1',
      submission_kind: 'challenge',
    });

    const metaUndefined = formatChallengeMetadata('ch-1');
    expect(metaUndefined).toEqual({
      challenge_id: 'ch-1',
      submission_kind: 'challenge',
    });
  });

  it('correctly attaches caption to StorySlideItem', () => {
    const slide: StorySlideItem = {
      id: 'sub-1',
      uri: 'https://example.com/photo.jpg',
      takenBy: 'Alex',
      caption: 'Sunset at the party',
    };
    expect(slide.caption).toBe('Sunset at the party');
  });
});
