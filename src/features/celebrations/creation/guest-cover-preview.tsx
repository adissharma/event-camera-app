import { useMemo, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, View } from 'react-native';

import { CloseIcon, EyeIcon, PencilIcon } from '@/components/ui/icons';
import { colours, spacing } from '@/design';
import { GuestEventCover } from '@/features/celebrations/guest-event-cover';
import { resolveCover } from '@/features/celebrations/cover-source';
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

  const accent = theme?.accent ?? colours.brandPrimary;
  const coverSource = draft.coverLocalUri || draft.coverStoragePath
    ? resolveCover(draft.coverLocalUri ?? draft.coverStoragePath)
    : resolveCover(null);
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
      <GuestEventCover
        coverSource={coverSource}
        title={title}
        countdownLabel={countdownLabel}
        shotsLeftLabel={shotsLeftLabel}
        accent={accent}
        height="100%"
        preview={!isFullScreen || compact}
        showNameInput={false}
        ctaLabel="Join the event"
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
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(11, 11, 12, 0.12)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.14,
              shadowRadius: 4,
              elevation: 3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EyeIcon size={18} color="#0B0B0C" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit cover"
            onPress={onEditCover}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(11, 11, 12, 0.12)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.14,
              shadowRadius: 4,
              elevation: 3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PencilIcon size={18} color="#0B0B0C" />
          </Pressable>
        </View>
      ) : null}

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
