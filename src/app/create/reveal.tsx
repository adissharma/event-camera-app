import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ExpandingSection } from '@/components/feedback/expanding-section';
import { Button } from '@/components/ui/button';
import { CalendarIcon, ChevronDownIcon, ClockIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, spacing } from '@/design';
import {
  ChoiceTile,
  PickerModal,
  RevealPreview,
  revealSharedStyles,
} from '@/features/celebrations/creation/reveal-step-shared';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { validateStep } from '@/features/celebrations/draft/validation';

export default function RevealStep() {
  const router = useRouter();
  const { draft, update } = useCreationDraft();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [now] = useState(() => Date.now());

  const isEditing = Boolean(draft.editCelebrationId);
  const blockingError = validateStep('reveal', draft);
  const revealLocked = draft.hostRevealChoice !== 'during';

  const handleChoiceChange = (choice: 'during' | 'at_close' | 'custom') => {
    let nextHostCustomTime = draft.hostCustomRevealAt;
    if (choice === 'custom' && !nextHostCustomTime) {
      const base = draft.endsAt ? new Date(draft.endsAt).getTime() : Date.now();
      nextHostCustomTime = new Date(base + 3_600_000).toISOString();
    }

    const syncGuest = draft.guestRevealChoice !== 'never' && draft.guestRevealChoice === draft.hostRevealChoice;
    update({
      hostRevealChoice: choice,
      hostCustomRevealAt: choice === 'custom' ? nextHostCustomTime : null,
      guestRevealChoice: syncGuest ? choice : draft.guestRevealChoice,
      guestCustomRevealAt: syncGuest ? (choice === 'custom' ? nextHostCustomTime : null) : draft.guestCustomRevealAt,
    });
  };

  const getCustomRevealDate = () => {
    return draft.hostCustomRevealAt ? new Date(draft.hostCustomRevealAt) : new Date();
  };

  const updateHostCustomTime = (date: Date) => {
    const isoString = date.toISOString();
    const syncGuest = draft.guestRevealChoice !== 'never' && draft.guestRevealChoice === draft.hostRevealChoice;

    update({
      hostCustomRevealAt: isoString,
      guestCustomRevealAt: syncGuest ? isoString : draft.guestCustomRevealAt,
    });
  };

  const handleDateSelect = (date: Date) => {
    const current = getCustomRevealDate();
    updateHostCustomTime(
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        current.getHours(),
        current.getMinutes(),
        current.getSeconds(),
      ),
    );
  };

  const handleTimeSelect = (time: Date) => {
    const current = getCustomRevealDate();
    updateHostCustomTime(
      new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        time.getHours(),
        time.getMinutes(),
        time.getSeconds(),
      ),
    );
  };

  const formatDate = (isoString: string | null) => {
    const d = isoString ? new Date(isoString) : new Date();
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (isoString: string | null) => {
    const d = isoString ? new Date(isoString) : new Date();
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getUnlockTimeText = () => {
    if (!revealLocked) return 'Photos will be revealed instantly';

    let revealDateStr = draft.hostCustomRevealAt;
    if (draft.hostRevealChoice === 'at_close') {
      revealDateStr = draft.endsAt;
    }

    if (!revealDateStr) {
      return 'Photos will be revealed when the event closes';
    }

    const revealDate = new Date(revealDateStr);
    const diffMs = revealDate.getTime() - now;

    if (diffMs <= 0) {
      return 'Photos will be revealed shortly';
    }

    const diffHours = Math.ceil(diffMs / 3_600_000);
    if (diffHours < 24) {
      return `Photos will be revealed in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }

    if (draft.hostRevealChoice === 'custom') {
      const dayName = revealDate.toLocaleDateString(undefined, { weekday: 'long' });
      const timeStr = revealDate.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `Photos will be revealed on ${dayName} at ${timeStr}`;
    }

    const diffDays = Math.ceil(diffHours / 24);
    return `Photos will be revealed in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <CreationStepScreen
      step="reveal"
      heading="The Big Reveal for You."
      scrollable={false}
      action={
        isEditing ? (
          <View style={{ gap: spacing.sm }}>
            {blockingError ? (
              <AppText variant="caption" tone="warning" accessibilityLiveRegion="polite">
                {blockingError}
              </AppText>
            ) : null}
            <Button
              label="Next"
              disabled={blockingError !== null}
              disabledReason={blockingError ?? undefined}
              onPress={() => router.push('/create/guest-reveal')}
            />
          </View>
        ) : undefined
      }
    >
      <View style={{ flex: 1, justifyContent: 'space-between', gap: spacing.xl }}>
        <RevealPreview locked={revealLocked} message={getUnlockTimeText()} />

        <View style={{ gap: spacing.base }}>
          <ExpandingSection expanded={draft.hostRevealChoice === 'custom'}>
            <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Reveal date, ${formatDate(draft.hostCustomRevealAt)}`}
                  style={revealSharedStyles.selectorBtn}
                >
                  <View style={revealSharedStyles.selectorLeft}>
                    <CalendarIcon size={16} color={colours.textSecondary} />
                    <AppText variant="bodySmall" style={revealSharedStyles.selectorText}>
                      {formatDate(draft.hostCustomRevealAt)}
                    </AppText>
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
                    <AppText variant="bodySmall" style={revealSharedStyles.selectorText}>
                      {formatTime(draft.hostCustomRevealAt)}
                    </AppText>
                  </View>
                  <ChevronDownIcon size={16} color={colours.textSecondary} />
                </Pressable>
              </View>
            </View>
          </ExpandingSection>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <ChoiceTile
              label="Immediately"
              selected={draft.hostRevealChoice === 'during'}
              onPress={() => handleChoiceChange('during')}
            />
            <ChoiceTile
              label="After event ends"
              selected={draft.hostRevealChoice === 'at_close'}
              onPress={() => handleChoiceChange('at_close')}
            />
            <ChoiceTile
              label="Custom"
              selected={draft.hostRevealChoice === 'custom'}
              onPress={() => handleChoiceChange('custom')}
            />
          </View>
        </View>
      </View>

      <PickerModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}>
        <DateTimePicker
          value={getCustomRevealDate()}
          mode="date"
          display="spinner"
          themeVariant="dark"
          minimumDate={new Date()}
          onChange={(_event, date) => {
            if (date) {
              handleDateSelect(date);
            }
          }}
        />
      </PickerModal>

      <PickerModal visible={showTimePicker} onClose={() => setShowTimePicker(false)}>
        <DateTimePicker
          value={getCustomRevealDate()}
          mode="time"
          display="spinner"
          themeVariant="dark"
          is24Hour={false}
          onChange={(_event, time) => {
            if (time) {
              handleTimeSelect(time);
            }
          }}
        />
      </PickerModal>
    </CreationStepScreen>
  );
}
