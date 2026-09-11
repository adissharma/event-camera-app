import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RevealTimingToggle } from '@/components/forms/reveal-timing-toggle';
import { PencilIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';
import { GuestRevealDelaySheet } from '@/features/celebrations/creation/guest-reveal-delay-sheet';
import { RevealPreview } from '@/features/celebrations/creation/reveal-step-shared';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  resolveGuestReveal,
  deriveGuestRevealFields,
} from '@/features/celebrations/draft/types';
import { copy } from '@/i18n';

export default function GuestRevealStep() {
  const { draft, update } = useCreationDraft();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isAfterMe = draft.guestRevealChoice !== 'never';

  const guestReveal = useMemo(() => resolveGuestReveal(draft), [draft]);
  const isLocked = draft.guestRevealChoice === 'never' || guestReveal.mode !== 'instant';

  function applyGuestTiming(delayHours: number | null) {
    if (delayHours === null) {
      update({
        guestRevealChoice: draft.hostRevealChoice,
        guestRevealDelayHours: null,
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
    setSheetOpen(true);
  }

  function handleSheetConfirm(delayHours: number | null) {
    setSheetOpen(false);
    applyGuestTiming(delayHours);
  }

  function summaryText(): string | null {
    if (!isAfterMe) return null;
    if (draft.guestRevealDelayHours === null) return 'Guests see photos when you do';
    if (draft.guestRevealDelayHours === 24) return 'Guests see photos 1 day after you';
    return `Guests see photos ${draft.guestRevealDelayHours} hours after you`;
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
          <RevealPreview locked={isLocked} />

          <View style={S.summarySlot}>
            {summaryText() ? (
              <Pressable
                onPress={() => setSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`${summaryText()}. Edit guest reveal timing.`}
                hitSlop={10}
                style={S.summaryValue}
              >
                <AppText variant="bodySmall" tone="secondary">
                  {summaryText()}
                </AppText>
                <PencilIcon size={13} color={colours.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <RevealTimingToggle
          value={isAfterMe ? 'delayed' : 'immediately'}
          onChange={handleTimingChange}
          onDelayedLabelPress={() => setSheetOpen(true)}
          immediateLabel="Never"
          delayedLabel="After me"
          accessibilityLabel="Choose when guests can see photos"
        />
      </View>

      <GuestRevealDelaySheet
        visible={sheetOpen}
        initialDelayHours={draft.guestRevealDelayHours}
        onCancel={() => setSheetOpen(false)}
        onConfirm={handleSheetConfirm}
      />
    </CreationStepScreen>
  );
}

const S = StyleSheet.create({
  summarySlot: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
