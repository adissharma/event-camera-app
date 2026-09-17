import { getLiveActivityState } from './live-activity';

describe('Live Activity event mapping', () => {
  const future = () => new Date(Date.now() + 60_000).toISOString();

  it('maps a capped guest allowance from that guest’s own count', () => {
    expect(
      getLiveActivityState({
        celebrationId: 'event',
        eventName: 'Event',
        endsAt: future(),
        shotLimit: 24,
        shotsUsed: 7,
      }),
    ).toMatchObject({ photoAllowance: 24, photosLeft: 17 });
  });

  it('preserves the existing unlimited sentinel for null limits', () => {
    expect(
      getLiveActivityState({
        celebrationId: 'event',
        eventName: 'Event',
        endsAt: future(),
        shotLimit: null,
        shotsUsed: 99,
      }),
    ).toMatchObject({ photoAllowance: -1, photosLeft: -1 });
  });

  it('clamps exhausted capped events at zero', () => {
    expect(
      getLiveActivityState({
        celebrationId: 'event',
        eventName: 'Event',
        endsAt: future(),
        shotLimit: 5,
        shotsUsed: 8,
      }),
    ).toMatchObject({ photoAllowance: 5, photosLeft: 0 });
  });

  it('does not request an activity for an expired or malformed event', () => {
    expect(
      getLiveActivityState({
        celebrationId: 'event',
        eventName: 'Event',
        endsAt: new Date(Date.now() - 1).toISOString(),
        shotLimit: 5,
        shotsUsed: 0,
      }),
    ).toBeNull();
    expect(
      getLiveActivityState({
        celebrationId: 'event',
        eventName: 'Event',
        endsAt: 'not-a-date',
        shotLimit: 5,
        shotsUsed: 0,
      }),
    ).toBeNull();
  });
});
