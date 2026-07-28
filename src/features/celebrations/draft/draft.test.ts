import { createEmptyDraft, resolveReveal, type CreationDraft } from './types';
import { canPublish, incompleteSteps, validateStep } from './validation';

const TZ = 'Europe/London';
const CLOSE = '2026-08-15T22:00:00.000Z';

function draftWith(overrides: Partial<CreationDraft>): CreationDraft {
  return { ...createEmptyDraft('user-1', TZ), ...overrides };
}

describe('reveal resolution', () => {
  it('maps "during the event" to an instant reveal with no timestamp', () => {
    expect(resolveReveal('during', CLOSE, null)).toEqual({ mode: 'instant', revealAt: null });
  });

  it('maps "when I decide" to manual', () => {
    expect(resolveReveal('manual', CLOSE, null)).toEqual({ mode: 'manual', revealAt: null });
  });

  it('reveals at the closing time', () => {
    expect(resolveReveal('at_close', CLOSE, null)).toEqual({ mode: 'scheduled', revealAt: CLOSE });
  });

  it('adds exactly 12 and 24 hours', () => {
    expect(resolveReveal('after_12h', CLOSE, null).revealAt).toBe('2026-08-16T10:00:00.000Z');
    expect(resolveReveal('after_24h', CLOSE, null).revealAt).toBe('2026-08-16T22:00:00.000Z');
  });

  it('adds absolute hours across a daylight-saving boundary', () => {
    // UK clocks go back at 02:00 on 26 October 2026. "12 hours after" has to
    // mean twelve actual hours, not the same wall-clock time — a guest told to
    // come back at 10am must not find the gallery still developing.
    const beforeChange = '2026-10-25T00:30:00.000Z';
    expect(resolveReveal('after_12h', beforeChange, null).revealAt).toBe(
      '2026-10-25T12:30:00.000Z',
    );
  });

  it('uses the custom time when one is set', () => {
    const custom = '2026-08-20T09:00:00.000Z';
    expect(resolveReveal('custom', CLOSE, custom)).toEqual({
      mode: 'scheduled',
      revealAt: custom,
    });
  });

  it('falls back to manual rather than inventing a time', () => {
    // A wrong reveal time is worse than asking the host to press a button.
    expect(resolveReveal('custom', CLOSE, null)).toEqual({ mode: 'manual', revealAt: null });
    expect(resolveReveal('after_12h', null, null)).toEqual({ mode: 'manual', revealAt: null });
    expect(resolveReveal('at_close', null, null)).toEqual({ mode: 'manual', revealAt: null });
  });
});

describe('step validation', () => {
  describe('name', () => {
    it('requires a name', () => {
      expect(validateStep('name', draftWith({ title: '' }))).toMatch(/Give your event a name/);
      expect(validateStep('name', draftWith({ title: '   ' }))).not.toBeNull();
    });

    it('accepts names the type system must survive', () => {
      for (const title of [
        'Priya Ramachandran & Arjun Venkataraman',
        'Aisha Rahman-Choudhury',
        'Sam & Alex',
        "Maria's 50th",
      ]) {
        expect(validateStep('name', draftWith({ title }))).toBeNull();
      }
    });
  });

  describe('closing', () => {
    it('requires a closing time', () => {
      expect(validateStep('closing', draftWith({ endsAt: null }))).not.toBeNull();
    });

    it('rejects a time in the past', () => {
      expect(validateStep('closing', draftWith({ endsAt: '2020-01-01T00:00:00.000Z' }))).toMatch(
        /future/,
      );
    });

    it('accepts a future time', () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      expect(validateStep('closing', draftWith({ endsAt: future }))).toBeNull();
    });
  });

  describe('privacy', () => {
    it('requires a PIN when one is switched on', () => {
      expect(validateStep('privacy', draftWith({ pinRequired: true, pin: null }))).toMatch(/PIN/);
      expect(validateStep('privacy', draftWith({ pinRequired: true, pin: '12' }))).not.toBeNull();
    });

    it('accepts a 4 to 8 digit PIN', () => {
      expect(validateStep('privacy', draftWith({ pinRequired: true, pin: '1234' }))).toBeNull();
      expect(validateStep('privacy', draftWith({ pinRequired: true, pin: '12345678' }))).toBeNull();
    });

    it('ignores a stale PIN when the toggle is off', () => {
      expect(validateStep('privacy', draftWith({ pinRequired: false, pin: null }))).toBeNull();
    });
  });

  describe('reveal', () => {
    it('requires a time for a custom reveal', () => {
      expect(
        validateStep('reveal', draftWith({ revealChoice: 'custom', customRevealAt: null })),
      ).not.toBeNull();
    });

    it('rejects a reveal before the event closes', () => {
      // Guests seeing the gallery while still shooting contradicts the entire
      // delayed-reveal promise.
      const error = validateStep(
        'reveal',
        draftWith({
          revealChoice: 'custom',
          endsAt: CLOSE,
          customRevealAt: '2026-08-15T18:00:00.000Z',
        }),
      );
      expect(error).toMatch(/cannot be before/);
    });

    it('accepts a reveal after the event closes', () => {
      expect(
        validateStep(
          'reveal',
          draftWith({
            revealChoice: 'custom',
            endsAt: CLOSE,
            customRevealAt: '2026-08-16T09:00:00.000Z',
          }),
        ),
      ).toBeNull();
    });
  });

  describe('photo limit', () => {
    it('treats null as unlimited rather than missing', () => {
      expect(validateStep('photo-limit', draftWith({ shotLimitPerGuest: null }))).toBeNull();
    });

    it('rejects zero or negative', () => {
      expect(validateStep('photo-limit', draftWith({ shotLimitPerGuest: 0 }))).not.toBeNull();
    });
  });
});

describe('publishability', () => {
  const complete = (): CreationDraft =>
    draftWith({
      title: 'Priya & Arjun',
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      planKey: 'signature',
    });

  it('is publishable once name, closing time, formats and package are set', () => {
    expect(canPublish(complete())).toBe(true);
  });

  it('is not publishable without a package', () => {
    expect(canPublish({ ...complete(), planKey: null })).toBe(false);
  });

  it('is not publishable without a closing time', () => {
    expect(canPublish({ ...complete(), endsAt: null })).toBe(false);
  });

  it('is not publishable with no contribution format', () => {
    expect(canPublish({ ...complete(), allowedMediaTypes: [] })).toBe(false);
  });

  it('lists exactly the steps still needing attention', () => {
    const incomplete = incompleteSteps(draftWith({ title: '' }));
    expect(incomplete).toContain('name');
    expect(incomplete).toContain('closing');
    expect(incomplete).toContain('package');
    // Steps with a valid default must not be nagged about.
    expect(incomplete).not.toContain('treatment');
    expect(incomplete).not.toContain('qr');
  });

  it('reports nothing incomplete for a finished draft', () => {
    expect(incompleteSteps(complete())).toEqual([]);
  });
});

describe('empty draft defaults', () => {
  it('starts with sensible MVP defaults', () => {
    const draft = createEmptyDraft('user-1', TZ);
    expect(draft.allowedMediaTypes).toEqual(['photo']);
    expect(draft.captureMode).toBe('camera_and_library');
    expect(draft.galleryVisibility).toBe('all_guests');
    expect(draft.revealChoice).toBe('after_12h');
    expect(draft.photoTreatment).toBe('original');
    expect(draft.furthestStep).toBe('name');
  });

  it('records the owning user, so one account never restores another draft', () => {
    expect(createEmptyDraft('user-1', TZ).userId).toBe('user-1');
  });
});
