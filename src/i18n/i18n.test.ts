import { copy, t } from './index';

describe('copy deck', () => {
  it('interpolates named placeholders', () => {
    expect(t('We sent a code to {email}', { email: 'a@b.com' })).toBe(
      'We sent a code to a@b.com',
    );
  });

  it('interpolates repeated and multiple placeholders', () => {
    expect(t('{a} and {b} and {a}', { a: 'x', b: 'y' })).toBe('x and y and x');
  });

  it('leaves an unknown placeholder visible rather than printing undefined', () => {
    // "We sent a code to undefined" reads as a broken product to a user;
    // a visible {email} is an obvious bug in review.
    expect(t('Hello {missing}', { other: 'x' })).toBe('Hello {missing}');
  });

  it('accepts numbers', () => {
    expect(t('{count} photos', { count: 25 })).toBe('25 photos');
  });

  it('returns the template unchanged when no values are supplied', () => {
    expect(t('No placeholders here')).toBe('No placeholders here');
  });

  describe('brand neutrality', () => {
    it('contains no hard-coded product name', () => {
      // The working name must reach copy only via BRAND_CONFIG interpolation.
      const serialised = JSON.stringify(copy);
      expect(serialised).not.toMatch(/koto/i);
      expect(serialised).not.toMatch(/poto/i);
    });
  });

  describe('copy rules from the brief', () => {
    it('does not describe camera-roll settings as loosening restrictions', () => {
      const serialised = JSON.stringify(copy).toLowerCase();
      expect(serialised).not.toContain('loosen');
      expect(serialised).not.toContain('restriction');
    });

    it('uses British spelling', () => {
      const serialised = JSON.stringify(copy);
      expect(serialised).not.toMatch(/\bcolor\b/i);
      expect(serialised).not.toMatch(/\bcustomize\b/i);
      expect(serialised).not.toMatch(/\bpersonalize\b/i);
    });

    it('does not borrow the nearest competitor\'s vocabulary', () => {
      // The reference audit binds us away from "film"/"develops" as brand terms.
      const serialised = JSON.stringify(copy).toLowerCase();
      expect(serialised).not.toContain('film roll');
      expect(serialised).not.toContain('your film');
    });

    it('labels unavailable features honestly rather than hiding a dead control', () => {
      expect(copy.create.comingLater).toBeTruthy();
      expect(copy.dashboard.addFunctionComingLater).toBeTruthy();
    });
  });

  describe('error copy safety', () => {
    it('never suggests exposing a token, URL or path to a user', () => {
      const errors = JSON.stringify(copy.errors).toLowerCase();
      expect(errors).not.toContain('token');
      expect(errors).not.toContain('http');
      expect(errors).not.toContain('storage/');
    });
  });
});
