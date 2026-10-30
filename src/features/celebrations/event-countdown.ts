import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { copy } from '@/i18n';

/** Time remaining or elapsed, floored to whole days, hours, or minutes. */
export type EventCountdown =
  | { state: 'open' }
  | {
      state: 'running' | 'ended';
      unit: 'day' | 'hour' | 'minute';
      value: number;
      /** Milliseconds until `value` or `unit` next changes. */
      msUntilChange: number;
    };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function eventCountdown(
  endsAt: string | null | undefined,
  now: number,
): EventCountdown {
  if (!endsAt) return { state: 'open' };
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return { state: 'open' };

  const remaining = end - now;
  if (remaining <= 0) {
    const elapsed = now - end;
    const unitMs = elapsed >= DAY_MS ? DAY_MS : elapsed >= HOUR_MS ? HOUR_MS : MINUTE_MS;
    return {
      state: 'ended',
      unit: unitMs === DAY_MS ? 'day' : unitMs === HOUR_MS ? 'hour' : 'minute',
      value: Math.floor(elapsed / unitMs),
      msUntilChange: unitMs - (elapsed % unitMs),
    };
  }

  const unitMs = remaining >= DAY_MS ? DAY_MS : remaining >= HOUR_MS ? HOUR_MS : MINUTE_MS;
  const unit = unitMs === DAY_MS ? 'day' : unitMs === HOUR_MS ? 'hour' : 'minute';

  return {
    state: 'running',
    unit,
    value: Math.max(1, Math.floor(remaining / unitMs)),
    // The floored value drops as soon as `remaining` falls below the multiple
    // of the unit it is sitting on; one millisecond past that is the first
    // instant the display is different. In the final minute the next change
    // is the switch to `ended`, which happens at the end time itself.
    msUntilChange: remaining < MINUTE_MS ? remaining : (remaining % unitMs) + 1,
  };
}

/** A stat column: a figure, and the word under it when it needs one. */
export type EventStat = { value: string; label: string | null };

/**
 * The third column, from the countdown.
 *
 * "Soon" stands alone when no end time is set.
 */
export function countdownStat(countdown: EventCountdown): EventStat {
  switch (countdown.state) {
    case 'open':
      return { value: copy.eventPage.open, label: null };
    case 'ended': {
      const one = countdown.value === 1;
      const label =
        countdown.unit === 'day'
          ? one ? copy.eventPage.dayAgo : copy.eventPage.daysAgo
          : countdown.unit === 'hour'
            ? one ? copy.eventPage.hourAgo : copy.eventPage.hoursAgo
            : one ? copy.eventPage.minAgo : copy.eventPage.minsAgo;
      return { value: String(countdown.value), label };
    }
    case 'running': {
      const one = countdown.value === 1;
      const label =
        countdown.unit === 'day'
          ? one ? copy.eventPage.dayLeft : copy.eventPage.daysLeft
          : countdown.unit === 'hour'
            ? one ? copy.eventPage.hourLeft : copy.eventPage.hoursLeft
            : one ? copy.eventPage.minLeft : copy.eventPage.minsLeft;
      return { value: String(countdown.value), label };
    }
  }
}

/**
 * `eventCountdown`, kept current while the screen is mounted.
 *
 * Rather than polling, this schedules one timeout for the exact moment the
 * displayed figure changes: once a day while days are showing, once an hour
 * in the final day, once a minute in the final hour. JS timers do not run
 * while the app is suspended, so coming back to the foreground recomputes
 * too, and so does a change to the end time itself — a host extending the
 * event should not see the old figure until the next scheduled tick.
 */
export function useEventCountdown(endsAt: string | null | undefined): EventCountdown {
  const [now, setNow] = useState(() => Date.now());
  const countdown = eventCountdown(endsAt, now);
  const delay = countdown.state === 'open' ? null : countdown.msUntilChange;

  useEffect(() => {
    setNow(Date.now());
  }, [endsAt]);

  useEffect(() => {
    if (delay === null) return;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [delay, now]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  return countdown;
}
