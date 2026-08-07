import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  LockIcon,
} from '@/components/ui/icons';
import { ExpandingSection } from '@/components/feedback/expanding-section';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { resolveReveal } from '@/features/celebrations/draft/types';

/**
 * The Reveal step screen.
 */
export default function RevealStep() {
  const { draft, update } = useCreationDraft();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [now] = useState(() => Date.now());

  const hostDelayEnabled = draft.hostRevealChoice !== 'during';
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

  // Base time helper: Guest delay is always added to this base time
  const getBaseTime = useCallback(() => {
    if (draft.hostRevealChoice === 'custom' && draft.hostCustomRevealAt) {
      return new Date(draft.hostCustomRevealAt);
    }
    if (draft.endsAt) {
      return new Date(draft.endsAt);
    }
    return new Date();
  }, [draft.endsAt, draft.hostCustomRevealAt, draft.hostRevealChoice]);

  // Determine current active duration (1, 12, or 24 hours)
  const getActiveDuration = () => {
    if (!draft.guestCustomRevealAt) return 12; // default to 12 hours
    const baseMs = getBaseTime().getTime();
    const guestMs = new Date(draft.guestCustomRevealAt).getTime();
    const diffHours = Math.round((guestMs - baseMs) / 3600000);
    if ([1, 12, 24].includes(diffHours)) {
      return diffHours as 1 | 12 | 24;
    }
    return 12; // fallback default
  };

  const activeDuration = getActiveDuration();

  // If host reveal settings change, automatically recalculate guest reveal time to preserve the buffer offset
  useEffect(() => {
    if (guestDelayEnabled) {
      const nextTime = new Date(getBaseTime().getTime() + activeDuration * 3600000).toISOString();
      if (draft.guestCustomRevealAt !== nextTime) {
        update({
          guestRevealChoice: 'custom',
          guestCustomRevealAt: nextTime,
        });
      }
    }
  }, [activeDuration, draft.guestCustomRevealAt, getBaseTime, guestDelayEnabled, update]);

  const handleHostChoiceChange = (choice: 'during' | 'at_close' | 'custom') => {
    let nextHostCustomTime = draft.hostCustomRevealAt;
    if (choice === 'custom' && !nextHostCustomTime) {
      const base = draft.endsAt ? new Date(draft.endsAt).getTime() : Date.now();
      nextHostCustomTime = new Date(base + 3600000).toISOString();
    }

    const syncGuest = draft.guestRevealChoice !== 'never' && !guestDelayEnabled;
    const nextGuestChoice = syncGuest ? choice : draft.guestRevealChoice;
    const nextGuestCustomTime = syncGuest
      ? (choice === 'custom' ? nextHostCustomTime : null)
      : draft.guestCustomRevealAt;

    update({
      hostRevealChoice: choice,
      hostCustomRevealAt: choice === 'custom' ? nextHostCustomTime : null,
      guestRevealChoice: nextGuestChoice,
      guestCustomRevealAt: nextGuestCustomTime,
    });
  };

  const getCustomRevealDate = () => {
    return draft.hostCustomRevealAt ? new Date(draft.hostCustomRevealAt) : new Date();
  };

  const handleDateSelect = (date: Date) => {
    const current = getCustomRevealDate();
    const nextDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      current.getHours(),
      current.getMinutes(),
      current.getSeconds()
    );
    updateHostCustomTime(nextDate);
  };

  const handleTimeSelect = (time: Date) => {
    const current = getCustomRevealDate();
    const nextDate = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      time.getHours(),
      time.getMinutes(),
      time.getSeconds()
    );
    updateHostCustomTime(nextDate);
  };

  const updateHostCustomTime = (date: Date) => {
    const isoString = date.toISOString();
    const syncGuest = draft.guestRevealChoice !== 'never' && !guestDelayEnabled;

    let nextGuestTime = draft.guestCustomRevealAt;
    if (syncGuest) {
      nextGuestTime = isoString;
    } else {
      nextGuestTime = new Date(date.getTime() + activeDuration * 3600000).toISOString();
    }

    update({
      hostCustomRevealAt: isoString,
      guestCustomRevealAt: nextGuestTime,
    });
  };

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

    const nextTime = new Date(getBaseTime().getTime() + 12 * 3600000).toISOString();
    update({
      guestRevealChoice: 'custom',
      guestCustomRevealAt: nextTime,
    });
  };

  const handleDurationChange = (hours: number) => {
    const nextTime = new Date(getBaseTime().getTime() + hours * 3600000).toISOString();
    update({
      guestRevealChoice: 'custom',
      guestCustomRevealAt: nextTime,
    });
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
    if (!hostDelayEnabled) return 'Photos will be revealed instantly';

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

    const diffHours = Math.ceil(diffMs / 3600000);

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
      heading="The Big Reveal"
      supporting="Choose when you and your guests can look back at the captured memories."
    >
      <View style={{ gap: spacing.lg }}>
        {/* Visual Preview Card demonstrating 9:16 locked/unlocked photos */}
        <View style={styles.previewContainer}>
          <View style={styles.photoRow}>
            {[
              require('../../../assets/images/placeholders/christian_wedding.png'),
              require('../../../assets/images/placeholders/hindu_wedding.png'),
              require('../../../assets/images/placeholders/treatment_preview_1.png'),
            ].map((imgSrc, i) => (
              <View key={i} style={styles.photoTile}>
                <Image
                  source={imgSrc}
                  style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                  resizeMode="cover"
                  blurRadius={hostDelayEnabled ? 20 : 0}
                />

                {hostDelayEnabled ? (
                  <View style={styles.lockOverlay}>
                    <View style={styles.lockCircle}>
                      <LockIcon size={18} color="#FFFFFF" />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <AppText style={styles.statusText}>{getUnlockTimeText()}</AppText>
        </View>

        <View style={{ gap: spacing.base }}>
          <AppText variant="bodyLarge">
            When do you want to see new photos?
          </AppText>

          <SegmentedControl
            accessibilityLabel="When do you want to see new photos?"
            value={draft.hostRevealChoice}
            onChange={(choice) => handleHostChoiceChange(choice)}
            options={[
              { value: 'during', label: 'Immediately' },
              { value: 'at_close', label: 'After event ends' },
              { value: 'custom', label: 'Custom' },
            ]}
          />

          {/* Only meaningful for a custom time — collapsed away entirely for
              the other two choices rather than sitting there inert. */}
          <ExpandingSection expanded={draft.hostRevealChoice === 'custom'}>
            <View style={styles.customSelectorsContainer}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Reveal date, ${formatDate(draft.hostCustomRevealAt)}`}
                style={styles.selectorBtn}
              >
                <View style={styles.selectorLeft}>
                  <CalendarIcon size={16} color={colours.textSecondary} />
                  <AppText variant="bodySmall" style={styles.selectorText}>
                    {formatDate(draft.hostCustomRevealAt)}
                  </AppText>
                </View>
                <ChevronDownIcon size={16} color={colours.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => setShowTimePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Reveal time, ${formatTime(draft.hostCustomRevealAt)}`}
                style={styles.selectorBtn}
              >
                <View style={styles.selectorLeft}>
                  <ClockIcon size={16} color={colours.textSecondary} />
                  <AppText variant="bodySmall" style={styles.selectorText}>
                    {formatTime(draft.hostCustomRevealAt)}
                  </AppText>
                </View>
                <ChevronDownIcon size={16} color={colours.textSecondary} />
              </Pressable>
            </View>
          </ExpandingSection>

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <AppText variant="bodyLarge">
              When should guests see the photos?
            </AppText>

            <SegmentedControl
              accessibilityLabel="When should guests see the photos?"
              value={guestRevealSelection}
              onChange={(choice) => handleGuestChoiceChange(choice as 'same' | 'review' | 'never')}
              options={[
                { value: 'never', label: 'Never' },
                { value: 'same', label: 'Same time as me' },
                { value: 'review', label: 'After I review them' },
              ]}
            />

            {/* The delay only exists when guests are held back, so it discloses
                on the same curve as the custom date fields above. */}
            <ExpandingSection expanded={guestDelayEnabled}>
              <View style={styles.reviewDelayContainer}>
                <View style={styles.reviewDelayHeader}>
                  <ClockIcon size={14} color={colours.textSecondary} />
                  <AppText variant="bodySmall" tone="secondary">
                    Guests will see them this long after you do.
                  </AppText>
                </View>

                <SegmentedControl
                  accessibilityLabel="How long after you do"
                  value={activeDuration}
                  onChange={handleDurationChange}
                  options={[
                    { value: 1, label: '1 hour' },
                    { value: 12, label: '12 hours' },
                    { value: 24, label: '24 hours' },
                  ]}
                />
              </View>
            </ExpandingSection>
          </View>
        </View>
      </View>

      {/* Date Picker Modal */}
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

      {/* Time Picker Modal */}
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

/** Helper modal to show native-like iOS picker in a bottom sheet */
function PickerModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.modalDoneBtn}>
              <AppText variant="labelLarge" style={styles.modalDoneText}>
                Done
              </AppText>
            </Pressable>
          </View>
          <View style={styles.modalBody}>{children}</View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  customSelectorsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    // Inside the measured wrapper on purpose: as a parent gap it would still
    // occupy space while the section is collapsed to zero height.
    marginTop: spacing.base,
  },
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 48,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectorText: {
    color: colours.textPrimary,
  },
  reviewDelayContainer: {
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  reviewDelayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xxs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.base,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderSubtle,
  },
  modalDoneBtn: {
    paddingHorizontal: spacing.sm,
  },
  modalDoneText: {
    color: colours.brandPrimary,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.base,
    alignItems: 'center',
  },
  previewContainer: {
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoTile: {
    width: 96,
    height: 170,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 5, 6, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: colours.textPrimary,
    letterSpacing: 0.5,
    marginTop: spacing.xxs,
  },
});
