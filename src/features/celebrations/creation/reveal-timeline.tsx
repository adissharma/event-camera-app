import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

import { CelebrationIcon, ClockIcon, EyeIcon, PeopleIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, MOMENTS_SLIDER_GRADIENT, spacing } from '@/design';
import { resolveGuestReveal, resolveReveal, type CreationDraft } from '../draft/types';

/**
 * When the photos open, told as a short story down the page.
 *
 * Built from what the host has already chosen. When everyone sees the photos
 * at the same moment, a dotted line runs from the party into one point that
 * says so, and a faint "ghost" step beneath it shows that guests could be made
 * to wait. When guests wait, each moment gets its own stop, and the line
 * between them is longer the longer the wait, with how long written beside it.
 *
 * Shown in place of the locked photo collage where there is room for it.
 * "guests" is a link, the same as the summary line it replaces: it opens the
 * choice of when they see them.
 */

const HOUR = 3_600_000;
const BUBBLE = 40;
/** Line between two stops: a short hop, longer for a longer wait. */
const MIN_GAP = 22;
const MAX_EXTRA_GAP = 56;

function when(at: number): string {
  return format(new Date(at), "EEE d MMM 'at' h:mm a");
}

function waitLabel(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) return hours === 24 ? '1 day later' : `${hours / 24} days later`;
  return hours === 1 ? '1 hour later' : `${hours} hours later`;
}

function gapFor(hours: number): number {
  return MIN_GAP + (Math.min(Math.max(hours, 0), 48) / 48) * MAX_EXTRA_GAP;
}

export function RevealTimeline({
  draft,
  onEditGuests,
}: {
  draft: CreationDraft;
  onEditGuests: () => void;
}) {
  const endsAt = draft.endsAt ? new Date(draft.endsAt).getTime() : Date.now();
  const host = resolveReveal(draft.hostRevealChoice, draft.endsAt, draft.hostCustomRevealAt);
  const guest = resolveGuestReveal(draft);
  const live = host.mode === 'instant';
  const hostAt = live ? null : host.revealAt ? new Date(host.revealAt).getTime() : endsAt;
  const guestAt = guest.mode === 'instant' ? null : guest.revealAt ? new Date(guest.revealAt).getTime() : hostAt;
  const together = guestAt === hostAt;

  // Everyone at once: one point says it all, with a ghost of what else could be.
  if (together && (live || hostAt === endsAt)) {
    return (
      <View style={S.root}>
        <Stop
          icon={<CelebrationIcon size={18} color={colours.textOnBrand} />}
          title={live ? 'Photos appear as they’re taken' : 'The party wraps up'}
          detail={live ? 'From the first shot of the night' : when(endsAt)}
          line="dotted"
        />
        <Stop
          icon={<EyeIcon size={18} color={colours.textOnBrand} />}
          title={
            <>
              You and <GuestsLink onPress={onEditGuests}>guests</GuestsLink>
              {live ? ' see every photo, live' : ' see every photo, together'}
            </>
          }
          detail={live ? 'No waiting, no secrets' : 'The whole album opens at once'}
          line="ghost"
          highlight
        />
        <Ghost title="Keep guests waiting a little longer?" action="Add a delay" onPress={onEditGuests} />
      </View>
    );
  }

  const hostWait = hostAt !== null ? Math.round((hostAt - endsAt) / HOUR) : 0;
  const guestFrom = hostAt ?? endsAt;
  const guestWait = guestAt !== null ? Math.round((guestAt - guestFrom) / HOUR) : 0;

  return (
    <View style={S.root}>
      {live ? (
        <Stop
          icon={<EyeIcon size={18} color={colours.textOnBrand} />}
          title="You see photos as they’re taken"
          detail="Live, all night"
          line="dotted"
        />
      ) : null}
      <Stop
        icon={<CelebrationIcon size={18} color={colours.textOnBrand} />}
        title="The party wraps up"
        detail={when(endsAt)}
        line={(live ? guestWait : hostWait) > 0 ? 'solid' : 'dotted'}
        gap={gapFor(live ? guestWait : hostWait)}
        wait={live ? (guestWait > 0 ? waitLabel(guestWait) : undefined) : hostWait > 0 ? waitLabel(hostWait) : undefined}
      />
      {!live && hostAt !== null ? (
        <Stop
          icon={<EyeIcon size={18} color={colours.textOnBrand} />}
          title="Your photos are revealed"
          detail={hostWait > 0 ? when(hostAt) : 'As soon as it ends'}
          line={guestAt !== null ? 'solid' : undefined}
          gap={gapFor(guestWait)}
          wait={guestWait > 0 ? waitLabel(guestWait) : undefined}
        />
      ) : null}
      {guestAt !== null ? (
        <Stop
          icon={<PeopleIcon size={18} color={colours.textOnBrand} />}
          title={
            <>
              <GuestsLink onPress={onEditGuests}>Guests</GuestsLink> see every photo
            </>
          }
          detail={when(guestAt)}
          highlight
        />
      ) : null}
    </View>
  );
}

function Stop({
  icon,
  title,
  detail,
  line,
  gap = MIN_GAP,
  wait,
  highlight = false,
}: {
  icon: ReactNode;
  title: ReactNode;
  detail: string;
  /** The line beneath this stop, if any. */
  line?: 'solid' | 'dotted' | 'ghost';
  gap?: number;
  /** How long until the next stop, written beside the line. */
  wait?: string;
  highlight?: boolean;
}) {
  return (
    <View style={S.stop}>
      <View style={S.rail}>
        <LinearGradient
          colors={
            highlight
              ? [MOMENTS_SLIDER_GRADIENT[1], MOMENTS_SLIDER_GRADIENT[3]]
              : [colours.textPrimary, colours.textPrimary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.bubble}
        >
          {icon}
        </LinearGradient>
        {line ? (
          <View
            style={[
              S.line,
              { height: gap + spacing.lg },
              line === 'solid' ? S.lineSolid : line === 'dotted' ? S.lineDotted : S.lineGhost,
            ]}
          />
        ) : null}
      </View>
      <View style={S.text}>
        <AppText variant="labelLarge" style={S.title}>
          {title}
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          {detail}
        </AppText>
        {wait ? (
          <View style={[S.wait, { marginTop: Math.max(spacing.sm, gap / 2 - 4) }]}>
            <ClockIcon size={12} color={colours.textSecondary} />
            <AppText variant="caption" tone="secondary">
              {wait}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Ghost({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title} ${action}`} style={S.stop}>
      <View style={S.rail}>
        <View style={S.ghostBubble}>
          <PeopleIcon size={16} color={colours.textSecondary} />
        </View>
      </View>
      <View style={S.text}>
        <AppText variant="bodySmall" tone="secondary">
          {title}
        </AppText>
        <Text style={S.link}>{action}</Text>
      </View>
    </Pressable>
  );
}

function GuestsLink({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Text onPress={onPress} accessibilityRole="link" accessibilityHint="Choose when guests see the photos" style={S.link}>
      {children}
    </Text>
  );
}

const S = StyleSheet.create({
  root: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    paddingVertical: spacing.md,
  },
  stop: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  rail: {
    width: BUBBLE,
    alignItems: 'center',
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 0,
    marginVertical: 4,
    borderLeftWidth: 2,
  },
  lineSolid: {
    borderColor: 'rgba(245, 242, 237, 0.6)',
    borderStyle: 'solid',
  },
  lineDotted: {
    borderColor: 'rgba(245, 242, 237, 0.6)',
    borderStyle: 'dotted',
  },
  lineGhost: {
    borderColor: 'rgba(245, 242, 237, 0.22)',
    borderStyle: 'dashed',
  },
  text: {
    flex: 1,
    paddingTop: 2,
    gap: 2,
  },
  title: {
    lineHeight: 22,
  },
  wait: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 242, 237, 0.08)',
  },
  ghostBubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(245, 242, 237, 0.3)',
  },
  link: {
    color: colours.textPrimary,
    textDecorationLine: 'underline',
    textDecorationColor: colours.borderStrong,
    cursor: 'pointer',
  } as never,
});
