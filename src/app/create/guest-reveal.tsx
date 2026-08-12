import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ExpandingSection } from '@/components/feedback/expanding-section';
import { ToggleRow } from '@/components/forms/toggle-row';
import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';
import {
  ChoiceTile,
  RevealPreview,
} from '@/features/celebrations/creation/reveal-step-shared';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { resolveReveal } from '@/features/celebrations/draft/types';

export default function GuestRevealStep() {
  const { draft, update } = useCreationDraft();
  const [now] = useState(() => Date.now());

  const hostReveal = resolveReveal(draft.hostRevealChoice, draft.endsAt, draft.hostCustomRevealAt);
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
    if (draft.endsAt) {
      return new Date(draft.endsAt);
    }
    return new Date();
  }, [draft.endsAt, draft.hostCustomRevealAt, draft.hostRevealChoice]);

  const getActiveDuration = () => {
    if (!draft.guestCustomRevealAt) return 12;
    const baseMs = getBaseTime().getTime();
    const guestMs = new Date(draft.guestCustomRevealAt).getTime();
    const diffHours = Math.round((guestMs - baseMs) / 3_600_000);
    if ([1, 12, 24].includes(diffHours)) {
      return diffHours as 1 | 12 | 24;
    }
    return 12;
  };

  const activeDuration = getActiveDuration();

  useEffect(() => {
    if (guestDelayEnabled) {
      const nextTime = new Date(getBaseTime().getTime() + activeDuration * 3_600_000).toISOString();
      if (draft.guestCustomRevealAt !== nextTime) {
        update({
          guestRevealChoice: 'custom',
          guestCustomRevealAt: nextTime,
        });
      }
    }
  }, [activeDuration, draft.guestCustomRevealAt, getBaseTime, guestDelayEnabled, update]);

  const handleGuestChoiceChange = (choice: 'same' | 'review' | 'never') => {
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
        guestCustomRevealAt: draft.hostRevealChoice === 'custom' ? draft.hostCustomRevealAt : null,
      });
      return;
    }

    const nextTime = new Date(getBaseTime().getTime() + 12 * 3_600_000).toISOString();
    update({
      guestRevealChoice: 'custom',
      guestCustomRevealAt: nextTime,
    });
  };

  const handleDurationChange = (hours: 1 | 12 | 24) => {
    const nextTime = new Date(getBaseTime().getTime() + hours * 3_600_000).toISOString();
    update({
      guestRevealChoice: 'custom',
      guestCustomRevealAt: nextTime,
    });
  };

  const getUnlockTimeText = () => {
    if (draft.guestRevealChoice === 'never') return 'Guests will not see the photos';
    if (guestReveal.mode === 'instant') return 'Guests will see photos instantly';
    if (!guestReveal.revealAt) return 'Guests will see photos later';

    const revealDate = new Date(guestReveal.revealAt);
    const diffMs = revealDate.getTime() - now;
    if (diffMs <= 0) return 'Guests will see photos shortly';

    const diffHours = Math.ceil(diffMs / 3_600_000);
    if (diffHours < 24) {
      return `Guests will see photos in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }

    const diffDays = Math.ceil(diffHours / 24);
    return `Guests will see photos in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <CreationStepScreen
      step="guest-reveal"
      heading="The Big Reveal for Guests."
      scrollable={false}
    >
      <View style={{ flex: 1, justifyContent: 'space-between', gap: spacing.xl }}>
        <RevealPreview locked={guestReveal.mode !== 'instant'} message={getUnlockTimeText()} />

        <View style={{ gap: spacing.base }}>
          <ExpandingSection expanded={guestDelayEnabled}>
            <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
              <AppText variant="bodySmall" tone="secondary">
                Guests will see them this long after you do.
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <ChoiceTile
                  label="1 hour"
                  selected={activeDuration === 1}
                  onPress={() => handleDurationChange(1)}
                />
                <ChoiceTile
                  label="12 hours"
                  selected={activeDuration === 12}
                  onPress={() => handleDurationChange(12)}
                />
                <ChoiceTile
                  label="24 hours"
                  selected={activeDuration === 24}
                  onPress={() => handleDurationChange(24)}
                />
              </View>
            </View>
          </ExpandingSection>

          <ToggleRow
            label="Let guests view photos taken by others"
            description="Guests can browse the shared gallery when their reveal access allows it."
            value={draft.galleryVisibility === 'all_guests'}
            onValueChange={(allowed) =>
              update({ galleryVisibility: allowed ? 'all_guests' : 'own_only' })
            }
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <ChoiceTile
              label="Never"
              selected={guestRevealSelection === 'never'}
              onPress={() => handleGuestChoiceChange('never')}
            />
            <ChoiceTile
              label="Same time as me"
              selected={guestRevealSelection === 'same'}
              onPress={() => handleGuestChoiceChange('same')}
            />
            <ChoiceTile
              label="After I review them"
              selected={guestRevealSelection === 'review'}
              onPress={() => handleGuestChoiceChange('review')}
            />
          </View>
        </View>
      </View>
    </CreationStepScreen>
  );
}
