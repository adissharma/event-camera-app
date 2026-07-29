import { scrubMessage } from './index';

describe('crash-report scrubbing', () => {
  // Crash reports capture more context than analytics events do, and provider
  // errors routinely embed credentials in their message text.

  it('removes signed storage URLs', () => {
    expect(
      scrubMessage('Failed to PUT https://x.supabase.co/storage/v1/object/sign?token=abc'),
    ).toBe('Failed to PUT [url]');
  });

  it('removes JWTs', () => {
    expect(
      scrubMessage('Bad JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123 rejected'),
    ).toBe('Bad JWT [jwt] rejected');
  });

  it('removes access tokens and public slugs', () => {
    expect(scrubMessage('slug ee75761514ae0aece5af2dc8310bf030 not found')).toBe(
      'slug [token] not found',
    );
  });

  it('removes email addresses', () => {
    expect(scrubMessage('No user for priya@example.com')).toBe('No user for [email]');
  });

  it('removes several credentials from one message', () => {
    const scrubbed = scrubMessage(
      'upload to https://a.co/x failed for guest@b.com token ee75761514ae0aece5af2dc8310bf030',
    );
    expect(scrubbed).not.toContain('https://');
    expect(scrubbed).not.toContain('@b.com');
    expect(scrubbed).not.toContain('ee75761514ae0aece5af2dc8310bf030');
  });

  it('leaves an ordinary message intact, so reports stay useful', () => {
    expect(scrubMessage('Upload failed after 3 attempts')).toBe(
      'Upload failed after 3 attempts',
    );
  });
});
