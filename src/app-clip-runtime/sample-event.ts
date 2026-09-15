/**
 * The sample album is a host-dashboard teaching aid. App Clip invocations can
 * only resolve real event invitations, so its bundled photography must never
 * enter the Clip payload.
 */
export const SAMPLE_CELEBRATION_ID = '__sample_unavailable_in_app_clip__';
export const SAMPLE_EVENT_LABEL = '';
export const SAMPLE_GUESTS_JOINED = 0;
export const SAMPLE_PLAN_KEY = 'guests_unlimited';
export const SAMPLE_COVER = 0;
export const SAMPLE_PHOTOS: readonly never[] = [];
export const SAMPLE_CHALLENGES: readonly never[] = [];
export const SAMPLE_CHALLENGE_IDS = {} as const;
export const SAMPLE_EVENT = {
  id: SAMPLE_CELEBRATION_ID,
  title: '',
  celebrationType: 'other' as const,
  endsAt: new Date(0).toISOString(),
  timezone: 'UTC',
  guestsJoined: 0,
  photos: SAMPLE_PHOTOS,
  challenges: SAMPLE_CHALLENGES,
  cover: SAMPLE_COVER,
};

export function isSampleCelebrationId(): boolean {
  return false;
}

export function sampleEventEndsAt(): string {
  return SAMPLE_EVENT.endsAt;
}

export function sampleCapturedAt(): string {
  return SAMPLE_EVENT.endsAt;
}

export function sampleAssetUri(): string {
  return '';
}
