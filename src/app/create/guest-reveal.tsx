import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RevealTimingToggle } from '@/components/forms/reveal-timing-toggle';
import { PencilIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, fontFamilies, layout, spacing } from '@/design';
import { GuestRevealDelaySheet } from '@/features/celebrations/creation/guest-reveal-delay-sheet';
import {
  RevealPreview,
  useRevealPreviewHeight,
} from '@/features/celebrations/creation/reveal-step-shared';
import { WORDMARK } from '@/features/onboarding/still-intro';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  resolveGuestReveal,
  deriveGuestRevealFields,
} from '@/features/celebrations/draft/types';
import { copy } from '@/i18n';

const guestRevealDefaultsAppliedDrafts = new Set<string>();

export default function GuestRevealStep() {
  const { draft, update } = useCreationDraft();
  const [sheetOpen, setSheetOpen] = useState(false);
  const previewHeight = useRevealPreviewHeight();
  const isAfterMe = draft.guestRevealChoice !== 'never';

  /**
   * The last delay this host chose for guests.
   *
   * Turning the toggle off clears the delay from the draft, so without this a
   * host flicking it to compare would be asked to pick the delay again every
   * time they turned it back on. `undefined` means "never chosen" — distinct
   * from `0`, which is a real answer meaning "at the same time as you".
   * Seeded from the draft so a half-finished event is remembered too.
   */
  const lastDelayHours = useRef<number | null | undefined>(
    draft.guestRevealChoice === 'never' ? undefined : (draft.guestRevealDelayHours ?? 0),
  );

  const guestReveal = useMemo(() => resolveGuestReveal(draft), [draft]);
  const isLocked = draft.guestRevealChoice === 'never' || guestReveal.mode !== 'instant';

  useEffect(() => {
    if (guestRevealDefaultsAppliedDrafts.has(draft.createdAt)) return;
    guestRevealDefaultsAppliedDrafts.add(draft.createdAt);

    if (draft.guestRevealChoice !== 'never') return;

    update({
      guestRevealChoice: draft.hostRevealChoice,
      guestRevealDelayHours: 0,
      guestCustomRevealAt:
        draft.hostRevealChoice === 'custom' ? draft.hostCustomRevealAt : null,
      galleryVisibility:
        draft.galleryVisibility === 'hosts_only' ? 'all_guests' : draft.galleryVisibility,
    });
  }, [
    draft.createdAt,
    draft.galleryVisibility,
    draft.guestRevealChoice,
    draft.hostCustomRevealAt,
    draft.hostRevealChoice,
    update,
  ]);

  function applyGuestTiming(delayHours: number | null) {
    if (delayHours === null || delayHours === 0) {
      update({
        guestRevealChoice: draft.hostRevealChoice,
        guestRevealDelayHours: 0,
        guestCustomRevealAt:
          draft.hostRevealChoice === 'custom' ? draft.hostCustomRevealAt : null,
        galleryVisibility:
          draft.galleryVisibility === 'hosts_only' ? 'all_guests' : draft.galleryVisibility,
      });
      return;
    }

    const nextGuest = deriveGuestRevealFields({
      ...draft,
      guestRevealChoice: 'custom',
      guestRevealDelayHours: delayHours,
    });

    update({
      guestRevealChoice: 'custom',
      guestRevealDelayHours: delayHours,
      guestCustomRevealAt: nextGuest.guestCustomRevealAt,
      galleryVisibility:
        draft.galleryVisibility === 'hosts_only' ? 'all_guests' : draft.galleryVisibility,
    });
  }

  function handleTimingChange(timing: 'immediately' | 'delayed') {
    if (timing === 'immediately') {
      update({
        guestRevealChoice: 'never',
        guestRevealDelayHours: null,
        guestCustomRevealAt: null,
        galleryVisibility: 'hosts_only',
      });
      return;
    }
    // The toggle asks once. After that it is a switch, and the summary line
    // and its pencil are how a host changes the delay.
    if (lastDelayHours.current !== undefined) {
      applyGuestTiming(lastDelayHours.current);
      return;
    }
    setSheetOpen(true);
  }

  function handleSheetConfirm(delayHours: number | null) {
    setSheetOpen(false);
    lastDelayHours.current = delayHours;
    applyGuestTiming(delayHours);
  }

  function summaryText(): string | null {
    if (!isAfterMe) return null;
    if (draft.guestRevealDelayHours === null || draft.guestRevealDelayHours === 0) {
      return 'when you do';
    }
    if (draft.guestRevealDelayHours === 24) return '1 day after you';
    return `${draft.guestRevealDelayHours} hours after you`;
  }

  return (
    <CreationStepScreen
      step="guest-reveal"
      heading={copy.create.guestRevealHeading}
      headingAlign="center"
      scrollable={false}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          {/*
            With guests never seeing the gallery there is nothing to preview,
            and a locked collage would promise photos that are never coming.
            The wordmark and a thank-you stand in its place — the guest's
            side of this choice is that they contribute and go, so the screen
            shows what they are left with.
          */}
          {isAfterMe ? (
            <RevealPreview locked={isLocked} />
          ) : (
            <View style={[S.neverState, { height: previewHeight }]}>
              <AppText style={S.neverWordmark}>{WORDMARK}</AppText>
              <AppText variant="bodySmall" tone="secondary" align="center">
                Thanks for helping capture the day 🤍
              </AppText>
            </View>
          )}

          <View style={S.summarySlot}>
            {summaryText() ? (
              <View style={S.summaryRow}>
                <AppText variant="bodySmall">Guests see photos </AppText>
                <Pressable
                  onPress={() => setSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit guest reveal timing, currently ${summaryText()}`}
                  hitSlop={10}
                  style={S.summaryValue}
                >
                  <AppText variant="bodySmall" tone="secondary">
                    {summaryText()}
                  </AppText>
                  <PencilIcon size={13} color={colours.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        <RevealTimingToggle
          value={isAfterMe ? 'delayed' : 'immediately'}
          onChange={handleTimingChange}
          onDelayedLabelPress={() => setSheetOpen(true)}
          immediateLabel="Never"
          delayedLabel="Set time"
          accessibilityLabel="Choose when guests can see photos"
        />
      </View>

      <GuestRevealDelaySheet
        visible={sheetOpen}
        initialDelayHours={
          lastDelayHours.current === undefined
            ? draft.guestRevealDelayHours
            : lastDelayHours.current
        }
        onCancel={() => setSheetOpen(false)}
        onConfirm={handleSheetConfirm}
      />
    </CreationStepScreen>
  );
}

const S = StyleSheet.create({
  /**
   * Stands in for the collage, at its height, so the block does not resize
   * when the toggle flips and the centring does not shove the screen around.
   */
  neverState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  neverWordmark: {
    fontFamily: fontFamilies.display,
    color: colours.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  summarySlot: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    minWidth: 34,
    paddingBottom: 2,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderStrong,
  },
});
