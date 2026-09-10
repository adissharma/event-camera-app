import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RevealTimingToggle } from '@/components/forms/reveal-timing-toggle';
import { PencilIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';
import { copy } from '@/i18n';
import { RevealPreview } from '@/features/celebrations/creation/reveal-step-shared';
import {
  RevealDelaySheet,
  type DelayMode,
} from '@/features/celebrations/creation/reveal-delay-sheet';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { resolveReveal } from '@/features/celebrations/draft/types';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const REVEAL_TIMING_INTRO_DELAY_MS = 500;

/**
 * One-shot, per in-memory creation draft.
 *
 * This is a first-visit cue, not durable product state: resetting the creation
 * journey gives the draft a new `createdAt`, so a new event sees the cue, while
 * Back/Next within the same event does not replay it.
 */
const revealTimingIntroPlayedDrafts = new Set<string>();

/**
 * How far past the event's closing time a custom reveal may be scheduled.
 * Beyond a week the gallery has stopped being news, and a date that distant
 * is far more likely to be a mis-scroll than an intention.
 */
const MAX_REVEAL_DAYS_AFTER_CLOSE = 7;

export default function RevealStep() {
  const { draft, update } = useCreationDraft();
  const [delaySheetOpen, setDelaySheetOpen] = useState(false);
  const introCueStarted = useRef(false);

  /**
   * The last delay this host actually chose.
   *
   * Toggling to Immediately clears the reveal time from the draft, so without
   * this a host flicking the toggle to look at the difference would be asked
   * to configure the delay again from scratch every time they came back. Seeded
   * from the draft so a restored half-finished event is remembered too.
   */
  const lastDelay = useRef<{ mode: DelayMode; at: string | null } | null>(
    draft.hostRevealChoice === 'during'
      ? null
      : {
          mode: draft.hostRevealChoice === 'custom' ? 'custom' : 'at_close',
          at: draft.hostCustomRevealAt,
        },
  );
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


  const isDelayed = draft.hostRevealChoice !== 'during';

  /**
   * The toggle asks once.
   *
   * With no delay chosen yet it only *proposes* one: the sheet opens and
   * nothing else changes, so cancelling leaves the event exactly as it was.
   * Once a delay exists, the toggle is just a switch — flicking it back on
   * restores what was chosen rather than reopening the sheet. The summary
   * line and its pencil are how a host changes their mind.
   */
  function handleTimingChange(timing: 'immediately' | 'delayed') {
    if (timing === 'immediately') {
      handleHostChoiceChange('during');
      return;
    }

    const remembered = lastDelay.current;
    if (!remembered) {
      setDelaySheetOpen(true);
      return;
    }

    applyDelay(remembered.mode, remembered.at ? new Date(remembered.at) : null);
  }

  /** Writes a delay to the draft. The one place both paths go through. */
  function applyDelay(mode: DelayMode, revealAt: Date | null) {
    if (mode === 'at_close') {
      handleHostChoiceChange('at_close');
      return;
    }
    handleHostChoiceChange('custom');
    if (revealAt) updateHostCustomTime(clampToWindow(revealAt));
  }

  const handleHostChoiceChangeRef = useRef(handleHostChoiceChange);
  const applyDelayRef = useRef(applyDelay);

  useEffect(() => {
    handleHostChoiceChangeRef.current = handleHostChoiceChange;
    applyDelayRef.current = applyDelay;
  });

  useEffect(() => {
    if (introCueStarted.current) return;
    if (draft.editCelebrationId) return;
    if (revealTimingIntroPlayedDrafts.has(draft.createdAt)) return;

    introCueStarted.current = true;
    revealTimingIntroPlayedDrafts.add(draft.createdAt);

    const rememberedDelay = lastDelay.current;
    handleHostChoiceChangeRef.current('during');

    const timer = setTimeout(() => {
      applyDelayRef.current(
        rememberedDelay?.mode ?? 'at_close',
        rememberedDelay?.at ? new Date(rememberedDelay.at) : null,
      );
    }, REVEAL_TIMING_INTRO_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft.createdAt, draft.editCelebrationId]);

  function handleDelayCancel() {
    setDelaySheetOpen(false);
    // Only fall back to immediate if there was no delay to return to.
    if (!isDelayed) handleHostChoiceChange('during');
  }

  function handleDelayConfirm(mode: DelayMode, revealAt: Date) {
    setDelaySheetOpen(false);
    lastDelay.current = {
      mode,
      at: mode === 'custom' ? clampToWindow(revealAt).toISOString() : null,
    };
    applyDelay(mode, revealAt);
  }

  /**
   * The editable half of the summary: `when event ends`, `12 Sep · 8:30 PM`.
   *
   * Split from the word "Reveals" because only this part is the choice. The
   * underline marks what can be changed, and running it under the verb would
   * offer to edit a word that is never anything else.
   */
  function delayValue(): string {
    const at = draft.hostCustomRevealAt ? new Date(draft.hostCustomRevealAt) : null;
    if (draft.hostRevealChoice === 'at_close' || !at) return 'when event ends';
    const day = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const time = at
      .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toUpperCase();
    return `${day} · ${time}`;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Retained for the guest settings screen.
   *
   * The controls that called these have moved off this step, which now asks
   * one question: now, or later. Everything below is the working
   * implementation behind the options that went with them — composing a
   * custom reveal date and time, clamping it into the allowed window, the
   * guest-side choices, and the display formatters.
   *
   * Kept rather than deleted because the next screen needs exactly this, and
   * because the draft fields they write are still read, resolved and
   * validated everywhere downstream: an event created before this change
   * behaves the same as it did. Move them out when that screen lands; delete
   * them only if those options are dropped for good.
   * ──────────────────────────────────────────────────────────────────────── */

  /* eslint-disable @typescript-eslint/no-unused-vars */
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

  /*
   * Guest-side reveal handlers, with no control attached to them.
   *
   * The screen now offers one choice — now, or later — and guests follow the
   * host through the sync in `handleHostChoiceChange`. These two are kept
   * rather than deleted because they are the only implementation of the guest
   * options the old control exposed: "never", "after I review", and the
   * 1/12/24-hour delay. The draft fields they write are still read, still
   * validated and still honoured downstream, so a guest event created before
   * this change behaves exactly as it did.
   *
   * Delete them only once it is decided that those options are gone for good
   * rather than homeless.
   */
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
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return (
    <CreationStepScreen
      step="reveal"
      heading={copy.create.revealHeading}
      headingAlign="center"
      // Not scrollable: there is a collage and one control, and the control is
      // positioned by the space left over. Inside a scroll view `flex: 1`
      // measures the content rather than the screen, so the toggle would stay
      // pinned under the collage with the empty space all below it.
      scrollable={false}
    >
      {/* Collage and control as one block, centred in the space between the
          heading and the CTA — they are a single thought, and spreading them
          to the edges made them read as two unrelated things. */}
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <RevealPreview locked={hostReveal.mode !== 'instant'} />

          {/*
            What was chosen, sitting with the photos it describes rather than
            under the control that set it — it says when *these* are revealed.
            A line of text, not a row or a card: it is a receipt, not another
            control.

            The slot is always here, whether or not there is a delay to
            report. Rendering it conditionally changed the block's height,
            which the centring then corrected by lifting everything — the
            collage jumped and its fades tore as it moved.
          */}
          <View style={S.summarySlot}>
            {isDelayed ? (
              <View style={S.summaryRow}>
                <AppText variant="bodySmall">
                  Reveals{' '}
                </AppText>
                <Pressable
                  onPress={() => setDelaySheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit reveal time, currently ${delayValue()}`}
                  hitSlop={10}
                  style={S.summaryValue}
                >
                  <AppText variant="bodySmall" tone="secondary">
                    {delayValue()}
                  </AppText>
                  <PencilIcon size={13} color={colours.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {/*
          One choice: now, or later.
          `during` and `custom` are the two ends of the existing reveal model
          — `at_close` is still a valid stored value and still honoured
          everywhere downstream, it simply is not offered here any more.
          Guests stay in step with the host through `handleHostChoiceChange`'s
          existing sync, which is what the removed guest control was mostly
          used to keep aligned anyway.
        */}
        <RevealTimingToggle
          value={isDelayed ? 'delayed' : 'immediately'}
          onChange={handleTimingChange}
          onDelayedLabelPress={() => setDelaySheetOpen(true)}
        />
      </View>

      <RevealDelaySheet
        visible={delaySheetOpen}
        eventEndsAt={draft.endsAt ? new Date(draft.endsAt) : null}
        earliest={revealWindow.earliest}
        latest={revealWindow.latest}
        // Defaults to the event's own closing time. Only a delay that was
        // actually saved as a custom moment opens on the wheels.
        initialMode={lastDelay.current?.mode ?? 'at_close'}
        initialCustomAt={
          lastDelay.current?.at ? new Date(lastDelay.current.at) : null
        }
        onCancel={handleDelayCancel}
        onConfirm={handleDelayConfirm}
      />
    </CreationStepScreen>
  );
}

const S = StyleSheet.create({
  /** Reserved whether or not a delay is set, so the block never resizes. */
  summarySlot: {
    height: 20,
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  /** Matched to the event-name suggestion blank: muted and underlined. */
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 34,
    paddingBottom: 2,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderStrong,
  },
});
