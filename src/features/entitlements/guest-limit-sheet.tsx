import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import type { PaywallPlan } from '@/features/payments/plan-catalogue';
import {
  eventGuestLimitKeys,
  fetchEventGuestLimit,
  saveEventGuestLimit,
} from '@/services/event-guest-limit';
import { upgradeGains, upgradesForGuestLimit } from './event-entitlements';
import { GuestLimitStepper } from './guest-limit-control';
import { guestCapacityState, hostLimitToSave } from './guest-limit';
import { UpgradeSheet } from './upgrade-sheet';

/** Where the number starts when a host with no limit of their own chooses to set one. */
const DEFAULT_LIMIT = 50;

export interface GuestLimitSheetProps {
  celebrationId: string;
  eventSessionId: string;
  /** The event's package. Without an allowance above, there is nothing to sell. */
  plan: PaywallPlan | null;
  guestsJoined: number;
  onClose: () => void;
}

/**
 * Tapping "Number of Guests" in an event's settings.
 *
 * The package decides which job this has. With no package above it, the host has
 * nothing to buy and this is simply where they choose a number. Below that, more
 * room is the point: the upgrade leads, selling never having to think about the
 * limit, while setting a lower number stays available underneath.
 */
export function GuestLimitSheet(props: GuestLimitSheetProps) {
  return props.plan?.guestLimit === 'unlimited' ? (
    <SetLimitSheet {...props} />
  ) : (
    <UpgradeForGuestsSheet {...props} />
  );
}

/** Saves the host's number, shared by both sheets. */
function useHostGuestLimit(eventSessionId: string, plan: PaywallPlan | null) {
  const queryClient = useQueryClient();
  const queryKey = eventGuestLimitKeys.forSession(eventSessionId);
  const query = useQuery({ queryKey, queryFn: () => fetchEventGuestLimit(eventSessionId) });
  const save = useMutation({
    mutationFn: (value: number | null) =>
      saveEventGuestLimit(eventSessionId, hostLimitToSave(plan, value)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { query, save };
}

function alreadyJoinedNote(joined: number, chosen: number | null): string | null {
  if (joined === 0) return null;
  const guests = joined === 1 ? '1 guest has' : `${joined} guests have`;
  return chosen !== null && chosen <= joined
    ? `${guests} already joined. They keep access, but nobody new can join.`
    : `${guests} joined so far.`;
}

/** The top package: no upgrade to offer, just the host's own number. */
function SetLimitSheet({ eventSessionId, plan, guestsJoined, onClose }: GuestLimitSheetProps) {
  const insets = useSafeAreaInsets();
  const { query, save } = useHostGuestLimit(eventSessionId, plan);
  const [isLimited, setIsLimited] = useState(false);
  const [value, setValue] = useState(DEFAULT_LIMIT);

  const saved = query.data;
  useEffect(() => {
    if (saved === undefined) return;
    setIsLimited(saved !== null);
    if (saved !== null) setValue(saved);
  }, [saved]);

  const chosen = isLimited ? value : null;
  const note = alreadyJoinedNote(guestsJoined, chosen);
  const canSave = query.isSuccess && chosen !== saved && !save.isPending;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={S.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[S.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
          <View style={S.handle} />
          <View style={S.copy}>
            <AppText variant="titleLarge" style={S.title}>
              Number of guests
            </AppText>
            <AppText variant="bodyLarge" style={S.summary}>
              {plan?.displayName} has no guest limit. Set your own if you want to keep this event
              smaller.
            </AppText>
          </View>

          {query.isLoading ? (
            <ActivityIndicator color={colours.textSecondary} />
          ) : query.isError ? (
            <AppText variant="bodySmall" style={S.error}>
              Could not load this event&apos;s guest limit. Please try again shortly.
            </AppText>
          ) : (
            <>
              <View style={S.choices} accessibilityRole="radiogroup">
                <Choice label="No limit" selected={!isLimited} onPress={() => setIsLimited(false)} />
                <Choice label="Set a limit" selected={isLimited} onPress={() => setIsLimited(true)} />
              </View>
              {isLimited ? <GuestLimitStepper value={value} max={null} onChange={setValue} /> : null}
              {note ? (
                <AppText variant="bodySmall" style={S.note}>
                  {note}
                </AppText>
              ) : null}
            </>
          )}

          {save.isError ? (
            <AppText variant="bodySmall" style={S.error}>
              Could not save that. Please try again.
            </AppText>
          ) : null}

          <Button
            label="Save"
            disabled={!canSave}
            loading={save.isPending}
            haptic
            onPress={() => save.mutate(chosen, { onSuccess: onClose })}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[S.choice, selected && S.choiceSelected]}
    >
      <AppText variant="button" style={selected ? S.choiceTextSelected : S.choiceText}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Any lower package: more room is what is on offer. */
function UpgradeForGuestsSheet({
  celebrationId,
  eventSessionId,
  plan,
  guestsJoined,
  onClose,
}: GuestLimitSheetProps) {
  const { query, save } = useHostGuestLimit(eventSessionId, plan);
  const ceiling = typeof plan?.guestLimit === 'number' ? plan.guestLimit : null;

  // Most generous first, and selected: the package that removes the problem for good.
  const options = upgradesForGuestLimit(plan, ceiling === null ? 1 : ceiling + 1).reverse();

  const [isSettingLimit, setIsSettingLimit] = useState(false);
  const [value, setValue] = useState<number | null>(null);
  const [hitCeiling, setHitCeiling] = useState(false);
  const saved = query.data;
  const shown = value ?? saved ?? ceiling ?? DEFAULT_LIMIT;

  const state = ceiling === null ? 'room' : guestCapacityState(guestsJoined, ceiling);
  const remaining = ceiling === null ? 0 : Math.max(ceiling - guestsJoined, 0);
  const summaryFor = (to: PaywallPlan) => {
    const name = plan?.displayName;
    const limitFact =
      state === 'full'
        ? `All ${ceiling} guest places on ${name} are taken.`
        : state === 'nearlyFull'
          ? `${name} stops at ${ceiling} guests, and only ${remaining} ${remaining === 1 ? 'place is' : 'places are'} left.`
          : ceiling !== null
            ? `${name} stops at ${ceiling} guests.`
            : '';
    if (to.guestLimit !== 'unlimited') {
      return `${limitFact} ${to.displayName} takes you to ${to.guestLimit} guests.`.trim();
    }
    const extras = upgradeGains(plan, to).filter((gain) => gain !== 'unlimited guests');
    const andMore =
      extras.length > 0
        ? `, with ${extras.slice(0, -1).join(', ')}${extras.length > 1 ? ' and ' : ''}${extras[extras.length - 1]} too`
        : '';
    return `${limitFact} Go unlimited with ${to.displayName} and invite everyone without counting${andMore}.`.trim();
  };

  return (
    <UpgradeSheet
      visible
      celebrationId={celebrationId}
      currentPlan={plan}
      options={options}
      title="More guests"
      heading="Never worry about guest limits"
      summaryFor={summaryFor}
      onClose={onClose}
      footer={
        ceiling !== null && query.isSuccess ? (
          isSettingLimit ? (
            <View style={S.lowerLimit}>
              <GuestLimitStepper
                value={Math.min(shown, ceiling)}
                max={ceiling}
                onChange={(next) => {
                  setHitCeiling(false);
                  setValue(next);
                }}
                onExceededMax={() => setHitCeiling(true)}
              />
              {hitCeiling ? (
                <AppText variant="bodySmall" style={S.ceilingNudge}>
                  {ceiling} is the most {plan?.displayName} allows. Upgrade above for more.
                </AppText>
              ) : null}
              {save.isError ? (
                <AppText variant="bodySmall" style={S.error}>
                  Could not save that. Please try again.
                </AppText>
              ) : null}
              <Button
                label="Save limit"
                variant="secondary"
                loading={save.isPending}
                onPress={() => save.mutate(Math.min(shown, ceiling), { onSuccess: onClose })}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setIsSettingLimit(true)}
              accessibilityRole="button"
              style={S.lowerLimitLink}
            >
              <AppText variant="bodySmall" style={S.lowerLimitLinkText}>
                {saved !== null && saved !== undefined && saved < ceiling
                  ? `Your limit: ${saved} guests. Change`
                  : 'Or set a lower limit'}
              </AppText>
            </Pressable>
          )
        ) : undefined
      }
    />
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    backgroundColor: '#0D0D0F',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    gap: spacing.base,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  copy: { gap: spacing.sm },
  title: { color: '#FFFFFF' },
  summary: { color: '#9A9A9F', lineHeight: 23 },
  note: { color: '#9A9A9F' },
  error: { color: colours.error },
  choices: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surfaceRaised,
  },
  choiceSelected: { backgroundColor: '#FFFFFF' },
  choiceText: { color: '#FFFFFF' },
  choiceTextSelected: { color: '#0B0B0C' },
  lowerLimit: { gap: spacing.sm },
  lowerLimitLink: { alignSelf: 'center', paddingVertical: spacing.xs },
  lowerLimitLinkText: { color: '#FFFFFF', textDecorationLine: 'underline' },
  ceilingNudge: { color: '#FFFFFF', textAlign: 'center' },
});
