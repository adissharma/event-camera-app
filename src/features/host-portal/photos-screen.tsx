import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { normalisePhotoTreatment, TREATMENT_VISUALS } from '@/features/media/photo-treatment';
import { deleteHostPhoto } from '@/services/media-delete';
import { pinHostPhoto, unpinHostPhoto } from '@/services/media-pin';
import { fetchHostGallery, hostPortalKeys } from '@/services/host-portal';
import { downloadArchive, downloadMediaItem, type ArchiveProgress } from './downloads';
import {
  filterGallery,
  galleryContributors,
  type GalleryKind,
  type HostMediaItem,
} from './gallery';
import { Lightbox } from './lightbox';
import { CentredState, ConfirmDialog, Notice, Page, ToolButton, useCelebrationId, useHostEvent, useSignedUrls } from './ui';
import { pickFiles, useFileDrop } from './use-file-drop';
import { UPLOAD_ACCEPT, useHostUploads } from './use-host-uploads';

/** How many more tiles appear each time the bottom of the grid comes into view. */
const PAGE_SIZE = 60;

const KINDS: { kind: GalleryKind; label: string }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'photos', label: 'Photos' },
  { kind: 'videos', label: 'Videos' },
  { kind: 'pinned', label: 'Pinned' },
  { kind: 'challenges', label: 'Challenges' },
];

function formatDuration(durationMs: number | null): string | null {
  if (!durationMs) return null;
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Tile({
  item,
  urls,
  imageFilter,
  selecting,
  selected,
  onPress,
}: {
  item: HostMediaItem;
  urls: ReadonlyMap<string, string>;
  imageFilter: string | undefined;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const url = urls.get(item.storagePath);
  const poster = item.thumbnailStoragePath ? urls.get(item.thumbnailStoragePath) : undefined;
  const duration = formatDuration(item.durationMs);
  const kindLabel = item.mediaType === 'video' ? 'Video' : 'Photo';

  return (
    <button
      type="button"
      className="hp-tile"
      onClick={onPress}
      aria-pressed={selecting ? selected : undefined}
      aria-label={`${kindLabel} by ${item.displayName}`}
    >
      {item.mediaType === 'video' ? (
        poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" />
        ) : url ? (
          // No poster was uploaded for this one, so the browser draws the first frame.
          <video src={`${url}#t=0.1`} preload="metadata" muted playsInline />
        ) : null
      ) : url ? (
        <img src={url} alt="" loading="lazy" decoding="async" style={{ filter: imageFilter }} />
      ) : null}
      {item.isPinned ? <span className="hp-badge hp-badge-left">Pinned</span> : null}
      {item.mediaType === 'video' ? (
        <span className="hp-badge hp-badge-right">{duration ?? 'Video'}</span>
      ) : null}
      {selecting && selected ? <span className="hp-badge hp-badge-left hp-badge-selected">✓ Selected</span> : null}
      <span className="hp-tile-meta">{item.displayName}</span>
    </button>
  );
}

function UploadTray({
  uploads,
}: {
  uploads: ReturnType<typeof useHostUploads>;
}) {
  const { jobs } = uploads;
  if (jobs.length === 0) return null;

  const uploadable = jobs.filter((job) => !job.refused).length;
  const finished = jobs.filter((job) => job.status === 'done').length;
  const failed = jobs.filter((job) => job.status === 'failed');
  const canRetry = failed.some((job) => !job.refused);
  const active = jobs.some((job) => job.status === 'queued' || job.status === 'uploading');

  return (
    <View style={S.tray}>
      <View style={S.trayHeader}>
        <AppText variant="label" style={S.trayTitle}>
          {active ? `Uploading ${finished} of ${uploadable}…` : `${finished} of ${uploadable} uploaded`}
        </AppText>
        {canRetry && !active ? <ToolButton label="Retry failed" onPress={uploads.retryFailed} /> : null}
        {!active ? <ToolButton label="Done" onPress={uploads.clearFinished} /> : null}
      </View>
      <View style={S.trackOuter}>
        <View style={[S.trackInner, { width: `${uploadable > 0 ? Math.round((finished / uploadable) * 100) : 0}%` }]} />
      </View>
      {failed.slice(0, 5).map((job) => (
        <AppText key={job.id} variant="caption" tone="error" numberOfLines={1}>
          {job.file.name}: {job.error}
        </AppText>
      ))}
      {failed.length > 5 ? (
        <AppText variant="caption" tone="error">
          and {failed.length - 5} more
        </AppText>
      ) : null}
    </View>
  );
}

export default function HostPhotosScreen() {
  const celebrationId = useCelebrationId();
  const { data: event } = useHostEvent(celebrationId);
  const eventSessionId = event?.session?.id ?? null;

  if (!event) return <CentredState busy />;
  if (!eventSessionId) {
    return <CentredState title="Nothing here yet" body="This event doesn't have a session to collect photos." />;
  }

  return (
    <Gallery
      celebrationId={celebrationId}
      eventSessionId={eventSessionId}
      eventCode={event.celebration.event_code}
      eventTitle={event.celebration.title}
      imageFilter={
        TREATMENT_VISUALS[normalisePhotoTreatment(event.session?.photo_treatment)].colorMatrix
          ? 'grayscale(1)'
          : undefined
      }
    />
  );
}

function Gallery({
  celebrationId,
  eventSessionId,
  eventCode,
  eventTitle,
  imageFilter,
}: {
  celebrationId: string;
  eventSessionId: string;
  eventCode: string | null;
  eventTitle: string;
  imageFilter: string | undefined;
}) {
  const queryClient = useQueryClient();
  const galleryKey = hostPortalKeys.gallery(eventSessionId);
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: galleryKey,
    queryFn: () => fetchHostGallery(eventSessionId),
  });

  const [kind, setKind] = useState<GalleryKind>('all');
  const [contributor, setContributor] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HostMediaItem[] | null>(null);
  const [archive, setArchive] = useState<ArchiveProgress | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const uploads = useHostUploads({ celebrationId, eventCode, eventSessionId });
  const { isDragging, dropProps } = useFileDrop(uploads.addFiles);

  const contributors = useMemo(() => galleryContributors(items ?? []), [items]);
  const filtered = useMemo(
    () => filterGallery(items ?? [], { kind, contributor }),
    [items, kind, contributor],
  );
  const visible = filtered.slice(0, visibleCount);
  const openIndex = openId ? filtered.findIndex((item) => item.id === openId) : -1;

  // Only what is on screen gets signed, plus the neighbours of an open photo so
  // the arrow keys never wait on a request.
  const paths = useMemo(() => {
    const wanted = visible.flatMap((item) =>
      item.mediaType === 'video' && item.thumbnailStoragePath
        ? [item.storagePath, item.thumbnailStoragePath]
        : [item.storagePath],
    );
    if (openIndex >= 0) {
      for (const neighbour of filtered.slice(Math.max(0, openIndex - 1), openIndex + 2)) {
        wanted.push(neighbour.storagePath);
      }
    }
    return wanted;
  }, [visible, filtered, openIndex]);
  const urls = useSignedUrls(paths);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < filtered.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + PAGE_SIZE);
        }
      },
      { rootMargin: '800px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  function changeFilter(next: () => void) {
    next();
    setVisibleCount(PAGE_SIZE);
  }

  const togglePin = useMutation({
    mutationFn: (item: HostMediaItem) =>
      item.isPinned
        ? unpinHostPhoto({ mediaItemId: item.id, celebrationId })
        : pinHostPhoto({ mediaItemId: item.id, celebrationId }),
    onError: (error) => {
      console.error('[host-portal] could not change the pin', error);
      setNotice({ tone: 'error', text: 'Couldn’t change that pin. An event can have two pinned at most.' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: galleryKey }),
  });

  const removeItems = useMutation({
    mutationFn: async (targets: HostMediaItem[]) => {
      const results = await Promise.allSettled(
        targets.map((item) => deleteHostPhoto({ mediaItemId: item.id })),
      );
      return results.filter((result) => result.status === 'rejected').length;
    },
    onSuccess: (failed) => {
      if (failed > 0) setNotice({ tone: 'error', text: `${failed.toLocaleString()} couldn’t be deleted. Try again.` });
    },
    onError: () => setNotice({ tone: 'error', text: 'Couldn’t delete. Check your connection and try again.' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: galleryKey }),
  });

  function confirmDelete() {
    if (!pendingDelete) return;
    const targets = pendingDelete;
    setPendingDelete(null);
    const removing = new Set(targets.map((item) => item.id));

    // Move on to the next photo rather than dropping the host out of the viewer.
    if (openId && removing.has(openId)) {
      const next = filtered.slice(openIndex + 1).find((item) => !removing.has(item.id))
        ?? filtered.slice(0, openIndex).reverse().find((item) => !removing.has(item.id));
      setOpenId(next?.id ?? null);
    }
    setSelectedIds(new Set());
    setSelecting(false);
    queryClient.setQueryData<HostMediaItem[]>(galleryKey, (current) =>
      current?.filter((item) => !removing.has(item.id)),
    );
    removeItems.mutate(targets);
  }

  async function downloadOne(item: HostMediaItem) {
    try {
      await downloadMediaItem(item);
    } catch (error) {
      console.error('[host-portal] download failed', error);
      setNotice({ tone: 'error', text: 'Couldn’t download that. Check your connection and try again.' });
    }
  }

  async function downloadMany(targets: readonly HostMediaItem[]) {
    if (archive || targets.length === 0) return;
    setArchive({ done: 0, total: targets.length });
    try {
      const { failed } = await downloadArchive(targets, eventTitle, setArchive);
      setNotice(
        failed > 0
          ? { tone: 'error', text: `${failed.toLocaleString()} couldn’t be included in the download. Try those again.` }
          : { tone: 'success', text: `Downloaded ${targets.length.toLocaleString()}.` },
      );
    } catch (error) {
      console.error('[host-portal] archive failed', error);
      setNotice({ tone: 'error', text: 'The download failed. Check your connection and try again.' });
    } finally {
      setArchive(null);
    }
  }

  function exitSelection() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  const selectedItems = filtered.filter((item) => selectedIds.has(item.id));
  const allSelected = filtered.length > 0 && selectedItems.length === filtered.length;
  const total = items?.length ?? 0;
  const startUpload = () => pickFiles(UPLOAD_ACCEPT, true, uploads.addFiles);

  if (isLoading) return <CentredState busy />;
  if (isError) {
    return (
      <CentredState
        title="We couldn't load the photos"
        body="Check your connection and try again."
        action={<ToolButton label="Try again" onPress={() => void refetch()} />}
      />
    );
  }

  return (
    <div {...dropProps} style={ROOT_STYLE}>
      <Page>
        <View style={S.header}>
          <View style={S.headerTitle}>
            <AppText variant="titleLarge">Photos</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {total === 0
                ? 'Photos from your guests appear here as they come in.'
                : `${total.toLocaleString()} from ${contributors.length.toLocaleString()} ${contributors.length === 1 ? 'person' : 'people'}. New ones appear live.`}
            </AppText>
          </View>
          <View style={S.actions}>
            {archive ? (
              <AppText variant="label" tone="secondary">
                Preparing download… {archive.done.toLocaleString()} of {archive.total.toLocaleString()}
              </AppText>
            ) : null}
            {selecting ? (
              <>
                <ToolButton
                  label={allSelected ? 'Clear' : `Select all ${filtered.length.toLocaleString()}`}
                  onPress={() => setSelectedIds(allSelected ? new Set() : new Set(filtered.map((item) => item.id)))}
                />
                <ToolButton
                  label={`Download ${selectedItems.length.toLocaleString()}`}
                  disabled={selectedItems.length === 0 || archive !== null}
                  onPress={() => void downloadMany(selectedItems)}
                />
                <ToolButton
                  label={`Delete ${selectedItems.length.toLocaleString()}`}
                  tone="danger"
                  disabled={selectedItems.length === 0}
                  onPress={() => setPendingDelete(selectedItems)}
                />
                <ToolButton label="Cancel" onPress={exitSelection} />
              </>
            ) : (
              <>
                {total > 0 ? <ToolButton label="Select" onPress={() => setSelecting(true)} /> : null}
                {total > 0 ? (
                  <ToolButton
                    label="Download all"
                    disabled={archive !== null}
                    onPress={() => void downloadMany(items ?? [])}
                  />
                ) : null}
                <ToolButton label="Upload photos" tone="primary" onPress={startUpload} />
              </>
            )}
          </View>
        </View>

        {notice ? (
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        ) : null}

        <UploadTray uploads={uploads} />

        {total > 0 ? (
          <View style={S.filters}>
            {KINDS.map((entry) => (
              <ToolButton
                key={entry.kind}
                label={entry.label}
                selected={kind === entry.kind}
                onPress={() => changeFilter(() => setKind(entry.kind))}
              />
            ))}
            <select
              className="hp-select"
              aria-label="Filter by who took it"
              value={contributor ?? ''}
              onChange={(event) => {
                const value = event.target.value || null;
                changeFilter(() => setContributor(value));
              }}
            >
              <option value="">Everyone</option>
              {contributors.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name} ({entry.count.toLocaleString()})
                </option>
              ))}
            </select>
          </View>
        ) : null}

        {total === 0 ? (
          <View style={S.emptyDrop}>
            <AppText variant="titleMedium" align="center">
              No photos yet
            </AppText>
            <AppText variant="bodySmall" tone="secondary" align="center">
              Share your event from the Guests page, or drag your own photos here.
            </AppText>
            <ToolButton label="Upload photos" onPress={startUpload} />
          </View>
        ) : filtered.length === 0 ? (
          <CentredState title="Nothing matches" body="Try a different filter." />
        ) : (
          <div className="hp-grid">
            {visible.map((item) => (
              <Tile
                key={item.id}
                item={item}
                urls={urls}
                imageFilter={imageFilter}
                selecting={selecting}
                selected={selectedIds.has(item.id)}
                onPress={() => {
                  if (!selecting) {
                    setOpenId(item.id);
                    return;
                  }
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        )}
        {hasMore ? <div ref={sentinelRef} style={SENTINEL_STYLE} /> : null}
      </Page>

      {isDragging ? (
        <View style={S.dropOverlay} pointerEvents="none">
          <AppText variant="titleLarge">Drop photos to add them to the event</AppText>
        </View>
      ) : null}

      {openIndex >= 0 ? (
        <Lightbox
          items={filtered}
          index={openIndex}
          urls={urls}
          imageFilter={imageFilter}
          busy={pendingDelete !== null}
          onNavigate={(index) => setOpenId(filtered[index]?.id ?? null)}
          onClose={() => setOpenId(null)}
          onTogglePin={(item) => togglePin.mutate(item)}
          onDownload={(item) => void downloadOne(item)}
          onDelete={(item) => setPendingDelete([item])}
        />
      ) : null}

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={pendingDelete && pendingDelete.length > 1 ? `Delete ${pendingDelete.length.toLocaleString()} items?` : 'Delete this?'}
        body="It will be removed from the album for you and all your guests."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

const ROOT_STYLE = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
} as const;

const SENTINEL_STYLE = { height: 1 };

const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  headerTitle: {
    gap: spacing.xs,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyDrop: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.giant,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderStyle: 'dashed',
    borderColor: colours.borderStrong,
  },
  tray: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  trayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trayTitle: {
    flex: 1,
  },
  trackOuter: {
    height: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colours.surfaceRaised,
  },
  trackInner: {
    height: '100%',
    backgroundColor: colours.brandPrimary,
  },
  dropOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colours.scrim,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colours.brandPrimary,
  },
});
