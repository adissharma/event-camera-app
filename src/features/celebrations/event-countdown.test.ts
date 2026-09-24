import { countdownStat, eventCountdown } from './event-countdown';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const END = '2026-10-01T18:00:00.000Z';
const endMs = new Date(END).getTime();
const at = (remaining: number) => endMs - remaining;

describe('eventCountdown', () => {
  it('is open when there is no end time', () => {
    expect(eventCountdown(null, Date.now())).toEqual({ state: 'open' });
    expect(eventCountdown(undefined, Date.now())).toEqual({ state: 'open' });
    expect(eventCountdown('not a date', Date.now())).toEqual({ state: 'open' });
  });

  it('is ended at and after the end time, never "0 mins"', () => {
    expect(eventCountdown(END, endMs)).toEqual({ state: 'ended' });
    expect(eventCountdown(END, endMs + DAY)).toEqual({ state: 'ended' });
  });

  it('counts whole days while at least one day remains', () => {
    expect(eventCountdown(END, at(29 * DAY + 5 * HOUR))).toMatchObject({ unit: 'day', value: 29 });
    expect(eventCountdown(END, at(DAY))).toMatchObject({ unit: 'day', value: 1 });
    // Floored: a day and twenty-three hours is still "1 day".
    expect(eventCountdown(END, at(2 * DAY - 1))).toMatchObject({ unit: 'day', value: 1 });
  });

  it('switches to hours inside the final day', () => {
    expect(eventCountdown(END, at(DAY - 1))).toMatchObject({ unit: 'hour', value: 23 });
    expect(eventCountdown(END, at(8 * HOUR + 40 * MINUTE))).toMatchObject({ unit: 'hour', value: 8 });
    expect(eventCountdown(END, at(HOUR))).toMatchObject({ unit: 'hour', value: 1 });
  });

  it('switches to minutes inside the final hour', () => {
    expect(eventCountdown(END, at(HOUR - 1))).toMatchObject({ unit: 'minute', value: 59 });
    expect(eventCountdown(END, at(24 * MINUTE + 30_000))).toMatchObject({ unit: 'minute', value: 24 });
    // Under a minute still reads as one minute rather than zero.
    expect(eventCountdown(END, at(15_000))).toMatchObject({ unit: 'minute', value: 1 });
  });

  it('schedules the next refresh for the moment the display changes', () => {
    const cases = [
      29 * DAY + 5 * HOUR,
      2 * DAY,
      DAY + 1,
      8 * HOUR + 40 * MINUTE,
      HOUR,
      42 * MINUTE + 10_000,
      15_000,
    ];
    for (const remaining of cases) {
      const now = at(remaining);
      const current = eventCountdown(END, now);
      if (current.state !== 'running') throw new Error('expected a running countdown');

      // Nothing changes before the scheduled moment…
      expect(eventCountdown(END, now + current.msUntilChange - 1)).toMatchObject({
        unit: current.unit,
        value: current.value,
      });
      // …and something does at it.
      expect(eventCountdown(END, now + current.msUntilChange)).not.toMatchObject({
        unit: current.unit,
        value: current.value,
      });
    }
  });

  it('refreshes at most once per displayed unit', () => {
    const days = eventCountdown(END, at(10 * DAY + 3 * HOUR));
    const hours = eventCountdown(END, at(5 * HOUR + 12 * MINUTE));
    const minutes = eventCountdown(END, at(30 * MINUTE + 20_000));
    expect(days.state === 'running' && days.msUntilChange).toBe(3 * HOUR + 1);
    expect(hours.state === 'running' && hours.msUntilChange).toBe(12 * MINUTE + 1);
    expect(minutes.state === 'running' && minutes.msUntilChange).toBe(20_000 + 1);
  });
});

describe('countdownStat', () => {
  const running = (unit: 'day' | 'hour' | 'minute', value: number) =>
    countdownStat({ state: 'running', unit, value, msUntilChange: 1 });

  it('shows Ended alone, with no label', () => {
    expect(countdownStat({ state: 'ended' })).toEqual({ value: 'Ended', label: null });
  });

  it('uses the singular for one of a unit and the plural otherwise', () => {
    expect(running('day', 29)).toEqual({ value: '29', label: 'Days left' });
    expect(running('day', 1)).toEqual({ value: '1', label: 'Day left' });
    expect(running('hour', 8)).toEqual({ value: '8', label: 'Hours left' });
    expect(running('hour', 1)).toEqual({ value: '1', label: 'Hour left' });
    expect(running('minute', 24)).toEqual({ value: '24', label: 'Mins left' });
    expect(running('minute', 1)).toEqual({ value: '1', label: 'Min left' });
  });
});
