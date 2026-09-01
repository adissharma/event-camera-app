import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ExpandingSection } from '@/components/feedback/expanding-section';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { ToggleRow } from '@/components/forms/toggle-row';
import { CalendarIcon, ChevronDownIcon, ClockIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, spacing } from '@/design';
import {
  PickerModal,
  RevealPreview,
  revealSharedStyles,
} from '@/features/celebrations/creation/reveal-step-shared';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { resolveReveal } from '@/features/celebrations/draft/types';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * How far past the event's closing time a custom reveal may be scheduled.
 * Beyond a week the gallery has stopped being news, and a date that distant
 * is far more likely to be a mis-scroll than an intention.
 */
const MAX_REVEAL_DAYS_AFTER_CLOSE = 7;

export default function RevealStep() {
  const { draft, update } = useCreationDraft();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [now] = useState(() => Date.now());

  const hostReveal = resolveReveal(
    draft.hostRevealChoice,
    draft.endsAt,
    draft.hostCustomRevealAt,
  );
  const guestReveal =
    draft.guestRevealChoice === 'never'
      ? { mode: 'manual' as const, revealAt: null }
      : resolveReveal(draft.guestRevealChoice, draft.endsAt, draft.guestCustomRevealAt);
  const guestDelayEnabled =
    draft.guestRevealChoice !== 'never' &&
    (hostReveal.mode !== guestReveal.mode || hostReveal.revealAt !== guestReveal.revealAt);
  const guestRevealSelection =
    draft.guestRevealChoice === 'never'
      ? 'never'
      : draft.guestRevealChoice === 'custom' && guestDelayEnabled
        ? 'review'
        : 'same';

  const getBaseTime = useCallback(() => {
    if (draft.hostRevealChoice === 'custom' && draft.hostCustomRevealAt) {
      return new Date(draft.hostCustomRevealAt);
    }
    if (draft.endsAt) return new Date(draft.endsAt);
    return new Date();
  }, [draft.endsAt, draft.hostCustomRevealAt, draft.hostRevealChoice]);

  const getActiveDuration = () => {
    if (!draft.guestCustomRevealAt) return 12;
    const difference = Math.round(
      (new Date(draft.guestCustomRevealAt).getTime() - getBaseTime().getTime()) / HOUR_MS,
    );
    return [1, 12, 24].includes(difference) ? (difference as 1 | 12 | 24) : 12;
  };
  const activeDuration = getActiveDuration();

  useEffect(() => {
    if (!guestDelayEnabled) return;
    const nextTime = new Date(getBaseTime().getTime() + activeDuration * HOUR_MS).toISOString();
    if (draft.guestCustomRevealAt !== nextTime) {
      update({ guestRevealChoice: 'custom', guestCustomRevealAt: nextTime });
    }
  }, [activeDuration, draft.guestCustomRevealAt, getBaseTime, guestDelayEnabled, update]);

  useEffect(() => {
    if (guestRevealSelection !== 'never' && draft.galleryVisibility === 'hosts_only') {
      update({ galleryVisibility: 'all_guests' });
    }
  }, [draft.galleryVisibility, guestRevealSelection, update]);

  function handleHostChoiceChange(choice: 'during' | 'at_close' | 'custom') {
    let customTime = draft.hostCustomRevealAt;
    if (choice === 'custom' && !customTime) {
      const base = draft.endsAt ? new Date(draft.endsAt).getTime() : Date.now();
      customTime = new Date(base + HOUR_MS).toISOString();
    }

    const syncGuest = draft.guestRevealChoice !== 'never' && !guestDelayEnabled;
    update({
      hostRevealChoice: choice,
      hostCustomRevealAt: choice === 'custom' ? customTime : null,
      guestRevealChoice: syncGuest ? choice : draft.guestRevealChoice,
      guestCustomRevealAt: syncGuest
        ? (choice === 'custom' ? customTime : null)
        : draft.guestCustomRevealAt,
    });
  }

  function getCustomRevealDate() {
    return draft.hostCustomRevealAt ? new Date(draft.hostCustomRevealAt) : new Date();
  }

  /**
   * The window a custom host reveal may sit in.
   *
   * Earliest is now — the picker is where a past time is refused, and the only
   * place it is refused, so that a selection which was valid when made is
   * never re-litigated later (see `hostRevealSchema`). Latest is a week past
   * the event's closing time: a reveal further out than that is far more
   * likely to be a mis-scroll than an intention, and the photographs stop
   * being of interest long before it.
   */
  const revealWindow = useMemo(() => {
    const earliest = new Date();
    const closes = draft.endsAt ? new Date(draft.endsAt) : null;
    const latest =
      closes && Number.isFinite(closes.getTime())
        ? new Date(closes.getTime() + MAX_REVEAL_DAYS_AFTER_CLOSE * DAY_MS)
        : null;

    // A closing time already in the past would otherwise put the ceiling below
    // the floor and leave the picker with no selectable day at all.
    return {
      earliest,
      latest: latest && latest.getTime() > earliest.getTime() ? latest : null,
    };
  }, [draft.endsAt]);

  /** Keeps a composed date/time inside the window rather than rejecting it. */
  function clampToWindow(date: Date): Date {
    const { earliest, latest } = revealWindow;
    if (date.getTime() < earliest.getTime()) return earliest;
    if (latest && date.getTime() > latest.getTime()) return latest;
    return date;
  }

  function updateHostCustomTime(date: Date) {
    const isoString = date.toISOString();
    const syncGuest = draft.guestRevealChoice !== 'never' && !guestDelayEnabled;
    update({
      hostCustomRevealAt: isoString,
      guestCustomRevealAt: syncGuest
        ? isoString
        : new Date(date.getTime() + activeDuration * HOUR_MS).toISOString(),
    });
  }

  function handleDateSelect(date: Date) {
    const current = getCustomRevealDate();
    updateHostCustomTime(clampToWindow(new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      current.getHours(), current.getMinutes(), current.getSeconds(),
    )));
  }

  function handleTimeSelect(time: Date) {
    const current = getCustomRevealDate();
    // Clamped, not rejected: the time wheel has no notion of the date it is
    // being combined with, so spinning to 09:00 on the closing day is the
    // only way a host can land outside the window by accident.
    updateHostCustomTime(clampToWindow(new Date(
      current.getFullYear(), current.getMonth(), current.getDate(),
      time.getHours(), time.getMinutes(), time.getSeconds(),
    )));
  }

  function handleGuestChoiceChange(choice: 'same' | 'review' | 'never') {
    if (choice === 'never') {
      update({
        guestRevealChoice: 'never',
        guestCustomRevealAt: null,
        galleryVisibility: 'hosts_only',
      });
      return;
    }

    if (choice === 'same') {
      update({
        guestRevealChoice: draft.hostRevealChoice,
        guestCustomRevealAt:
          draft.hostRevealChoice === 'custom' ? draft.hostCustomRevealAt : null,
        galleryVisibility:
          draft.galleryVisibility === 'hosts_only' ? 'all_guests' : draft.galleryVisibility,
      });
      return;
    }

    update({
      guestRevealChoice: 'custom',
      guestCustomRevealAt: new Date(getBaseTime().getTime() + 12 * HOUR_MS).toISOString(),
      galleryVisibility:
        draft.galleryVisibility === 'hosts_only' ? 'all_guests' : draft.galleryVisibility,
    });
  }

  function handleDurationChange(hours: 1 | 12 | 24) {
    update({
      guestRevealChoice: 'custom',
      guestCustomRevealAt: new Date(getBaseTime().getTime() + hours * HOUR_MS).toISOString(),
    });
  }

  function formatDate(isoString: string | null) {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleDateString('en-US', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function formatTime(isoString: string | null) {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  function getUnlockTimeText() {
    if (hostReveal.mode === 'instant') return 'Photos will be revealed instantly';
    if (!hostReveal.revealAt) return 'Photos will be revealed when the event closes';

    const revealDate = new Date(hostReveal.revealAt);
    const difference = revealDate.getTime() - now;
    if (difference <= 0) return 'Photos will be revealed shortly';

    const hours = Math.ceil(difference / HOUR_MS);
    if (hours < 24) {
      return `Photos will be revealed in ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    if (draft.hostRevealChoice === 'custom') {
      const day = revealDate.toLocaleDateString(undefined, { weekday: 'long' });
      const time = revealDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return `Photos will be revealed on ${day} at ${time}`;
    }
    const days = Math.ceil(hours / 24);
    return `Photos will be revealed in ${days} day${days > 1 ? 's' : ''}`;
  }

  return (
    <CreationStepScreen
      step="reveal"
      heading="The Big Reveal"
      supporting="Choose when you and your guests can look back at the captured memories."
    >
      <View style={{ gap: spacing.xxl }}>
        <RevealPreview locked={hostReveal.mode !== 'instant'} message={getUnlockTimeText()} />

        <View style={{ gap: spacing.base }}>
          <AppText variant="bodyLarge">When do you want to see new photos?</AppText>
          <SegmentedControl
            accessibilityLabel="When do you want to see new photos?"
            value={draft.hostRevealChoice}
            onChange={handleHostChoiceChange}
            options={[
              { value: 'during', label: 'Immediately' },
              { value: 'at_close', label: 'After event ends' },
              { value: 'custom', label: 'Custom' },
            ]}
          />

          <ExpandingSection expanded={draft.hostRevealChoice === 'custom'}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm }}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Reveal date, ${formatDate(draft.hostCustomRevealAt)}`}
                style={revealSharedStyles.selectorBtn}
              >
                <View style={revealSharedStyles.selectorLeft}>
                  <CalendarIcon size={16} color={colours.textSecondary} />
                  <AppText variant="bodySmall" style={revealSharedStyles.selectorText}>{formatDate(draft.hostCustomRevealAt)}</AppText>
                </View>
                <ChevronDownIcon size={16} color={colours.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => setShowTimePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Reveal time, ${formatTime(draft.hostCustomRevealAt)}`}
                style={revealSharedStyles.selectorBtn}
              >
                <View style={revealSharedStyles.selectorLeft}>
                  <ClockIcon size={16} color={colours.textSecondary} />
                  <AppText variant="bodySmall" style={revealSharedStyles.selectorText}>{formatTime(draft.hostCustomRevealAt)}</AppText>
                </View>
                <ChevronDownIcon size={16} color={colours.textSecondary} />
              </Pressable>
            </View>
          </ExpandingSection>
        </View>

        <View style={{ gap: spacing.base }}>
          <AppText variant="bodyLarge">When should guests see the photos?</AppText>
          <SegmentedControl
            accessibilityLabel="When should guests see the photos?"
            value={guestRevealSelection}
            onChange={handleGuestChoiceChange}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'same', label: 'Same time as me' },
              { value: 'review', label: 'After I review' },
            ]}
          />

          <ExpandingSection expanded={guestDelayEnabled}>
            <View style={{ paddingTop: spacing.sm }}>
              <SegmentedControl
                accessibilityLabel="How long after you do"
                value={activeDuration}
                onChange={handleDurationChange}
                options={[
                  { value: 1, label: '1 hr after me' },
                  { value: 12, label: '12 hrs after me' },
                  { value: 24, label: '24 hrs after me' },
                ]}
              />
            </View>
          </ExpandingSection>

        </View>

        <ExpandingSection expanded={guestRevealSelection !== 'never'}>
          <View style={{ gap: spacing.base }}>
            <AppText variant="bodyLarge">Let guests view photos taken by others</AppText>
            <ToggleRow
              label="Let guests view photos taken by others"
              hideLabel
              description="Guests can browse the shared gallery when their reveal access allows it."
              value={draft.galleryVisibility === 'all_guests'}
              onValueChange={(allowed) =>
                update({ galleryVisibility: allowed ? 'all_guests' : 'own_only' })
              }
            />
          </View>
        </ExpandingSection>
      </View>

      <PickerModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}>
        <DateTimePicker
          value={getCustomRevealDate()}
          mode="date"
          display="spinner"
          themeVariant="dark"
          minimumDate={revealWindow.earliest}
          maximumDate={revealWindow.latest ?? undefined}
          onChange={(_event, date) => { if (date) handleDateSelect(date); }}
        />
      </PickerModal>
      <PickerModal visible={showTimePicker} onClose={() => setShowTimePicker(false)}>
        <DateTimePicker
          value={getCustomRevealDate()}
          mode="time"
          display="spinner"
          themeVariant="dark"
          is24Hour={false}
          onChange={(_event, time) => { if (time) handleTimeSelect(time); }}
        />
      </PickerModal>
    </CreationStepScreen>
  );
}
