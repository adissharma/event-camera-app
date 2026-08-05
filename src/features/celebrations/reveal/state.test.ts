import {
  canViewerSeePhotos,
  formatRevealCountdown,
  isEventEnded,
  msUntilReveal,
  resolveRevealModalState,
} from './state';

/** A fixed clock, so nothing here depends on when it runs. */
const NOW = Date.parse('2026-08-02T12:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('isEventEnded', () => {
  it('is false while the event is still running', () => {
    expect(isEventEnded({ now: NOW, endsAt: at(HOUR) })).toBe(false);
  });

  it('is true once the end time has passed', () => {
    expect(isEventEnded({ now: NOW, endsAt: at(-1) })).toBe(true);
  });

  it('treats the exact end instant as ended', () => {
    expect(isEventEnded({ now: NOW, endsAt: at(0) })).toBe(true);
  });

  it('never ends an open-ended event', () => {
    // The bug this guards: an absent end time parsing to 0 and reading as
    // "ended in 1970", which would fire the modal on every open-ended event.
    expect(isEventEnded({ now: NOW, endsAt: null })).toBe(false);
    expect(isEventEnded({ now: NOW, endsAt: undefined })).toBe(false);
  });

  it('never ends an event whose end time is unparseable', () => {
    expect(isEventEnded({ now: NOW, endsAt: 'not a date' })).toBe(false);
  });
});

describe('canViewerSeePhotos', () => {
  it('shows instant-reveal photos throughout', () => {
    expect(canViewerSeePhotos({ now: NOW, revealAt: null, revealMode: 'instant' })).toBe(true);
  });

  it('withholds a scheduled reveal until its time', () => {
    expect(canViewerSeePhotos({ now: NOW, revealAt: at(HOUR), revealMode: 'scheduled' })).toBe(false);
    expect(canViewerSeePhotos({ now: NOW, revealAt: at(-1), revealMode: 'scheduled' })).toBe(true);
  });

  it('withholds a scheduled reveal that has no time set', () => {
    expect(canViewerSeePhotos({ now: NOW, revealAt: null, revealMode: 'scheduled' })).toBe(false);
  });

  it('withholds a manual reveal until the host releases it', () => {
    expect(canViewerSeePhotos({ now: NOW, revealAt: null, revealMode: 'manual' })).toBe(false);
    expect(canViewerSeePhotos({ now: NOW, revealAt: at(-1), revealMode: 'manual' })).toBe(true);
  });

  it('shows photos for a session predating the reveal feature', () => {
    expect(canViewerSeePhotos({ now: NOW, revealAt: null, revealMode: null })).toBe(true);
  });
});

describe('resolveRevealModalState', () => {
  const scheduled = { revealAt: at(2 * HOUR), revealMode: 'scheduled' as const };

  it('stays hidden while the event is running', () => {
    expect(
      resolveRevealModalState({ now: NOW, endsAt: at(HOUR), ...scheduled }),
    ).toBe('hidden');
  });

  it('awaits the reveal once the event has ended', () => {
    expect(
      resolveRevealModalState({ now: NOW, endsAt: at(-HOUR), ...scheduled }),
    ).toBe('awaiting_reveal');
  });

  it('reveals once the reveal time has also passed', () => {
    expect(
      resolveRevealModalState({
        now: NOW,
        endsAt: at(-2 * HOUR),
        revealAt: at(-HOUR),
        revealMode: 'scheduled',
      }),
    ).toBe('revealed');
  });

  it('reveals immediately for an instant event that has ended', () => {
    expect(
      resolveRevealModalState({
        now: NOW,
        endsAt: at(-HOUR),
        revealAt: null,
        revealMode: 'instant',
      }),
    ).toBe('revealed');
  });

  it('lets a server answer override the local calculation', () => {
    // The whole point of the override: the device clock says the reveal has
    // passed, the server says the viewer still cannot see them. Server wins.
    expect(
      resolveRevealModalState({
        now: NOW,
        endsAt: at(-2 * HOUR),
        revealAt: at(-HOUR),
        revealMode: 'scheduled',
        viewerCanSeePhotos: false,
      }),
    ).toBe('awaiting_reveal');
  });
});

describe('msUntilReveal', () => {
  it('counts down to a pending reveal', () => {
    expect(msUntilReveal({ now: NOW, revealAt: at(90 * 60_000), revealMode: 'scheduled' }))
      .toBe(90 * 60_000);
  });

  it('is null once the photos are visible', () => {
    expect(msUntilReveal({ now: NOW, revealAt: at(-1), revealMode: 'scheduled' })).toBeNull();
    expect(msUntilReveal({ now: NOW, revealAt: null, revealMode: 'instant' })).toBeNull();
  });

  it('is null when nothing has been scheduled to count towards', () => {
    expect(msUntilReveal({ now: NOW, revealAt: null, revealMode: 'manual' })).toBeNull();
  });
});

describe('formatRevealCountdown', () => {
  it('matches the design copy', () => {
    expect(formatRevealCountdown(2 * HOUR + 14 * 60_000)).toBe('2h 14m');
  });

  it('floors rather than rounds, so it never under-promises the wait', () => {
    expect(formatRevealCountdown(2 * HOUR + 14 * 60_000 + 59_000)).toBe('2h 14m');
  });

  it('drops a zero minutes component', () => {
    expect(formatRevealCountdown(3 * HOUR)).toBe('3h');
  });

  it('uses days once there are any', () => {
    expect(formatRevealCountdown(DAY + 5 * HOUR)).toBe('1d 5h');
    expect(formatRevealCountdown(2 * DAY)).toBe('2d');
  });

  it('shows minutes alone under an hour', () => {
    expect(formatRevealCountdown(14 * 60_000)).toBe('14m');
  });

  it('stops counting seconds in the last minute', () => {
    expect(formatRevealCountdown(45_000)).toBe('under a minute');
  });

  it('handles having already arrived', () => {
    expect(formatRevealCountdown(0)).toBe('any moment now');
    expect(formatRevealCountdown(-5000)).toBe('any moment now');
  });
});
