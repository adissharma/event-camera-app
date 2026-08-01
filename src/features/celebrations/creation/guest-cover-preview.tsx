import { useMemo, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText } from '@/components/ui/text';
import { CloseIcon, EyeIcon, PencilIcon } from '@/components/ui/icons';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PremiumImage } from '@/components/media/premium-image';
import { colours, radii, spacing } from '@/design';
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
  /** Shows the single cover-edit affordance. Off for the peeking cards. */
  editable?: boolean;
  onEditCover?: () => void;
  isFullScreen?: boolean;
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
 * When `editable`, a single pencil opens the cover editor. The preview stays
 * clean, and the sheet can carry the image and text controls together.
 */
export function GuestCoverPreview({
  draft,
  theme,
  compact = false,
  editable = false,
  onEditCover,
  isFullScreen = false,
}: GuestCoverPreviewProps) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const displayDate = draft.displayDate ?? draft.endsAt;

  // Swipe down to dismiss gesture handling for full-screen preview
  const translateY = useMemo(() => new Animated.Value(0), []);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 10;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.5) {
            Animated.timing(translateY, {
              toValue: 800,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setIsPreviewVisible(false);
              translateY.setValue(0);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 40,
              friction: 5,
            }).start();
          }
        },
      }),
    [translateY]
  );

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

  const scale = isFullScreen ? 1.625 : (compact ? 0.72 : 1);
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
        <PremiumImage
          assetKey="create_event_cover"
          accessibilityLabel="Default cover photograph"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          radius="none"
        />
      )}

      <LinearGradient
        colors={colours.imageScrim}
        locations={scrimLocations}
        style={StyleSheet.absoluteFill}
      />

      {/* Single edit entry point for the whole cover. */}
      {editable ? (
        <View
          style={{
            position: 'absolute',
            top: spacing.xl,
            right: spacing.md,
            flexDirection: 'row',
            gap: spacing.sm,
            zIndex: 10,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview cover"
            onPress={() => setIsPreviewVisible(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EyeIcon size={16} color="#fff" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit cover"
            onPress={onEditCover}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PencilIcon size={16} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <View style={{ flex: 1, justifyContent: 'space-between', padding: spacing.md * scale }}>
        <BrandLogo height={18 * scale} />

        <View style={{ gap: spacing.xs * scale, alignItems: isCentred ? 'center' : 'stretch' }}>
          {dateLine ? (
            <AppText
              variant="eyebrow"
              tone="secondary"
              style={{ fontSize: 8 * scale, letterSpacing: 1.2 * scale }}
            >
              {dateLine}
            </AppText>
          ) : null}

          <AppText
            variant="titleMedium"
            numberOfLines={3}
            style={{ fontSize: 18 * scale, lineHeight: 22 * scale, flexShrink: 1 }}
          >
            {draft.title.trim() || 'Your event'}
          </AppText>

          {/* The guest's action. Present so the host can see that joining is one
              tap and needs no account. */}
          <View
            style={{
              marginTop: spacing.sm * scale,
              paddingVertical: spacing.sm * scale,
              borderRadius: radii.md * scale,
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

      <Modal
        visible={isPreviewVisible}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setIsPreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Animated.View
            {...panResponder.panHandlers}
            style={{
              flex: 1,
              transform: [{ translateY }],
            }}
          >
            <GuestCoverPreview
              draft={draft}
              theme={theme}
              compact={false}
              editable={false}
              isFullScreen={true}
            />
            {/* Close button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              onPress={() => setIsPreviewVisible(false)}
              style={{
                position: 'absolute',
                top: Platform.OS === 'ios' ? 60 : 30,
                right: spacing.md,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
            >
              <CloseIcon size={18} color="#fff" />
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
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
