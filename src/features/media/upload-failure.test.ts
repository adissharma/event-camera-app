import { isConnectionFailure, uploadFailureCopy } from './upload-failure';

describe('telling someone their upload failed', () => {
  it('suggests a better signal when the connection dropped, without the technical detail', () => {
    const copy = uploadFailureCopy(
      'photo',
      new Error('Guest photo upload intent failed: fetch failed: Unexpected exception. The network connection was lost.'),
    );

    expect(copy.title).toBe("Couldn't post your photo");
    expect(copy.message).toMatch(/signal/);
    expect(copy.message).not.toMatch(/intent|exception|fetch/i);
  });

  it('calls a recording a message', () => {
    expect(uploadFailureCopy('audio', new Error('nope')).title).toBe("Couldn't post your message");
  });

  it('explains a limit rather than blaming the signal', () => {
    expect(uploadFailureCopy('photo', new Error('Guest photo upload intent failed: shot limit reached')).message).toBe(
      "You've used all your shots for this event.",
    );
  });

  it('never shows the raw error for something unexpected', () => {
    expect(uploadFailureCopy('video', new Error('permission denied for table media_items')).message).toBe(
      'Something got in the way. Please try again in a moment.',
    );
  });

  it('tells dropped connections from refusals', () => {
    expect(isConnectionFailure('TypeError: Network request failed')).toBe(true);
    expect(isConnectionFailure('The Internet connection appears to be offline.')).toBe(true);
    expect(isConnectionFailure('The request timed out.')).toBe(true);
    expect(isConnectionFailure('shot limit reached')).toBe(false);
  });
});
