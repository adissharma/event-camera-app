import {
  buildMonth,
  buildMonths,
  combineDateAndTime,
  formatTime12h,
  isSameDay,
  startOfDay,
} from './month-calendar';

describe('month construction', () => {
  it('places the 1st on the correct weekday, Monday-first', () => {
    // 1 July 2026 is a Wednesday, so it sits in column 3 (Mon, Tue, Wed).
    const july = buildMonth(2026, 6);
    expect(july.weeks[0][0].date).toBeNull();
    expect(july.weeks[0][1].date).toBeNull();
    expect(july.weeks[0][2].date?.getDate()).toBe(1);
  });

  it('handles a month starting on Sunday, the Monday-first edge case', () => {
    // 1 February 2026 is a Sunday: six leading blanks, not zero.
    const february = buildMonth(2026, 1);
    const leading = february.weeks[0].filter((cell) => cell.date === null).length;
    expect(leading).toBe(6);
    expect(february.weeks[0][6].date?.getDate()).toBe(1);
  });

  it('gives February the right number of days in a leap year', () => {
    const count = (year: number) =>
      buildMonth(year, 1).weeks.flat().filter((c) => c.date !== null).length;

    expect(count(2028)).toBe(29); // leap
    expect(count(2026)).toBe(28);
    expect(count(2100)).toBe(28); // divisible by 100, not 400 — not a leap year
  });

  it('always produces exactly six rows', () => {
    // Fixed height is what keeps fast flicking smooth and getItemLayout exact.
    for (let month = 0; month < 12; month += 1) {
      expect(buildMonth(2026, month).weeks).toHaveLength(6);
      expect(buildMonth(2026, month).weeks.every((w) => w.length === 7)).toBe(true);
    }
  });

  it('rolls the year over when building across December', () => {
    const months = buildMonths(new Date(2026, 10, 15), 4);
    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2026, 10],
      [2026, 11],
      [2027, 0],
      [2027, 1],
    ]);
  });

  it('produces unique keys across months', () => {
    const keys = buildMonths(new Date(2026, 0, 1), 12).flatMap((m) =>
      m.weeks.flat().map((c) => c.key),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('combineDateAndTime', () => {
  it('keeps the chosen day and applies the chosen time', () => {
    const result = combineDateAndTime(new Date(2026, 7, 15), 23, 59);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(0);
  });

  it('does not let the 31st roll into the following month', () => {
    // The bug this function exists to prevent: mutating a 31 January date to
    // month 1 gives 3 March, because February has no 31st. Building from
    // components cannot do that.
    const result = combineDateAndTime(new Date(2026, 1, 28), 11, 0);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it('is stable when applied repeatedly', () => {
    const once = combineDateAndTime(new Date(2026, 0, 31), 23, 59);
    const twice = combineDateAndTime(once, 23, 59);
    expect(twice.toISOString()).toBe(once.toISOString());
  });
});

describe('time display', () => {
  it('shows 12-hour time even though the picker is 24-hour', () => {
    expect(formatTime12h(new Date(2026, 0, 1, 23, 59))).toMatch(/11:59\s?pm/);
    expect(formatTime12h(new Date(2026, 0, 1, 0, 5))).toMatch(/12:05\s?am/);
    expect(formatTime12h(new Date(2026, 0, 1, 12, 0))).toMatch(/12:00\s?pm/);
  });
});

describe('day comparison', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(new Date(2026, 5, 3, 1, 0), new Date(2026, 5, 3, 23, 59))).toBe(true);
  });

  it('distinguishes the same date in different months and years', () => {
    expect(isSameDay(new Date(2026, 5, 3), new Date(2026, 6, 3))).toBe(false);
    expect(isSameDay(new Date(2026, 5, 3), new Date(2027, 5, 3))).toBe(false);
  });

  it('treats null as never matching', () => {
    expect(isSameDay(null, new Date())).toBe(false);
    expect(isSameDay(new Date(), null)).toBe(false);
  });

  it('startOfDay zeroes the time without shifting the date', () => {
    const result = startOfDay(new Date(2026, 5, 3, 23, 59, 59));
    expect(result.getDate()).toBe(3);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});
