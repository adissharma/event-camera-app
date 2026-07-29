import { LOCALE_CONFIG } from '@/config/app-config';

/**
 * Calendar maths, kept out of the component so it is testable without
 * rendering. Dates are the single most common source of quiet off-by-one bugs,
 * and "the event closed a day early" is not a bug anyone forgives.
 */

export interface CalendarDay {
  /** Local date at midnight. `null` is a leading blank before the 1st. */
  date: Date | null;
  key: string;
}

export interface CalendarMonth {
  year: number;
  /** 0-indexed, as `Date` uses. */
  month: number;
  label: string;
  /** Always 6 rows × 7 columns, so month heights never jump while scrolling. */
  weeks: CalendarDay[][];
}

/** Monday-first, matching the British convention. */
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday = 0 … Sunday = 6. `Date.getDay()` is Sunday-first, which is not ours. */
function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function buildMonth(year: number, month: number): CalendarMonth {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = mondayFirstIndex(first);

  const cells: CalendarDay[] = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push({ date: null, key: `${year}-${month}-blank-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), key: `${year}-${month}-${day}` });
  }
  // Pad to a fixed 42 cells. A variable month height makes fast flicking feel
  // uneven, because rows shift as each month enters the viewport.
  while (cells.length < 42) {
    cells.push({ date: null, key: `${year}-${month}-trail-${cells.length}` });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return {
    year,
    month,
    label: new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
      month: 'long',
      year: 'numeric',
    }).format(first),
    weeks,
  };
}

/** `count` consecutive months starting from the month containing `from`. */
export function buildMonths(from: Date, count: number): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  for (let i = 0; i < count; i += 1) {
    const cursor = new Date(from.getFullYear(), from.getMonth() + i, 1);
    months.push(buildMonth(cursor.getFullYear(), cursor.getMonth()));
  }
  return months;
}

/**
 * Combines a chosen day with a chosen time.
 *
 * Built from components rather than by mutating a copy: reusing the previous
 * date object carries its day-of-month across a month change, which is how
 * "31 January" silently becomes "3 March" when the month is switched to
 * February.
 */
export function combineDateAndTime(day: Date, hours: number, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
}

/** 24-hour internally, 12-hour for display. */
export function formatTime12h(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .toLowerCase()
    .replace(/\s/g, ' ');
}

export function formatSelectedDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** The default closing time: 11:59 pm, the end of the day. */
export const DEFAULT_CLOSING_HOURS = 23;
export const DEFAULT_CLOSING_MINUTES = 59;
