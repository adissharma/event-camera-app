import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { ProgressThread } from '@/components/feedback/progress-thread';
import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { layout, spacing } from '@/design';
import { copy } from '@/i18n';
import { CREATION_STEPS, type CreationStep } from '../draft/types';
import { useCreationDraft } from '../draft/store';
import { validateStep } from '../draft/validation';

export interface CreationStepScreenProps {
  step: CreationStep;
  heading: string;
  supporting?: string;
  children: ReactNode;
  /** Route to advance to. Defaults to the next step in order. */
  nextHref?: string;
  nextLabel?: string;
  /** Replaces the default Next button entirely (used by review). */
  action?: ReactNode;
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
export function CreationStepScreen({
  step,
  heading,
  supporting,
  children,
  nextHref,
  nextLabel,
  action,
}: CreationStepScreenProps) {
  const router = useRouter();
  const { draft, markStepReached } = useCreationDraft();

  const index = CREATION_STEPS.indexOf(step);
  const total = CREATION_STEPS.length;
  const blockingError = validateStep(step, draft);

  useEffect(() => {
    markStepReached(step);
  }, [step, markStepReached]);

  const resolvedNext =
    nextHref ?? (index < total - 1 ? `/create/${CREATION_STEPS[index + 1]}` : undefined);

  return (
    <Screen
      stickyAction={
        action ?? (
          <View style={{ gap: spacing.sm }}>
            {/* Shown, not only announced. A screen-reader hint alone leaves a
                sighted user staring at a dead button. */}
            {blockingError ? (
              <AppText variant="caption" tone="warning" accessibilityLiveRegion="polite">
                {blockingError}
              </AppText>
            ) : null}
            <Button
              label={nextLabel ?? copy.common.next}
              disabled={blockingError !== null || !resolvedNext}
              disabledReason={blockingError ?? undefined}
              haptic
              onPress={() => {
                if (resolvedNext) router.push(resolvedNext as never);
              }}
            />
          </View>
        )
      }
    >
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.base }}>
          <ProgressThread current={index + 1} total={total} />
          <AppText variant="eyebrow" tone="secondary">
            Step {index + 1} of {total}
          </AppText>
        </View>

        <Reveal index={0} style={{ gap: spacing.md, maxWidth: layout.maxReadableWidth }}>
          <AppText variant="displayLarge">{heading}</AppText>
          {supporting ? (
            <AppText variant="bodyLarge" tone="secondary">
              {supporting}
            </AppText>
          ) : null}
        </Reveal>

        <Reveal index={1}>{children}</Reveal>
      </View>
    </Screen>
  );
}
