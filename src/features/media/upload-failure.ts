/**
 * What to tell someone whose photo, video or message did not post.
 *
 * Written for a guest at a party: what happened and what to do about it. The
 * underlying error is for the logs, never the screen.
 */

export type UploadFailureKind = 'photo' | 'video' | 'audio';

export interface UploadFailureCopy {
  title: string;
  message: string;
}

/** A request that never got an answer, as opposed to one the server refused. */
export function isConnectionFailure(message: string): boolean {
  return /fetch failed|network|connection|timed out|offline|internet/i.test(message);
}

const NOUNS: Record<UploadFailureKind, string> = {
  photo: 'photo',
  video: 'video',
  audio: 'message',
};

export function uploadFailureCopy(kind: UploadFailureKind, error: unknown): UploadFailureCopy {
  const title = `Couldn't post your ${NOUNS[kind]}`;
  const reason = error instanceof Error ? error.message : '';

  if (reason.includes('shot limit reached')) {
    return { title, message: "You've used all your shots for this event." };
  }
  if (reason.includes('camera_roll_limit_reached')) {
    return {
      title,
      message: "You've added all the camera roll photos this event allows. Photos you take here still count.",
    };
  }
  if (reason.includes('video_limit_reached')) {
    return { title, message: "You've posted all the videos this event allows. You can still take photos." };
  }
  if (reason.includes('videos_turned_off')) {
    return { title, message: 'Videos are off for this event. You can still take photos.' };
  }
  if (reason.includes('guestbook_messages_unavailable')) {
    return { title, message: "This event's Guestbook isn't taking messages." };
  }
  if (isConnectionFailure(reason)) {
    return { title, message: 'Your signal might be weak here. Try moving somewhere with better reception, then post again.' };
  }
  return { title, message: 'Something got in the way. Please try again in a moment.' };
}
