import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { STORAGE_BUCKETS } from '@/config/app-config';
import { colours, layout, radii, spacing, typography } from '@/design';
import { resolveSignedUrls } from '@/features/media/signed-url-cache';
import { fetchHostEvent, hostPortalKeys } from '@/services/host-portal';

/** Below this the sidebar folds into tabs. */
const DESKTOP_WIDTH = 960;

export function useIsDesktop(): boolean {
  return useWindowDimensions().width >= DESKTOP_WIDTH;
}

export function useCelebrationId(): string {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  return String(celebrationId);
}

export function useHostEvent(celebrationId: string) {
  return useQuery({
    queryKey: hostPortalKeys.event(celebrationId),
    queryFn: () => fetchHostEvent(celebrationId),
  });
}

/** Signed URLs last an hour, and a host can leave a gallery open all day. */
const SIGNED_URL_REFRESH_MS = 50 * 60_000;

/**
 * Signed URLs for a set of private objects, by path.
 *
 * Grows as more paths are asked for: `resolveSignedUrls` only requests the ones
 * it does not already hold, so a gallery signs each page of photos as it scrolls
 * into view rather than the whole event up front.
 */
export function useSignedUrls(
  paths: readonly string[],
  bucket: string = STORAGE_BUCKETS.media,
): ReadonlyMap<string, string> {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [generation, setGeneration] = useState(0);
  const key = paths.join('|');

  useEffect(() => {
    const timer = setInterval(() => setGeneration((value) => value + 1), SIGNED_URL_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!key) return;
    let active = true;
    void resolveSignedUrls(bucket, key.split('|'))
      .then((resolved) => {
        if (active) setUrls((current) => new Map([...current, ...resolved]));
      })
      .catch((error) => console.warn('[host-portal] could not sign media', error));
    return () => {
      active = false;
    };
  }, [bucket, key, generation]);

  return urls;
}

type ButtonState = PressableStateCallbackType & { hovered?: boolean };

/**
 * `Link asChild` hands its child props through a Slot that drops a function
 * `style`, so a hover style set directly on the Pressable never reaches it. This
 * takes the props the Slot passes and applies the hover state itself.
 */
function LinkSurface({
  surfaceStyle,
  hoverStyle,
  ...rest
}: PressableProps & { surfaceStyle?: StyleProp<ViewStyle>; hoverStyle?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...rest}
      style={(state) => [surfaceStyle, (state as ButtonState).hovered ? hoverStyle : null]}
    />
  );
}

export function PortalLink({
  href,
  style,
  hoverStyle,
  selected,
  children,
}: {
  href: string;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href as never} asChild>
      <LinkSurface
        accessibilityRole="link"
        accessibilityState={selected === undefined ? undefined : { selected }}
        surfaceStyle={style}
        hoverStyle={hoverStyle}
      >
        {children}
      </LinkSurface>
    </Link>
  );
}

type ToolButtonTone = 'default' | 'primary' | 'danger';

/** The portal's compact button. `Button` is sized for a thumb, not a toolbar. */
export function ToolButton({
  label,
  onPress,
  tone = 'default',
  selected = false,
  disabled = false,
  leading,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: ToolButtonTone;
  selected?: boolean;
  disabled?: boolean;
  leading?: ReactNode;
  accessibilityLabel?: string;
}) {
  const filled = tone === 'primary' || selected;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      style={(state) => {
        const { hovered, pressed } = state as ButtonState;
        return [
          S.toolButton,
          filled && S.toolButtonFilled,
          !filled && hovered && S.toolButtonHovered,
          filled && (hovered || pressed) && S.toolButtonFilledHovered,
          disabled && S.toolButtonDisabled,
        ];
      }}
    >
      {leading}
      <AppText
        variant="label"
        tone={filled ? 'onBrand' : tone === 'danger' ? 'error' : 'primary'}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[S.notice, { borderColor: tone === 'error' ? colours.error : colours.success }]}
    >
      <AppText variant="bodySmall" tone={tone} style={S.noticeText}>
        {children}
      </AppText>
      {onDismiss ? (
        <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={8}>
          <AppText variant="label" tone="secondary">
            Dismiss
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A centred dialog. `Alert.alert` does nothing at all on react-native-web. */
export function Dialog({
  visible,
  title,
  onClose,
  children,
  wide = false,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  // Not just `visible={false}`: react-native-web stacks modals in the order they
  // mount, so one mounted up front would open behind a lightbox opened after it.
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <ScrollView
          style={[S.dialog, wide && S.dialogWide]}
          contentContainerStyle={S.dialogContent}
          accessibilityRole="none"
        >
          <AppText variant="titleMedium">{title}</AppText>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog visible={visible} title={title} onClose={onClose}>
      <AppText variant="body" tone="secondary">
        {body}
      </AppText>
      <View style={S.dialogActions}>
        <Button label="Cancel" variant="quiet" size="medium" fullWidth={false} onPress={onClose} />
        <Button
          label={confirmLabel}
          variant="destructive"
          size="medium"
          fullWidth={false}
          onPress={onConfirm}
        />
      </View>
    </Dialog>
  );
}

export function CentredState({
  title,
  body,
  action,
  busy = false,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
  busy?: boolean;
}) {
  return (
    <View style={S.centred}>
      {busy ? <ActivityIndicator color={colours.textSecondary} /> : null}
      {title ? (
        <AppText variant="titleMedium" align="center">
          {title}
        </AppText>
      ) : null}
      {body ? (
        <AppText variant="bodySmall" tone="secondary" align="center" style={S.centredBody}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

/** A section's scrolling page. Body scrolling is off on web; see `+html.tsx`. */
export function Page({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const isDesktop = useIsDesktop();
  return (
    <ScrollView style={S.page} contentContainerStyle={[isDesktop ? S.pageDesktop : S.pagePhone, style]}>
      {children}
    </ScrollView>
  );
}

/**
 * Rules React Native styles cannot express: grid layout, hover, focus rings and
 * the bare DOM elements (`img`, `video`, `select`) the gallery is built from.
 */
export const PORTAL_CSS = `
.hp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: ${spacing.sm}px; }
.hp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: ${spacing.lg}px; }
@media (max-width: 600px) {
  .hp-grid { grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: ${spacing.xs}px; }
  .hp-cards { grid-template-columns: 1fr; }
}
.hp-tile {
  position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; overflow: hidden;
  cursor: pointer; background: ${colours.surface}; border-radius: ${radii.sm}px;
}
.hp-tile img, .hp-tile video { display: block; width: 100%; height: 100%; object-fit: cover; }
.hp-tile:focus-visible, .hp-link:focus-visible { outline: 2px solid ${colours.focusRing}; outline-offset: 2px; }
.hp-tile-meta {
  position: absolute; left: 0; right: 0; bottom: 0; padding: ${spacing.lg}px ${spacing.sm}px ${spacing.sm}px;
  background: linear-gradient(transparent, ${colours.overlayDark}); color: ${colours.textPrimary};
  font: ${typography.caption.fontSize}px ${typography.caption.fontFamily}; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0; transition: opacity 120ms;
}
.hp-tile:hover .hp-tile-meta, .hp-tile:focus-visible .hp-tile-meta { opacity: 1; }
.hp-tile[aria-pressed="true"] { box-shadow: inset 0 0 0 3px ${colours.brandPrimary}; }
.hp-tile[aria-pressed="true"] img, .hp-tile[aria-pressed="true"] video { opacity: 0.6; }
.hp-badge {
  position: absolute; top: ${spacing.sm}px; padding: ${spacing.xxs}px ${spacing.sm}px; border-radius: ${radii.pill}px;
  background: ${colours.overlayDark}; color: ${colours.textPrimary};
  font: ${typography.caption.fontSize}px ${typography.caption.fontFamily};
}
.hp-badge-left { left: ${spacing.sm}px; }
.hp-badge-right { right: ${spacing.sm}px; }
.hp-badge-selected { background: ${colours.brandPrimary}; color: ${colours.textOnBrand}; }
.hp-select {
  height: 36px; max-width: 200px; padding: 0 ${spacing.sm}px; cursor: pointer;
  color: ${colours.textPrimary}; background: ${colours.surface};
  border: ${layout.hairline}px solid ${colours.borderStrong}; border-radius: ${radii.md}px;
  font: ${typography.label.fontSize}px ${typography.label.fontFamily};
}
.hp-link { color: ${colours.accentWarm}; font: ${typography.label.fontSize}px ${typography.label.fontFamily}; text-decoration: none; }
.hp-link:hover { text-decoration: underline; }
.hp-card { display: block; text-decoration: none; }
`;

const S = StyleSheet.create({
  toolButton: {
    height: 36,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    backgroundColor: 'transparent',
  },
  toolButtonHovered: {
    backgroundColor: colours.surfaceRaised,
  },
  toolButtonFilled: {
    backgroundColor: colours.brandPrimary,
    borderColor: colours.brandPrimary,
  },
  toolButtonFilledHovered: {
    backgroundColor: colours.brandPressed,
    borderColor: colours.brandPressed,
  },
  toolButtonDisabled: {
    opacity: 0.45,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    backgroundColor: colours.surface,
  },
  noticeText: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colours.scrim,
  },
  dialog: {
    flexGrow: 0,
    width: '100%',
    maxWidth: 440,
    borderRadius: radii.xl,
    backgroundColor: colours.surfaceRaised,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  dialogWide: {
    maxWidth: 640,
  },
  dialogContent: {
    gap: spacing.base,
    padding: spacing.xl,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  centred: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  centredBody: {
    maxWidth: 400,
  },
  page: {
    flex: 1,
  },
  pageDesktop: {
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  pagePhone: {
    padding: spacing.base,
    gap: spacing.lg,
  },
});
