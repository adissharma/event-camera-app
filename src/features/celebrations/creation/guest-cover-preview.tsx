import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, View } from 'react-native';

import { EyeIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import {
  GuestJoinScreen,
  GUEST_JOIN_REFERENCE_HEIGHT,
  GUEST_JOIN_REFERENCE_WIDTH,
} from '@/features/celebrations/join/guest-join-screen';
import { useCoverSource } from '@/features/celebrations/cover-source';
import {
  resolveCoverTemplate,
  type CoverTemplateKey,
} from '@/features/celebrations/cover-templates';
import type { CreationDraft } from '../draft/types';

/**
 * The subset of a theme's `design_tokens` the cover actually renders.
 *
 * Parsed defensively: the column is JSONB and is editable remotely, so a theme
 * added later with a missing or misspelled key must fall back rather than crash
 * a host's cover.
 */
export interface CoverTheme {
  accent: string;
  align: 'left' | 'centre';
  overlay: 'scrim_bottom' | 'scrim_full';
  /**
   * Which layout this particular theme renders with.
   *
   * Carried on the theme rather than read from the draft, because the carousel
   * renders one card per theme *while a different one is selected* — deriving
   * it from the selection made every card in the row redraw as whatever was
   * currently focused.
   */
  template: CoverTemplateKey;
}

export function parseCoverTheme(designTokens: unknown, slug?: string | null): CoverTheme {
  const tokens = (designTokens ?? {}) as {
    accent?: unknown;
    cover?: { align?: unknown; overlay?: unknown };
  };

  const accent =
    typeof tokens.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(tokens.accent)
      ? tokens.accent
      : colours.brandPrimary;

  return {
    accent,
    align: tokens.cover?.align === 'centre' ? 'centre' : 'left',
    overlay: tokens.cover?.overlay === 'scrim_full' ? 'scrim_full' : 'scrim_bottom',
    template: resolveCoverTemplate(slug),
  };
}

export interface GuestCoverPreviewProps {
  draft: CreationDraft;
  /** Applied to the cover. Defaults to the house style when absent. */
  theme?: CoverTheme;
  /** Scales type down for a small peeking frame. */
  compact?: boolean;
  /** Shows the Preview button. Off for the peeking neighbour cards. */
  editable?: boolean;
  isFullScreen?: boolean;
  onPreview?: () => void;
}

/**
 * What a guest sees when they scan the code.
 *
 * Composed from the draft, so every change is reflected immediately. It updates
 * in place rather than re-mounting — the preview must not flash the whole phone
 * on each keystroke, and a remount would do exactly that.
 *
 * Ranged left with an eyebrow above the title. One of the six binding
 * differentiators in docs/brand-system.md: the nearest competitor centres a
 * serif over its cover, and matching that composition would make the product a
 * copy regardless of the typeface.
 *
 * When `editable`, a single Preview button opens the full-screen takeover.
 * Editing the cover photo and the event name are separate flows, entered from
 * outside this component (see `src/app/create/cover.tsx`) — this component
 * only ever shows what a guest sees.
 */
export function GuestCoverPreview({
  draft,
  theme,
  compact = false,
  editable = false,
  isFullScreen = false,
  onPreview,
}: GuestCoverPreviewProps) {
  const accent = theme?.accent ?? colours.brandPrimary;
  // The host's freshly picked local file takes precedence over the stored
  // path, so the preview updates the instant they choose a photo; both go
  // through the shared resolver, which is what lets an already-uploaded cover
  // (a bucket path) render here at all.
  const coverSource = useCoverSource(draft.coverLocalUri ?? draft.coverStoragePath);
  const title = draft.title.trim() || 'Your event';
  const countdownLabel = formatRemaining(draft.endsAt);
  const shotsLeftLabel =
    draft.shotLimitPerGuest === null
      ? '∞'
      : draft.shotLimitPerGuest === undefined
        ? '—'
        : String(draft.shotLimitPerGuest);

  return (
    <View style={{ flex: 1 }}>
      <ScaledJoinScreen>
        <GuestJoinScreen
          // The card's own theme decides the layout; `draft.themeSlug` is only
          // a fallback for callers that render without a specific theme.
          template={theme?.template ?? resolveCoverTemplate(draft.themeSlug)}
          coverSource={coverSource}
          title={title}
          countdownLabel={countdownLabel}
          shotsLeftLabel={shotsLeftLabel}
          accent={accent}
          // Composed against the reference frame, not the host's own device,
          // so the miniature has a phone's proportions wherever it is shown.
          viewportHeight={GUEST_JOIN_REFERENCE_HEIGHT}
          name=""
          // A picture of the join screen: everything visible, nothing live.
          interactive={false}
          scrollable={false}
        />
      </ScaledJoinScreen>

      {/* A tap anywhere on the mock phone opens the preview, not just the
          badge in the corner — the badge is still there as an explicit,
          discoverable affordance, but the whole device should feel tappable. */}
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Preview cover"
          onPress={onPreview}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      {/* Compact secondary CTA. Its visible capsule is deliberately shorter
          than the standard button, while the outer pressable retains a full
          touch target. */}
      {editable ? (
        <View
          style={{
            position: 'absolute',
            top: spacing.xl,
            right: spacing.md,
            zIndex: 10,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview cover"
            onPress={onPreview}
            style={({ pressed }) => ({
              minHeight: layout.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
                height: 32,
                paddingHorizontal: spacing.sm,
                borderRadius: radii.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                backgroundColor: colours.surface,
                borderWidth: layout.hairline,
                borderColor: colours.borderStrong,
              }}
            >
              <EyeIcon size={14} color={colours.brandPrimary} />
              <AppText variant="caption" tone="brand">
                Tap to preview
              </AppText>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Renders the join screen at its true size and shrinks the whole tree to fit.
 *
 * One transform on one node, rather than a set of smaller paddings and font
 * sizes chosen to look right in a small box. That distinction is the point:
 * anything laid out to fit the mockup is a second design that drifts from the
 * real screen, whereas a uniform scale is guaranteed to stay proportionally
 * identical to it — the input, the CTA and the type all keep their true
 * relative sizes.
 */
function ScaledJoinScreen({ children }: { children: React.ReactNode }) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== frame.width || height !== frame.height)) {
      setFrame({ width, height });
    }
  }

  // `max` — a cover-fit rather than a contain-fit — so the scaled screen
  // always fills the frame edge to edge with no letterboxing, matching how
  // the real `/j` page fills an actual phone. `DeviceFrame`'s bezel is a
  // fixed pixel inset on a fixed aspect ratio, which distorts its inner
  // viewport a couple of percent away from the true 375:812 join-screen
  // ratio; a contain-fit turned that into a visible black strip top and
  // bottom. The mismatch here is small enough that a cover-fit crops an
  // imperceptible sliver rather than anything the host would notice missing.
  const scale =
    frame.width > 0
      ? Math.max(
          frame.width / GUEST_JOIN_REFERENCE_WIDTH,
          frame.height / GUEST_JOIN_REFERENCE_HEIGHT,
        )
      : 0;

  return (
    <View onLayout={handleLayout} style={{ flex: 1, overflow: 'hidden' }}>
      {scale > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: (frame.width - GUEST_JOIN_REFERENCE_WIDTH * scale) / 2,
            width: GUEST_JOIN_REFERENCE_WIDTH,
            height: GUEST_JOIN_REFERENCE_HEIGHT,
            transform: [{ scale }],
            transformOrigin: 'top left',
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

function formatRemaining(endsAt: string | null): string {
  if (!endsAt) return '—';

  const remaining = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Ended';

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
