import { redact, setAnalyticsTransport, track, type AnalyticsProperties } from './index';

describe('analytics redaction', () => {
  describe('forbidden keys', () => {
    it('drops anything that could identify a guest or a host', () => {
      const result = redact({
        display_name: 'Priya Ramachandran',
        guest_name: 'Uncle Dave',
        email: 'someone@example.com',
        phone: '+447700900000',
        step: 3,
      });

      expect(result).toEqual({ step: 3 });
    });

    it('drops credentials whatever they are called', () => {
      const result = redact({
        guest_access_token: 'abc',
        accessToken: 'abc',
        pin: '1234',
        pinHash: 'x',
        password: 'x',
        api_secret: 'x',
        planTier: 2,
      });

      expect(result).toEqual({ planTier: 2 });
    });

    it('drops free text, where anything can hide', () => {
      const result = redact({
        event_title: "Priya and Arjun's Wedding",
        supporting_line: 'Add your photos to our day',
        failure_message: 'could not reach host',
        location_name: 'The Savoy',
        photoCount: 12,
      });

      expect(result).toEqual({ photoCount: 12 });
    });

    it('drops links and slugs, since a guest link is a bearer credential', () => {
      const result = redact({
        guest_url: 'https://example.com/e/abc#t=secret',
        public_slug: 'ee75761514ae0aece5af2dc8310bf030',
        signedUrl: 'https://storage/x',
        durationMs: 400,
      });

      expect(result).toEqual({ durationMs: 400 });
    });
  });

  describe('value-shaped detection', () => {
    it('drops a URL even under an innocent key', () => {
      expect(redact({ destination: 'https://example.com/e/abc' })).toEqual({});
      expect(redact({ target: 'http://localhost/x' })).toEqual({});
    });

    it('drops a long hex string even under an innocent key', () => {
      // An access token or a public slug that someone renamed.
      expect(redact({ reference: 'ee75761514ae0aece5af2dc8310bf030' })).toEqual({});
    });

    it('drops a JWT even under an innocent key', () => {
      expect(
        redact({ payload: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig' }),
      ).toEqual({});
    });

    it('keeps a short identifier that is not credential-shaped', () => {
      expect(redact({ variant: 'a1b2c3' })).toEqual({ variant: 'a1b2c3' });
    });
  });

  describe('what survives', () => {
    it('keeps the counts and flags that make analytics useful', () => {
      const properties: AnalyticsProperties = {
        step: 7,
        photoLimit: 25,
        isUnlimited: false,
        treatment: 'disposable',
        attemptNumber: 2,
        bytes: 1_048_576,
        retryCount: 0,
        wasResumed: true,
      };

      expect(redact(properties)).toEqual(properties);
    });

    it('keeps null', () => {
      expect(redact({ shotLimit: null })).toEqual({ shotLimit: null });
    });
  });

  describe('track', () => {
    it('redacts before the transport ever sees the properties', () => {
      const captured: { event: string; properties: AnalyticsProperties }[] = [];
      setAnalyticsTransport({
        capture: (event, properties) => captured.push({ event, properties }),
        identify: () => {},
        reset: () => {},
      });

      track('event_published', {
        event_title: 'Secret Wedding',
        guest_url: 'https://example.com/e/abc#t=tok',
        planTier: 3,
      });

      expect(captured).toHaveLength(1);
      expect(captured[0].properties).toEqual({ planTier: 3 });
      // Belt and braces: assert the sensitive values are absent from the whole
      // serialised payload, not just from the keys we thought to check.
      const serialised = JSON.stringify(captured[0]);
      expect(serialised).not.toContain('Secret Wedding');
      expect(serialised).not.toContain('t=tok');
    });
  });
});
