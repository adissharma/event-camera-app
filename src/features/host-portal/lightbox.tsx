import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';

import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import type { HostMediaItem } from './gallery';
import { ToolButton, useIsDesktop } from './ui';

function capturedLabel(value: string | null) {
  return value ? format(new Date(value), "d MMM yyyy 'at' HH:mm") : null;
}

export function Lightbox({
  items,
  index,
  urls,
  imageFilter,
  busy,
  onNavigate,
  onClose,
  onTogglePin,
  onDownload,
  onDelete,
}: {
  items: readonly HostMediaItem[];
  index: number;
  urls: ReadonlyMap<string, string>;
  /** The event's black-and-white treatment, drawn the way the app draws it. */
  imageFilter: string | undefined;
  busy: boolean;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onTogglePin: (item: HostMediaItem) => void;
  onDownload: (item: HostMediaItem) => void;
  onDelete: (item: HostMediaItem) => void;
}) {
  const isDesktop = useIsDesktop();
  const item = items[index];
  const url = item ? urls.get(item.storagePath) : undefined;
  const count = items.length;

  useEffect(() => {
    // A dialog opened from here takes the keyboard; Escape must close that alone.
    if (busy) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (event.key === 'ArrowRight' && index < count - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, index, count, onClose, onNavigate]);

  if (!item) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[S.root, !isDesktop && S.rootPhone]}>
        <View style={S.stage}>
          {item.mediaType === 'video' ? (
            <video
              key={item.id}
              src={url}
              controls
              autoPlay
              playsInline
              poster={item.thumbnailStoragePath ? urls.get(item.thumbnailStoragePath) : undefined}
              style={MEDIA_STYLE}
            />
          ) : url ? (
            <img key={item.id} src={url} alt={`Taken by ${item.displayName}`} style={{ ...MEDIA_STYLE, filter: imageFilter }} />
          ) : null}

          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={[S.round, S.close]}>
            <CloseIcon size={20} color={colours.textPrimary} />
          </Pressable>
          {index > 0 ? (
            <Pressable
              onPress={() => onNavigate(index - 1)}
              accessibilityRole="button"
              accessibilityLabel="Previous"
              style={[S.round, S.previous]}
            >
              <ChevronLeftIcon size={22} color={colours.textPrimary} />
            </Pressable>
          ) : null}
          {index < count - 1 ? (
            <Pressable
              onPress={() => onNavigate(index + 1)}
              accessibilityRole="button"
              accessibilityLabel="Next"
              style={[S.round, S.next]}
            >
              <ChevronRightIcon size={22} color={colours.textPrimary} />
            </Pressable>
          ) : null}
        </View>

        <View style={[S.panel, !isDesktop && S.panelPhone]}>
          <View style={S.details}>
            <AppText variant="heading" numberOfLines={1}>
              {item.displayName}
            </AppText>
            {capturedLabel(item.capturedAt) ? (
              <AppText variant="bodySmall" tone="secondary">
                {capturedLabel(item.capturedAt)}
              </AppText>
            ) : null}
            {item.caption ? <AppText variant="body">{item.caption}</AppText> : null}
            <AppText variant="caption" tone="secondary">
              {index + 1} of {count.toLocaleString()}
            </AppText>
          </View>
          <View style={[S.actions, !isDesktop && S.actionsPhone]}>
            <ToolButton label={item.isPinned ? 'Unpin' : 'Pin to top'} selected={item.isPinned} onPress={() => onTogglePin(item)} />
            <ToolButton label="Download" onPress={() => onDownload(item)} />
            <ToolButton label="Delete" tone="danger" onPress={() => onDelete(item)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const MEDIA_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
} as const;

const S = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colours.background,
  },
  rootPhone: {
    flexDirection: 'column',
  },
  stage: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  round: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colours.overlayDark,
  },
  close: {
    top: spacing.base,
    left: spacing.base,
  },
  previous: {
    left: spacing.base,
    top: '50%',
  },
  next: {
    right: spacing.base,
    top: '50%',
  },
  panel: {
    width: 300,
    gap: spacing.xl,
    padding: spacing.lg,
    borderLeftWidth: layout.hairline,
    borderLeftColor: colours.borderSubtle,
  },
  panelPhone: {
    width: '100%',
    gap: spacing.md,
    borderLeftWidth: 0,
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
  },
  details: {
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  actionsPhone: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
