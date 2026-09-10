import { useEffect, useState, type ReactNode } from 'react';
import { View, Alert, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { ProgressThread } from '@/components/feedback/progress-thread';
import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, easing, layout, spacing } from '@/design';
import { copy } from '@/i18n';
import { CREATION_STEPS, type CreationStep } from '../draft/types';
import { useCreationDraft } from '../draft/store';
import { validateStep } from '../draft/validation';
import { buildEditPatch } from './edit-patch';
import { updateEventSettings, celebrationDetailKeys } from '@/services/celebration-detail';
import { celebrationKeys } from '@/services/celebrations';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
export interface CreationStepScreenProps {
  step: CreationStep;
  heading: string;
  headingAlign?: 'left' | 'center';
  supporting?: string;
  children: ReactNode;
  /** Route to advance to. Defaults to the next step in order. */
  nextHref?: string;
  nextLabel?: string;
  /** Replaces the default Next button entirely (used by review). */
  action?: ReactNode;
  /**
   * Set false when the step contains its own scrolling list.
   */
  scrollable?: boolean;
  /** Custom save operation for edit mode. */
  onSave?: () => Promise<void>;
}

/**
 * Shared chrome for every creation step.
 *
 * Enforces the rules from `docs/form-patterns.md` in one place so no individual
 * step can quietly break them:
 *
 * - one decision per screen, with the heading stating that decision;
 * - the progress thread, continuous across steps;
 * - a sticky action outside the scroll view, so it never scrolls away and never
 *   lands under the keyboard;
 * - when the action is unavailable, the reason is announced AND displayed — a
 *   disabled Next with no explanation is a dead end.
 */
function BackChevronIcon({ size = 18, color = '#A1A1AA' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CreationStepScreen({
  step,
  heading,
  headingAlign = 'left',
  supporting,
  children,
  nextHref,
  nextLabel,
  action,
  scrollable = true,
  onSave,
}: CreationStepScreenProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { draft } = useCreationDraft();
  const { width } = useWindowDimensions();
  const bodyOffset = useSharedValue(Math.min(width * 0.2, 76));

  useEffect(() => {
    bodyOffset.value = withTiming(0, { duration: 320, easing: easing.enter });
  }, [bodyOffset]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bodyOffset.value }],
  }));

  const [saving, setSaving] = useState(false);

  const index = CREATION_STEPS.indexOf(step);
  const total = CREATION_STEPS.length;
  const blockingError = validateStep(step, draft);

  const resolvedNext =
    nextHref ?? (index < total - 1 ? `/create/${CREATION_STEPS[index + 1]}` : undefined);

  const isEditing = Boolean(draft.editCelebrationId);

  async function defaultSave() {
    if (!draft.editCelebrationId || !draft.editSessionId) return;
    await updateEventSettings(
      draft.editCelebrationId,
      draft.editSessionId,
      buildEditPatch(step, draft),
    );
  }

  const handlePress = async () => {
    if (isEditing) {
      setSaving(true);
      try {
        if (onSave) {
          await onSave();
        } else {
          await defaultSave();
        }
        await queryClient.invalidateQueries({
          queryKey: celebrationDetailKeys.detail(draft.editCelebrationId!),
        });
        await queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
        navigation.goBack();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to save changes.');
      } finally {
        setSaving(false);
      }
    } else {
      if (resolvedNext) router.push(resolvedNext as never);
    }
  };

  return (
    <Screen
      scrollable={scrollable}
      contentStyle={scrollable ? undefined : { flex: 1 }}
      stickyActionSeparator={false}
      fixedHeader={
        <View style={styles.fixedHeader}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <BackChevronIcon color={colours.brandPrimary} />
              </Pressable>
            </View>
            <View style={styles.progressCenter}>
              {!isEditing && <ProgressThread current={index + 1} total={total} />}
            </View>
            <View style={styles.headerSide} />
          </View>
        </View>
      }
      stickyAction={
        action ?? (
          <View style={{ gap: spacing.sm }}>
            <Button
              label={isEditing ? 'Save' : (nextLabel ?? copy.common.next)}
              disabled={blockingError !== null}
              disabledReason={blockingError ?? undefined}
              loading={saving}
              haptic
              onPress={handlePress}
            />
          </View>
        )
      }
    >
      <View style={[styles.bodyViewport, scrollable ? null : { flex: 1 }]}>
        <Animated.View
          style={[{ gap: spacing.xl }, scrollable ? null : { flex: 1 }, bodyStyle]}
        >
          <Reveal
            index={0}
            style={{
              gap: spacing.md,
              maxWidth: layout.maxReadableWidth,
              alignSelf: headingAlign === 'center' ? 'center' : undefined,
            }}
          >
            <AppText variant="displayLarge" align={headingAlign}>
              {heading}
            </AppText>
            {supporting ? (
              <AppText variant="bodyLarge" tone="secondary" align={headingAlign}>
                {supporting}
              </AppText>
            ) : null}
          </Reveal>

          <Reveal index={1} style={scrollable ? undefined : { flex: 1 }}>
            {children}
          </Reveal>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  bodyViewport: {
    width: '100%',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerSide: {
    width: 44,
  },
  progressCenter: {
    flex: 1,
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
});
