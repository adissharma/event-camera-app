import { joinRouteFor, parseJoinInput, parseJoinUrl } from './join-link';

const HOST = 'https://event-camera-app-navy.vercel.app';

describe('links we mint', () => {
  it('reads a plain share link', () => {
    expect(parseJoinUrl(`${HOST}/j/abc123`)).toEqual({ code: 'abc123', token: null });
  });

  it('keeps the invitation token from the fragment', () => {
    // `buildGuestUrl` puts it there deliberately, to keep it out of server
    // logs and the Referer header. Dropping it downgrades an invited guest to
    // someone who merely knows the code.
    expect(parseJoinUrl(`${HOST}/j/abc123#t=secret-token`)).toEqual({
      code: 'abc123',
      token: 'secret-token',
    });
  });

  it('also reads a token that a share sheet rewrote into the query', () => {
    expect(parseJoinUrl(`${HOST}/j/abc123?t=secret-token`)?.token).toBe('secret-token');
  });

  it('reads the app’s own deep-link scheme, where the code lands in the host', () => {
    expect(parseJoinUrl('eventcamera://j/abc123')).toEqual({ code: 'abc123', token: null });
  });

  it('tolerates a percent-encoded code', () => {
    expect(parseJoinUrl(`${HOST}/j/abc%2D123`)?.code).toBe('abc-123');
  });
});

describe('links that are not ours', () => {
  // A QR code arrives without anyone having chosen it, so every one of these
  // is a destination the scanner must refuse to send a guest to.
  it.each([
    ['another host entirely', 'https://evil.example.com/j/abc123'],
    ['our path on a lookalike host', 'https://event-camera-app-navy.vercel.app.evil.com/j/abc123'],
    ['a javascript: payload', 'javascript:alert(1)//j/abc'],
    ['a data: payload', 'data:text/html,<script>alert(1)</script>'],
    ['a file: path', 'file:///etc/passwd'],
    ['our host but a different page', `${HOST}/settings/abc123`],
    ['a deeper path under /j', `${HOST}/j/abc123/extra`],
    ['/j with no code', `${HOST}/j/`],
    ['plain text', 'just some text'],
    ['an empty string', ''],
  ])('refuses %s', (_label, raw) => {
    expect(parseJoinUrl(raw)).toBeNull();
  });

  it('refuses a bare code, which is not a link and not consent', () => {
    // Pointing a camera at a sticker reading "WEDDING" is not a decision to
    // join an event called WEDDING.
    expect(parseJoinUrl('WEDDING')).toBeNull();
  });
});

describe('what a guest may paste', () => {
  it('takes a full link, exactly as the scanner would', () => {
    expect(parseJoinInput(`${HOST}/j/abc123#t=tok`)).toEqual({ code: 'abc123', token: 'tok' });
  });

  it('takes a bare code, because typing one is a deliberate act', () => {
    expect(parseJoinInput('abc123')).toEqual({ code: 'abc123', token: null });
  });

  it('ignores surrounding whitespace from a clipboard', () => {
    expect(parseJoinInput('  abc123\n')?.code).toBe('abc123');
  });

  it('still refuses somebody else’s URL', () => {
    expect(parseJoinInput('https://evil.example.com/j/abc123')).toBeNull();
  });

  it('refuses a sentence that merely contains a code', () => {
    expect(parseJoinInput('join my event abc123 please')).toBeNull();
  });
});

describe('the route both paths hand off to', () => {
  it('is the existing guest join flow', () => {
    expect(joinRouteFor({ code: 'abc123', token: null })).toBe('/j/abc123');
  });

  it('carries the token through as a param the flow already reads', () => {
    expect(joinRouteFor({ code: 'abc123', token: 'tok en' })).toBe('/j/abc123?t=tok%20en');
  });
});
