import { FEATURE_FLAGS } from '@/config/feature-flags';
import type { EventSessionRow, MediaType } from '@/types/database';
import type { CreationDraft } from '@/features/celebrations/draft/types';

export type SupportedEventMediaType = Extract<MediaType, 'photo' | 'video'>;

export function isVideoMediaType(value: MediaType | string | null | undefined): value is 'video' {
  return value === 'video';
}

export function eventAllowsVideoCapture(
  session: Pick<EventSessionRow, 'allowed_media_types'> | null | undefined,
): boolean {
  if (!FEATURE_FLAGS.videoContributions) return false;
  return true;
}

export function resolveDraftAllowedMediaTypes(draft: CreationDraft): SupportedEventMediaType[] {
  const types = new Set<SupportedEventMediaType>(['photo']);

  if (FEATURE_FLAGS.videoContributions) {
    types.add('video');
  }

  for (const mediaType of draft.allowedMediaTypes) {
    if (mediaType === 'photo') {
      types.add('photo');
    }
    if (mediaType === 'video' && FEATURE_FLAGS.videoContributions) {
      types.add('video');
    }
  }

  return Array.from(types);
}
