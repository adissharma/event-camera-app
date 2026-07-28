import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText } from '@/components/ui/text';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PremiumImage } from '@/components/media/premium-image';
import { VisualPlaceholder } from '@/components/media/visual-placeholder';
import { colours, radii, spacing } from '@/design';
import { LOCALE_CONFIG } from '@/config/app-config';
import type { CreationDraft } from '../draft/types';

export interface GuestCoverPreviewProps {
  draft: CreationDraft;
}

/**
 * What a guest sees when they scan the code.
 *
 * Composed from the draft, so every change on the cover step is reflected
 * immediately. It updates in place rather than re-mounting — the brief is
 * explicit that the preview must not flash the whole phone on each keystroke,
 * and a remount would do exactly that.
 *
 * Ranged left with an eyebrow above the title. This is one of the six binding
 * differentiators recorded in docs/brand-system.md: the nearest competitor
 * centres a serif over its cover, and matching that composition would make the
 * product a copy regardless of the typeface.
 */
export function GuestCoverPreview({ draft }: GuestCoverPreviewProps) {
  const displayDate = draft.displayDate ?? draft.endsAt;

  const formattedDate = displayDate
    ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: draft.timezone,
      }).format(new Date(displayDate))
    : null;

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
        locations={[0, 0.45, 0.85]}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ flex: 1, justifyContent: 'space-between', padding: spacing.md }}>
        <BrandLogo height={14} />

        <View style={{ gap: spacing.xs }}>
          {formattedDate ? (
            <AppText variant="eyebrow" tone="secondary" style={{ fontSize: 8, letterSpacing: 1.2 }}>
              {formattedDate}
            </AppText>
          ) : null}

          <AppText variant="titleMedium" numberOfLines={3} style={{ fontSize: 18, lineHeight: 22 }}>
            {draft.title.trim() || 'Your event'}
          </AppText>

          {draft.supportingLine.trim() ? (
            <AppText variant="caption" tone="secondary" numberOfLines={2} style={{ fontSize: 9 }}>
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
              backgroundColor: colours.brandPrimary,
              alignItems: 'center',
            }}
          >
            <AppText variant="caption" tone="onBrand" style={{ fontSize: 10 }}>
              Start taking photos
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
