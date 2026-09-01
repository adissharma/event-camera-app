import { createEmptyDraft } from '@/features/celebrations/draft/types';
import { PREVIEW_CELEBRATION_ID, buildPreviewDetail } from './reveal-preview-detail';

/**
 * The preview mounts the real event screen, which means this adapter decides
 * what that screen shows. Anything it gets wrong looks like a bug in the event
 * page rather than in the reveal, so the mapping is pinned here.
 */

function draftWith(overrides: Partial<ReturnType<typeof createEmptyDraft>>) {
  return { ...createEmptyDraft('user-1', 'Europe/London'), ...overrides };
}

describe('the host sees their own event', () => {
  it('carries the title through', () => {
    const detail = buildPreviewDetail(draftWith({ title: "  Sarah & Tom's Wedding  " }));
    expect(detail.celebration.title).toBe("Sarah & Tom's Wedding");
  });

  it('falls back to a neutral name rather than an empty hero', () => {
    expect(buildPreviewDetail(draftWith({ title: '   ' })).celebration.title).toBe('Your event');
  });

  it('carries the cover, preferring the local pick still being uploaded', () => {
    expect(
      buildPreviewDetail(draftWith({ coverLocalUri: 'file://a.jpg', coverStoragePath: 'covers/b.jpg' }))
        .celebration.cover_storage_path,
    ).toBe('file://a.jpg');
    expect(
      buildPreviewDetail(draftWith({ coverLocalUri: null, coverStoragePath: 'covers/b.jpg' }))
        .celebration.cover_storage_path,
    ).toBe('covers/b.jpg');
  });

  it('carries the closing date and timezone, which the hero renders', () => {
    const detail = buildPreviewDetail(
      draftWith({ endsAt: '2026-09-19T22:00:00.000Z', timezone: 'Asia/Kolkata' }),
    );
    expect(detail.celebration.ends_at).toBe('2026-09-19T22:00:00.000Z');
    expect(detail.celebration.timezone).toBe('Asia/Kolkata');
  });

  it('carries the photo treatment, so a disposable event previews as one', () => {
    expect(
      buildPreviewDetail(draftWith({ photoTreatment: 'disposable' })).primarySession?.photo_treatment,
    ).toBe('disposable');
  });

  it('shows the host their own event as the host', () => {
    const detail = buildPreviewDetail(draftWith({ userId: 'user-1' }));
    expect(detail.viewerRole).toBe('host');
    expect(detail.celebration.created_by).toBe('user-1');
  });
});

describe('nothing here is real', () => {
  it('uses an id that is obviously not a celebration', () => {
    // If this ever turns up in a log, a query or a storage key, something has
    // escaped preview mode — far easier to trace than a plausible UUID.
    const detail = buildPreviewDetail(draftWith({}));
    expect(detail.celebration.id).toBe(PREVIEW_CELEBRATION_ID);
    expect(detail.celebration.id).not.toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is never published', () => {
    const detail = buildPreviewDetail(draftWith({}));
    expect(detail.celebration.status).toBe('draft');
    expect(detail.celebration.published_at).toBeNull();
  });

  it('supplies no server media, leaving the seeded preview photos in place', () => {
    const detail = buildPreviewDetail(draftWith({}));
    expect(detail.mediaPhotos).toBeNull();
    expect(detail.challengePhotos).toBeNull();
    expect(detail.recap).toBeNull();
  });

  it('shows plausible stats rather than an empty event', () => {
    expect(buildPreviewDetail(draftWith({})).metrics.guestsJoined).toBeGreaterThan(0);
    expect(buildPreviewDetail(draftWith({})).metrics.photos).toBeGreaterThan(0);
  });
});
