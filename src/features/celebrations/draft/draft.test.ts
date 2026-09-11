import {
  createEmptyDraft,
  resolveGuestReveal,
  resolveReveal,
  type CreationDraft,
} from './types';
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

  it('reveals at the closing time', () => {
    expect(resolveReveal('at_close', CLOSE, null)).toEqual({
      mode: 'scheduled',
      revealAt: CLOSE,
    });
  });

  it('uses the custom time when one is set', () => {
    // Relative to now, not a literal date: a hardcoded one silently becomes a
    // *past* time once the clock passes it, and the case below shows that is a
    // different assertion entirely.
    const custom = new Date(Date.now() + 86_400_000).toISOString();
    expect(resolveReveal('custom', CLOSE, custom)).toEqual({
      mode: 'scheduled',
      revealAt: custom,
    });
  });

  it('treats a custom time that has already passed as an immediate reveal', () => {
    // Time keeps moving while a host finishes setup, and a guest reveal is an
    // offset from the host's, so both can legitimately resolve to a moment
    // already gone by the time the event is published. Scheduling that would
    // leave the gallery waiting for an instant that never arrives.
    expect(resolveReveal('custom', CLOSE, '2020-01-01T00:00:00.000Z')).toEqual({
      mode: 'instant',
      revealAt: null,
    });
  });

  it('falls back to manual rather than inventing a time', () => {
    // A wrong reveal time is worse than asking the host to press a button.
    expect(resolveReveal('custom', CLOSE, null)).toEqual({ mode: 'manual', revealAt: null });
    expect(resolveReveal('at_close', null, null)).toEqual({ mode: 'manual', revealAt: null });
    expect(resolveReveal('never', CLOSE, null)).toEqual({ mode: 'manual', revealAt: null });
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

    it('rejects today even when the selected time is still ahead', () => {
      const laterToday = new Date();
      laterToday.setHours(23, 59, 0, 0);
      expect(validateStep('closing', draftWith({ endsAt: laterToday.toISOString() }))).toMatch(
        /future/,
      );
    });

    it('rejects a day more than one calendar year away', () => {
      const tooFar = new Date();
      tooFar.setFullYear(tooFar.getFullYear() + 1);
      tooFar.setDate(tooFar.getDate() + 1);
      expect(validateStep('closing', draftWith({ endsAt: tooFar.toISOString() }))).toMatch(
        /within the next year/,
      );
    });

    it('accepts a future time', () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      expect(validateStep('closing', draftWith({ endsAt: future }))).toBeNull();
    });
  });

  describe('reveal', () => {
    it('accepts "during" for both me and guests', () => {
      expect(
        validateStep(
          'guest-reveal',
          draftWith({ hostRevealChoice: 'during', guestRevealChoice: 'during' }),
        ),
      ).toBeNull();
    });

    it('accepts same-time guests by following the host reveal choice', () => {
      expect(
        validateStep(
          'guest-reveal',
          draftWith({
            hostRevealChoice: 'at_close',
            guestRevealChoice: 'at_close',
            guestRevealDelayHours: null,
            endsAt: CLOSE,
          }),
        ),
      ).toBeNull();
    });

    it('rejects a custom host reveal with no host time', () => {
      expect(
        validateStep(
          'guest-reveal',
          draftWith({
            hostRevealChoice: 'custom',
            hostCustomRevealAt: null,
            guestRevealChoice: 'custom',
            guestRevealDelayHours: null,
          }),
        ),
      ).toMatch(/Choose a day and time/);
    });

    it('rejects a delayed guest reveal when the host base time is missing', () => {
      expect(
        validateStep(
          'guest-reveal',
          draftWith({
            hostRevealChoice: 'custom',
            hostCustomRevealAt: null,
            guestRevealChoice: 'custom',
            guestRevealDelayHours: 12,
          }),
        ),
      ).toMatch(/Choose a day and time/);
    });

    it('accepts a custom reveal whose time has already passed', () => {
      // Deliberately not an error. Re-opening settings for an event whose
      // reveal time has come and gone used to block the host on a step they
      // had already completed correctly; `resolveReveal` turns an elapsed
      // custom time into an immediate reveal instead.
      expect(
        validateStep(
          'guest-reveal',
          draftWith({
            hostRevealChoice: 'custom',
            hostCustomRevealAt: '2020-01-01T00:00:00.000Z',
            guestRevealChoice: 'custom',
            guestCustomRevealAt: '2020-01-01T00:00:00.000Z',
          }),
        ),
      ).toBeNull();
    });

    it('accepts future custom reveals where guest is at or after host', () => {
      const hostTime = new Date(Date.now() + 86_400_000);
      expect(
        validateStep(
          'guest-reveal',
          draftWith({
            hostRevealChoice: 'custom',
            hostCustomRevealAt: hostTime.toISOString(),
            guestRevealChoice: 'custom',
            guestRevealDelayHours: 1,
          }),
        ),
      ).toBeNull();
    });

    it('accepts never as a host-only guest access choice', () => {
      expect(
        validateStep(
          'guest-reveal',
          draftWith({
            hostRevealChoice: 'custom',
            hostCustomRevealAt: new Date(Date.now() + 86_400_000).toISOString(),
            guestRevealChoice: 'never',
            guestCustomRevealAt: null,
            galleryVisibility: 'hosts_only',
          }),
        ),
      ).toBeNull();
    });
  });

  it('keeps guest timing relative to the host reveal', () => {
    const firstHostTime = '2027-08-15T20:00:00.000Z';
    const secondHostTime = '2027-08-16T10:00:00.000Z';

    expect(
      resolveGuestReveal(
        draftWith({
          hostRevealChoice: 'custom',
          hostCustomRevealAt: firstHostTime,
          guestRevealChoice: 'custom',
          guestRevealDelayHours: 12,
        }),
      ),
    ).toEqual({
      mode: 'scheduled',
      revealAt: '2027-08-16T08:00:00.000Z',
    });

    expect(
      resolveGuestReveal(
        draftWith({
          hostRevealChoice: 'custom',
          hostCustomRevealAt: secondHostTime,
          guestRevealChoice: 'custom',
          guestRevealDelayHours: 12,
        }),
      ),
    ).toEqual({
      mode: 'scheduled',
      revealAt: '2027-08-16T22:00:00.000Z',
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
      planKey: 'guests_50',
      shotLimitPerGuest: 25,
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
    expect(draft.hostRevealChoice).toBe('at_close');
    expect(draft.guestRevealChoice).toBe('at_close');
    expect(draft.guestRevealDelayHours).toBeNull();
    expect(draft.photoTreatment).toBe('original');
  });

  it('records the owning user, so one account never restores another draft', () => {
    expect(createEmptyDraft('user-1', TZ).userId).toBe('user-1');
  });
});
