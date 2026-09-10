import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/forms/segmented-control';
import { WheelPicker } from '@/components/forms/wheel-picker';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';

export type DelayMode = 'at_close' | 'custom';

/** Minutes between selectable times. */
const TIME_STEP_MINUTES = 15;
const MINUTES_IN_HALF_DAY = 12 * 60;

/**
 * Every 15-minute slot in a half day, as `h:mm` with no meridiem.
 *
 * Twelve hours rather than twenty-four because AM/PM is its own wheel — a
 * host reading "8:30" and "PM" side by side is doing less work than one
 * scrolling past 20:30 in a list of forty-eight.
 */
const TIME_SLOTS: string[] = Array.from(
  { length: MINUTES_IN_HALF_DAY / TIME_STEP_MINUTES },
  (_, index) => {
    const minutes = index * TIME_STEP_MINUTES;
    const hour = Math.floor(minutes / 60);
    return `${hour === 0 ? 12 : hour}:${String(minutes % 60).padStart(2, '0')}`;
  },
);

const MERIDIEMS = ['AM', 'PM'] as const;

/** `10 Thu Sep` — compact enough to be the first of three columns. */
function formatDayOption(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `${date.getDate()} ${weekday} ${month}`;
}

/** Midnight, for comparing days without the time getting in the way. */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * The first valid 15-minute slot at or after `date`.
 *
 * Rounding down would offer a reveal *before* the moment the caller asked
 * about — for an event ending 8:34 pm that would mean revealing at 8:30,
 * four minutes early. Always forwards.
 */
export function ceilToStep(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % TIME_STEP_MINUTES;
  if (remainder !== 0) rounded.setMinutes(rounded.getMinutes() + (TIME_STEP_MINUTES - remainder));
  return rounded;
}

/**
 * Choosing when a delayed reveal happens.
 *
 * Two answers, and only one of them needs a picker: the event's own closing
 * time is already known, so selecting it shows nothing further. The wheels
 * appear only for a genuinely custom moment.
 *
 * The sheet holds its own draft. Nothing is written to the event until
 * `onConfirm`, which is what lets Cancel mean "leave it as it was" whether
 * the host was setting a first delay or editing one they already had.
 */
export function RevealDelaySheet({
  visible,
  eventEndsAt,
  earliest,
  latest,
  initialMode,
  initialCustomAt,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  /** The event's closing time — the default answer, and where custom starts. */
  eventEndsAt: Date | null;
  /** Reveal window, from the same rules the rest of the flow uses. */
  earliest: Date;
  latest: Date | null;
  initialMode: DelayMode;
  initialCustomAt: Date | null;
  onCancel: () => void;
  onConfirm: (mode: DelayMode, revealAt: Date) => void;
}) {
  const [mode, setMode] = useState<DelayMode>(initialMode);
  const [customAt, setCustomAt] = useState<Date>(() => initialCustomAt ?? new Date());

  // Re-seed each time the sheet opens, so reopening to edit shows what was
  // saved rather than whatever the last session left behind.
  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setCustomAt(
      ceilToStep(initialCustomAt ?? eventEndsAt ?? earliest),
    );
  }, [visible, initialMode, initialCustomAt, eventEndsAt, earliest]);

  /**
   * The selectable days.
   *
   * Bounded by the same window the rest of the reveal flow enforces, so the
   * wheel cannot produce a date the validator would refuse — the picker is
   * where an invalid choice is prevented, not where it is reported.
   */
  const days = useMemo(() => {
    const first = startOfDay(earliest);
    const last = startOfDay(latest ?? new Date(earliest.getTime() + 30 * 24 * 60 * 60 * 1000));
    const result: Date[] = [];
    for (
      let day = new Date(first);
      day.getTime() <= last.getTime();
      day.setDate(day.getDate() + 1)
    ) {
      result.push(new Date(day));
    }
    return result;
  }, [earliest, latest]);

  const dayIndex = Math.max(
    0,
    days.findIndex((day) => isSameDay(day, customAt)),
  );

  const hours24 = customAt.getHours();
  const meridiemIndex = hours24 >= 12 ? 1 : 0;
  const minutesIntoHalfDay = (hours24 % 12) * 60 + customAt.getMinutes();
  const timeIndex = Math.max(
    0,
    Math.min(TIME_SLOTS.length - 1, Math.round(minutesIntoHalfDay / TIME_STEP_MINUTES)),
  );

  /** Recomposes the three wheels into one instant, clamped to the window. */
  function setParts(next: { day?: Date; timeIndex?: number; meridiemIndex?: number }) {
    const day = next.day ?? customAt;
    const slot = next.timeIndex ?? timeIndex;
    const meridiem = next.meridiemIndex ?? meridiemIndex;

    const minutes = slot * TIME_STEP_MINUTES;
    let hour = Math.floor(minutes / 60);
    if (meridiem === 1) hour += 12;

    const composed = new Date(day);
    composed.setHours(hour, minutes % 60, 0, 0);

    // Clamped rather than refused: the wheels move independently, so a host
    // can land outside the window by changing one of three values without
    // ever intending to.
    if (composed.getTime() < earliest.getTime()) {
      setCustomAt(ceilToStep(earliest));
      return;
    }
    if (latest && composed.getTime() > latest.getTime()) {
      setCustomAt(latest);
      return;
    }
    setCustomAt(composed);
  }

  function handleConfirm() {
    if (mode === 'at_close') {
      onConfirm('at_close', eventEndsAt ?? customAt);
      return;
    }
    onConfirm('custom', customAt);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      {/* The screen stays visible behind, dimmed — the host is adjusting one
          setting on it, not leaving it. */}
      <Pressable style={S.scrim} onPress={onCancel} accessibilityLabel="Close">
        <View style={S.sheet} onStartShouldSetResponder={() => true}>
          <View style={S.grabber} />

          <AppText variant="titleMedium" align="center" style={S.title}>
            Add a delay
          </AppText>

          <SegmentedControl
            accessibilityLabel="When should photos be revealed?"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'at_close' as DelayMode, label: 'When event ends' },
              { value: 'custom' as DelayMode, label: 'Custom date & time' },
            ]}
          />

          {/* No picker for the closing time: the app already knows it, and a
              wheel showing a value the host cannot usefully change is chrome. */}
          {mode === 'custom' ? (
            <View style={S.wheels}>
              <WheelPicker
                values={days.map(formatDayOption)}
                selectedIndex={dayIndex}
                onChange={(index) => setParts({ day: days[index] })}
                accessibilityLabel="Reveal date"
                width={150}
                fadeColor={colours.surfaceRaised}
              />
              <WheelPicker
                values={TIME_SLOTS}
                selectedIndex={timeIndex}
                onChange={(index) => setParts({ timeIndex: index })}
                accessibilityLabel="Reveal time"
                width={92}
                fadeColor={colours.surfaceRaised}
              />
              <WheelPicker
                values={[...MERIDIEMS]}
                selectedIndex={meridiemIndex}
                onChange={(index) => setParts({ meridiemIndex: index })}
                accessibilityLabel="Morning or afternoon"
                width={68}
                fadeColor={colours.surfaceRaised}
              />
            </View>
          ) : null}

          <View style={S.actions}>
            <View style={S.action}>
              <Button label="Cancel" variant="secondary" onPress={onCancel} />
            </View>
            <View style={S.action}>
              <Button label="Set delay" onPress={handleConfirm} />
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    // Clear of the home indicator.
    paddingBottom: 34,
    gap: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.borderStrong,
  },
  title: {
    marginTop: spacing.xs,
  },
  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
