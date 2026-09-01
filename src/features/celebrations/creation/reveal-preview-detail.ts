import type { CelebrationDetail } from '@/services/celebration-detail';
import type { CelebrationRow, EventSessionRow } from '@/types/database';
import { resolveDraftAllowedMediaTypes } from '@/features/media/event-media';
import { resolveReveal, type CreationDraft } from '@/features/celebrations/draft/types';

/**
 * Builds the `CelebrationDetail` the real event screen renders from, out of
 * the draft the host has just finished configuring.
 *
 * This is the adapter that lets the creation reveal mount the *actual* event
 * page rather than a lookalike. The screen's contract is a detail object; the
 * only reason it could not be reused before was that no such object exists yet
 * at this point in the flow — `publishDraft` does not run until Continue. So
 * one is assembled here from the draft instead.
 *
 * Everything the host chose is carried across verbatim — title, closing date,
 * timezone, treatment, reveal mode, media types — because the point of the
 * preview is that it shows *their* event. Only the fields that exist solely
 * because a row has to have them (ids, timestamps, workspace) are synthesised,
 * and none of them is ever sent anywhere: the preview mounts with
 * `previewMode`, which stops every loader, every realtime channel and every
 * write before it can touch this id.
 */

/**
 * A recognisable, obviously-not-real id.
 *
 * If one of these ever appears in a log, a query or a storage key, something
 * has escaped preview mode — which is a good deal easier to trace than a
 * plausible-looking UUID would be.
 */
export const PREVIEW_CELEBRATION_ID = 'preview-celebration-not-yet-created';
const PREVIEW_SESSION_ID = 'preview-session-not-yet-created';

/** Stand-in numbers for the stat strip, so the preview does not read as empty. */
export const PREVIEW_METRICS = { guestsJoined: 12, contributors: 8, photos: 24 } as const;

export function buildPreviewDetail(draft: CreationDraft): CelebrationDetail {
  const now = new Date().toISOString();
  const reveal = resolveReveal(draft.guestRevealChoice, draft.endsAt, draft.guestCustomRevealAt);

  const celebration: CelebrationRow = {
    id: PREVIEW_CELEBRATION_ID,
    title: draft.title.trim() || 'Your event',
    celebration_type: draft.celebrationType,
    inspiration_pack: draft.inspirationPack,
    // The host's own cover, resolved by `useCoverSource` exactly as the live
    // screen resolves it — the reveal must not introduce a second code path
    // for turning a storage path into an image.
    cover_storage_path: draft.coverLocalUri ?? draft.coverStoragePath,
    default_theme_id: null,
    description: null,
    ends_at: draft.endsAt,
    starts_at: null,
    timezone: draft.timezone,
    event_code: null,
    public_slug: PREVIEW_CELEBRATION_ID,
    // `created_by` matters: the screen derives host-only chrome from it, and
    // the host is exactly who is looking at this.
    created_by: draft.userId ?? PREVIEW_CELEBRATION_ID,
    workspace_id: PREVIEW_CELEBRATION_ID,
    status: 'draft',
    published_at: null,
    location_name: null,
    location_address: null,
    created_at: draft.createdAt,
    updated_at: now,
    deleted_at: null,
  };

  const primarySession: EventSessionRow = {
    id: PREVIEW_SESSION_ID,
    celebration_id: PREVIEW_CELEBRATION_ID,
    name: 'Main event',
    sequence_number: 1,
    // The treatment drives how the grid renders every thumbnail, so a host who
    // picked Disposable sees a disposable-filtered preview.
    photo_treatment: draft.photoTreatment,
    date_stamp_enabled: draft.dateStampEnabled,
    capture_mode: draft.captureMode,
    allowed_media_types: resolveDraftAllowedMediaTypes(draft),
    shot_limit_per_guest: draft.shotLimitPerGuest ?? null,
    camera_roll_upload_limit: draft.cameraRollUploadLimit,
    camera_roll_uploads_after_close: draft.cameraRollAnytime,
    allow_media_from_any_date: draft.allowMediaFromAnyDate,
    gallery_visibility: draft.galleryVisibility,
    guest_downloads_enabled: draft.guestDownloadsEnabled,
    reveal_mode: reveal.mode,
    reveal_at: reveal.revealAt,
    ends_at: draft.endsAt,
    starts_at: null,
    timezone: draft.timezone,
    theme_id: null,
    status: 'draft',
    moderation_enabled: false,
    pin_required: false,
    preset_key: null,
    location_name: null,
    location_address: null,
    created_at: draft.createdAt,
    updated_at: now,
    deleted_at: null,
  };

  return {
    celebration,
    sessions: [primarySession],
    primarySession,
    metrics: { ...PREVIEW_METRICS },
    viewerRole: 'host',
    guestShotsUsed: null,
    // Null rather than empty: the screen's media loaders are skipped in
    // preview mode anyway, and `previewMode.photos` seeds the grid directly.
    mediaPhotos: null,
    challengePhotos: null,
    hasAudioGuestbook: true,
    recap: null,
  };
}
