import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText } from '@/components/ui/text';
import { PencilIcon } from '@/components/ui/icons';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PremiumImage } from '@/components/media/premium-image';
import { VisualPlaceholder } from '@/components/media/visual-placeholder';
import { colours, layout, radii, spacing } from '@/design';
import { LOCALE_CONFIG } from '@/config/app-config';
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
}

export function parseCoverTheme(designTokens: unknown): CoverTheme {
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
  };
}

export interface GuestCoverPreviewProps {
  draft: CreationDraft;
  /** Applied to the cover. Defaults to the house style when absent. */
  theme?: CoverTheme;
  /** Scales type down for a small peeking frame. */
  compact?: boolean;
  /** Shows the pencil affordances. Off for the peeking cards. */
  editable?: boolean;
  onEditImage?: () => void;
  onEditTitle?: () => void;
  onEditDate?: () => void;
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
 * When `editable`, a pencil is anchored to each thing that can be changed. They
 * are anchored rather than collected into a toolbar because the anchor is what
 * says *what* is editable — a row of generic buttons needs a legend.
 */
export function GuestCoverPreview({
  draft,
  theme,
  compact = false,
  editable = false,
  onEditImage,
  onEditTitle,
  onEditDate,
}: GuestCoverPreviewProps) {
  const displayDate = draft.displayDate ?? draft.endsAt;

  // A host-written label wins over the formatted date. Falling back rather than
  // requiring one means the cover reads sensibly before it is ever touched.
  const dateLine =
    draft.coverDateLabel?.trim() ||
    (displayDate
      ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: draft.timezone,
        }).format(new Date(displayDate))
      : null);

  const scale = compact ? 0.72 : 1;
  const accent = theme?.accent ?? colours.brandPrimary;
  const isCentred = theme?.align === 'centre';

  // A full scrim darkens the whole image; the default weights the ramp to the
  // bottom so the photograph stays visible.
  const scrimLocations: [number, number, number] =
    theme?.overlay === 'scrim_full' ? [0, 0.2, 0.7] : [0, 0.45, 0.85];

  // Ink on a pale accent, off-white on a dark one — otherwise a dark theme
  // accent renders dark-on-dark and the guest's only action disappears.
  const accentIsLight = isLightColour(accent);

  return (
    <View style={{ flex: 1 }}>
      {draft.coverLocalUri ? (
        <PremiumImage
          uri={draft.coverLocalUri}
          accessibilityLabel="Your cover photograph"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          radius="none"
        />
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <VisualPlaceholder
            assetKey="create_event_cover"
            fill
            radius="none"
            style={{ borderWidth: 0 }}
          />
        </View>
      )}

      <LinearGradient
        colors={colours.imageScrim}
        locations={scrimLocations}
        style={StyleSheet.absoluteFill}
      />

      {/* Image pencil, floated over the photograph itself. */}
      {editable ? (
        <View style={{ position: 'absolute', top: spacing.xl, right: spacing.md }}>
          <EditBadge label="Change the cover photo" onPress={onEditImage} prominent />
        </View>
      ) : null}

      <View style={{ flex: 1, justifyContent: 'space-between', padding: spacing.md }}>
        <BrandLogo height={compact ? 11 : 14} />

        <View style={{ gap: spacing.xs, alignItems: isCentred ? 'center' : 'stretch' }}>
          {dateLine ? (
            <EditableRow editable={editable} onPress={onEditDate} label="Change the date line">
              <AppText
                variant="eyebrow"
                tone="secondary"
                style={{ fontSize: 8 * scale, letterSpacing: 1.2 }}
              >
                {dateLine}
              </AppText>
            </EditableRow>
          ) : null}

          <EditableRow editable={editable} onPress={onEditTitle} label="Change the event name">
            <AppText
              variant="titleMedium"
              numberOfLines={3}
              style={{ fontSize: 18 * scale, lineHeight: 22 * scale, flexShrink: 1 }}
            >
              {draft.title.trim() || 'Your event'}
            </AppText>
          </EditableRow>

          {draft.supportingLine.trim() ? (
            <AppText
              variant="caption"
              tone="secondary"
              numberOfLines={2}
              style={{ fontSize: 9 * scale }}
            >
              {draft.supportingLine.trim()}
            </AppText>
          ) : null}

          {/* The guest's action. Present so the host can see that joining is one
              tap and needs no account. */}
          <View
            style={{
              marginTop: spacing.sm,
              paddingVertical: spacing.sm,
              borderRadius: radii.md,
              backgroundColor: accent,
              alignItems: 'center',
              alignSelf: 'stretch',
            }}
          >
            <AppText
              variant="caption"
              style={{
                fontSize: 10 * scale,
                color: accentIsLight ? colours.textOnBrand : colours.textPrimary,
              }}
            >
              Start taking photos
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Wraps a line of cover text with a trailing pencil when editing. */
function EditableRow({
  editable,
  onPress,
  label,
  children,
}: {
  editable: boolean;
  onPress?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  if (!editable) return <>{children}</>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
    >
      {children}
      <EditBadge label={label} onPress={onPress} />
    </Pressable>
  );
}

function EditBadge({
  label,
  onPress,
  prominent = false,
}: {
  label: string;
  onPress?: () => void;
  prominent?: boolean;
}) {
  const size = prominent ? 32 : 20;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      // Small badges are below the 48pt target, so the tappable area is
      // extended rather than the badge being drawn larger and dominating the
      // cover it sits on.
      hitSlop={prominent ? 8 : 16}
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: prominent ? colours.overlayLight : 'transparent',
        borderWidth: prominent ? 0 : layout.hairline,
        borderColor: colours.borderStrong,
      }}
    >
      <PencilIcon
        size={prominent ? 16 : 11}
        color={prominent ? colours.textOnBrand : colours.textSecondary}
      />
    </Pressable>
  );
}

/**
 * Rough perceived lightness, for choosing a readable label on an accent.
 *
 * Uses the sRGB luma weights rather than a plain average: the eye is far more
 * sensitive to green than to blue, so an average calls a saturated blue
 * "light" and produces white-on-pale-blue.
 */
function isLightColour(hex: string): boolean {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}
