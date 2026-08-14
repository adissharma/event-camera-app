import {
  InvalidStoragePathError,
  buildCoverPath,
  buildOriginalMediaPath,
  buildQrAssetPath,
  buildVariantPath,
  inferMimeTypeFromUri,
  normaliseExtension,
  workspaceIdFromPath,
} from './storage-paths';

const W = '11111111-1111-1111-1111-111111111111';
const C = '22222222-2222-2222-2222-222222222222';
const E = '33333333-3333-3333-3333-333333333333';
const M = '44444444-4444-4444-4444-444444444444';

describe('storage paths', () => {
  describe('media originals', () => {
    it('builds the documented layout', () => {
      expect(
        buildOriginalMediaPath({
          workspaceId: W, celebrationId: C, eventSessionId: E, mediaItemId: M, extension: 'jpg',
        }),
      ).toBe(`${W}/${C}/${E}/${M}/original-v1.jpg`);
    });

    it('starts with the workspace id, which is what storage policies authorise on', () => {
      const path = buildOriginalMediaPath({
        workspaceId: W, celebrationId: C, eventSessionId: E, mediaItemId: M, extension: 'jpg',
      });
      expect(workspaceIdFromPath(path)).toBe(W);
    });

    it('versions rather than overwriting', () => {
      const v2 = buildOriginalMediaPath({
        workspaceId: W, celebrationId: C, eventSessionId: E, mediaItemId: M,
        extension: 'jpg', version: 2,
      });
      expect(v2).toContain('original-v2.jpg');
    });
  });

  describe('path traversal and injection', () => {
    it('rejects a traversal attempt in an id', () => {
      expect(() =>
        buildOriginalMediaPath({
          workspaceId: '../../etc', celebrationId: C, eventSessionId: E, mediaItemId: M,
          extension: 'jpg',
        }),
      ).toThrow(InvalidStoragePathError);
    });

    it('rejects a traversal attempt in an extension', () => {
      expect(() => normaliseExtension('../../secret')).toThrow(InvalidStoragePathError);
      expect(() => normaliseExtension('jpg/../..')).toThrow(InvalidStoragePathError);
    });

    it('rejects an extension containing a separator', () => {
      expect(() => normaliseExtension('jpg/png')).toThrow(InvalidStoragePathError);
    });

    it('rejects an empty or oversized extension', () => {
      expect(() => normaliseExtension('')).toThrow(InvalidStoragePathError);
      expect(() => normaliseExtension('averylongextension')).toThrow(InvalidStoragePathError);
    });

    it('rejects a non-UUID id rather than silently building a wrong path', () => {
      expect(() =>
        buildOriginalMediaPath({
          workspaceId: 'not-a-uuid', celebrationId: C, eventSessionId: E, mediaItemId: M,
          extension: 'jpg',
        }),
      ).toThrow(/workspaceId must be a UUID/);
    });

    it('rejects a variant name with a separator', () => {
      expect(() =>
        buildVariantPath({
          workspaceId: W, celebrationId: C, eventSessionId: E, mediaItemId: M,
          extension: 'jpg', variant: 'thumb/../../x',
        }),
      ).toThrow(InvalidStoragePathError);
    });

    it('rejects a template key with a separator', () => {
      expect(() => buildQrAssetPath(W, C, E, 'a4/../x', 'png')).toThrow(InvalidStoragePathError);
    });
  });

  describe('normalisation', () => {
    it('strips a leading dot and lowercases', () => {
      expect(normaliseExtension('.JPG')).toBe('jpg');
      expect(normaliseExtension('HEIC')).toBe('heic');
    });
  });

  describe('other buckets', () => {
    it('builds a cover path', () => {
      expect(buildCoverPath(W, C, 'jpg', 1)).toBe(`${W}/${C}/cover-v1.jpg`);
    });

    it('builds a QR asset path', () => {
      expect(buildQrAssetPath(W, C, E, 'a4_poster', 'png')).toBe(
        `${W}/${C}/${E}/a4_poster-v1.png`,
      );
    });

    it('builds a variant path', () => {
      expect(
        buildVariantPath({
          workspaceId: W, celebrationId: C, eventSessionId: E, mediaItemId: M,
          extension: 'webp', variant: 'thumbnail',
        }),
      ).toBe(`${W}/${C}/${E}/${M}/thumbnail-v1.webp`);
    });
  });

  describe('workspaceIdFromPath', () => {
    it('returns null for a malformed path rather than a wrong id', () => {
      expect(workspaceIdFromPath('not-a-uuid/x/y')).toBeNull();
      expect(workspaceIdFromPath('')).toBeNull();
    });
  });

  describe('inferMimeTypeFromUri', () => {
    it('reads the MIME type straight out of a data: URI header', () => {
      // What expo-camera's web capture produces. A base64 payload has no
      // "." in it, so an extension-based guess would previously read the
      // *entire* multi-megabyte string as one bogus extension and fall
      // through to the wrong default.
      expect(inferMimeTypeFromUri('data:image/png;base64,iVBORw0KGgoAAAANS')).toBe('image/png');
      expect(inferMimeTypeFromUri('data:image/jpeg;base64,/9j/4AAQSkZJRg')).toBe('image/jpeg');
    });

    it('still infers from a real file extension', () => {
      expect(inferMimeTypeFromUri('file:///var/mobile/photo.HEIC')).toBe('image/heic');
      expect(inferMimeTypeFromUri('https://example.com/a.webp?x=1')).toBe('image/webp');
    });

    it('falls back to jpeg for an extensionless native default', () => {
      expect(inferMimeTypeFromUri('file:///var/mobile/photo')).toBe('image/jpeg');
    });
  });
});
