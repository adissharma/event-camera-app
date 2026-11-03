import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing, typography } from '@/design';
import { FloorplanFileError, useFloorplanUrl } from '@/features/seating/floorplan-file';
import {
  fetchSeatingPlan,
  mergeSeatingGuests,
  parseSeatingList,
  removeSeatingFloorplan,
  saveSeatingPlan,
  seatingKeys,
  uploadSeatingFloorplan,
  type SeatingGuest,
  type SeatingPlan,
} from '@/services/seating';
import { FLOORPLAN_ACCEPT, prepareFloorplanUpload } from './floorplan-upload';
import { CentredState, ConfirmDialog, Dialog, Notice, Page, ToolButton, useCelebrationId, useIsDesktop } from './ui';
import { pickFiles, useFileDrop } from './use-file-drop';

const CSV_ACCEPT = '.csv,.tsv,.txt,text/csv,text/plain';
const PREVIEW_ROWS = 8;

type NoticeState = { tone: 'error' | 'success'; text: string };

function CompactInput({
  value,
  onChangeText,
  placeholder,
  label,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  label: string;
  onSubmit: () => void;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colours.textSecondary}
      accessibilityLabel={label}
      onSubmitEditing={onSubmit}
      autoFocus={autoFocus}
      autoCorrect={false}
      style={S.input}
    />
  );
}

function FloorplanPanel({
  celebrationId,
  path,
  onNotice,
}: {
  celebrationId: string;
  path: string | null;
  onNotice: (notice: NoticeState) => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = seatingKeys.host(celebrationId);
  const url = useFloorplanUrl(path);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const prepared = await prepareFloorplanUpload(file);
      try {
        return await uploadSeatingFloorplan(celebrationId, prepared);
      } finally {
        URL.revokeObjectURL(prepared.uri);
      }
    },
    // A file that fails its checks would only fail them again.
    retry: false,
    onSuccess: (uploadedPath) => {
      queryClient.setQueryData<SeatingPlan>(queryKey, (current) => ({
        guests: current?.guests ?? [],
        floorplan_path: uploadedPath,
      }));
      onNotice({ tone: 'success', text: 'Floor plan saved. Guests can see it now.' });
    },
    onError: (error) => {
      console.error('[host-portal] could not upload the floor plan', error);
      onNotice({
        tone: 'error',
        text: error instanceof FloorplanFileError ? error.message : 'Couldn’t upload the floor plan. Try again.',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (target: string) => removeSeatingFloorplan(celebrationId, target),
    onError: (error) => {
      console.error('[host-portal] could not remove the floor plan', error);
      onNotice({ tone: 'error', text: 'Couldn’t remove the floor plan. Try again.' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { isDragging, dropProps } = useFileDrop((files) => upload.mutate(files[0]));
  const choose = () => pickFiles(FLOORPLAN_ACCEPT, false, (files) => upload.mutate(files[0]));
  const busy = upload.isPending || remove.isPending;

  return (
    <View style={S.panel}>
      <View style={S.panelHeader}>
        <AppText variant="heading" style={S.grow}>
          Floor plan
        </AppText>
        {busy ? (
          <AppText variant="caption" tone="secondary">
            {upload.isPending ? 'Uploading…' : 'Removing…'}
          </AppText>
        ) : path ? (
          <>
            <ToolButton label="Replace" onPress={choose} />
            <ToolButton label="Remove" tone="danger" onPress={() => setConfirmRemove(true)} />
          </>
        ) : null}
      </View>

      <div {...dropProps}>
        {path ? (
          <View style={[S.planFrame, isDragging && S.dropActive]}>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" aria-label="Open the floor plan at full size">
                <img src={url} alt="The event's floor plan" style={PLAN_IMAGE_STYLE} />
              </a>
            ) : null}
          </View>
        ) : (
          <View style={[S.planEmpty, isDragging && S.dropActive]}>
            <AppText variant="bodySmall" tone="secondary" align="center">
              Drag in a picture of the room so guests can find their table.
            </AppText>
            <ToolButton label={upload.isPending ? 'Uploading…' : 'Upload a PNG, JPEG or PDF'} disabled={busy} onPress={choose} />
          </View>
        )}
      </div>

      <ConfirmDialog
        visible={confirmRemove}
        title="Remove the floor plan?"
        body="Guests will no longer be able to see it."
        confirmLabel="Remove"
        onConfirm={() => {
          setConfirmRemove(false);
          if (path) remove.mutate(path);
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </View>
  );
}

function importSummary(added: number, updated: number) {
  const parts = [];
  if (added > 0) parts.push(`${added.toLocaleString()} new`);
  if (updated > 0) parts.push(`${updated.toLocaleString()} already on your plan will get the new seat`);
  return parts.length > 0 ? parts.join(' · ') : 'Everyone here is already on your plan.';
}

function ImportDialog({
  visible,
  guests,
  onImport,
  onClose,
}: {
  visible: boolean;
  guests: SeatingGuest[];
  onImport: (next: SeatingGuest[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseSeatingList(text), [text]);
  const preview = useMemo(() => mergeSeatingGuests(guests, parsed), [guests, parsed]);

  async function readFile(file: File) {
    if (/\.xlsx?$/i.test(file.name)) {
      setError('Save the spreadsheet as a CSV first, or copy its rows and paste them below.');
      return;
    }
    try {
      const contents = await file.text();
      if (parseSeatingList(contents).length === 0) {
        setError('No guests found. The file needs a guest name at the start of each row.');
        return;
      }
      setError(null);
      // Into the box rather than straight onto the plan, so the host sees what
      // was read and can fix a stray row before anything is saved.
      setText(contents);
    } catch (readError) {
      console.error('[host-portal] could not read the list', readError);
      setError('We couldn’t open that file. Paste the list below instead.');
    }
  }

  const { isDragging, dropProps } = useFileDrop((files) => void readFile(files[0]));

  function close() {
    setText('');
    setError(null);
    onClose();
  }

  return (
    <Dialog visible={visible} title="Import your guest list" onClose={close} wide>
      <div {...dropProps}>
        <View style={[S.importDrop, isDragging && S.dropActive]}>
          <AppText variant="bodySmall" tone="secondary" align="center">
            Drag in a CSV file, or
          </AppText>
          <ToolButton label="Choose a file" onPress={() => pickFiles(CSV_ACCEPT, false, (files) => void readFile(files[0]))} />
        </View>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField
        label="Or paste a list"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setError(null);
        }}
        placeholder={'Sam Lee, Table 3, Seat 4\nPriya Shah, Top table'}
        multiline
        autoCorrect={false}
        hint="One guest per line: their name, then where they sit. Rows copied from a spreadsheet work too."
        inputStyle={S.importInput}
      />
      {parsed.length > 0 ? (
        <View style={S.preview}>
          {parsed.slice(0, PREVIEW_ROWS).map((guest, index) => (
            <View key={`${index}-${guest.name}`} style={S.previewRow}>
              <AppText variant="bodySmall" numberOfLines={1} style={S.grow}>
                {guest.name}
              </AppText>
              <AppText variant="bodySmall" numberOfLines={1} style={S.seat}>
                {guest.seat || 'No seat yet'}
              </AppText>
            </View>
          ))}
          {parsed.length > PREVIEW_ROWS ? (
            <AppText variant="caption" tone="secondary">
              and {(parsed.length - PREVIEW_ROWS).toLocaleString()} more
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            {importSummary(preview.added, preview.updated)}
          </AppText>
        </View>
      ) : null}
      <View style={S.dialogActions}>
        <Button label="Cancel" variant="quiet" size="medium" fullWidth={false} onPress={close} />
        <Button
          label={parsed.length > 0 ? `Import ${parsed.length.toLocaleString()} ${parsed.length === 1 ? 'guest' : 'guests'}` : 'Import guests'}
          size="medium"
          fullWidth={false}
          disabled={parsed.length === 0}
          disabledReason="Add at least one guest name."
          onPress={() => {
            onImport(preview.guests);
            close();
          }}
        />
      </View>
    </Dialog>
  );
}

function downloadableCsv(guests: readonly SeatingGuest[]): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return ['Name,Seat', ...guests.map((guest) => `${escape(guest.name)},${escape(guest.seat)}`)].join('\n');
}

export default function HostSeatingScreen() {
  const celebrationId = useCelebrationId();
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();
  const queryKey = seatingKeys.host(celebrationId);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchSeatingPlan(celebrationId),
  });
  const guests = useMemo(() => data?.guests ?? [], [data?.guests]);

  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newSeat, setNewSeat] = useState('');
  const [editing, setEditing] = useState<{ index: number; name: string; seat: string } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const save = useMutation({
    mutationFn: (next: SeatingGuest[]) => saveSeatingPlan(celebrationId, next),
    // Optimistic, and rolled back on failure so the page never shows a plan the
    // server doesn't have.
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SeatingPlan>(queryKey);
      queryClient.setQueryData<SeatingPlan>(queryKey, {
        guests: next,
        floorplan_path: previous?.floorplan_path ?? null,
      });
      return { previous };
    },
    onError: (error, _next, context) => {
      console.error('[host-portal] could not save the plan', error);
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setNotice({ tone: 'error', text: 'Couldn’t save your changes. Check your connection and try again.' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Alphabetical so a name is easy to find; each keeps its stored index so an
  // edit lands on the right row.
  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return guests
      .map((guest, index) => ({ guest, index }))
      .filter(
        ({ guest }) =>
          !needle ||
          guest.name.toLocaleLowerCase().includes(needle) ||
          guest.seat.toLocaleLowerCase().includes(needle),
      )
      .sort((a, b) => a.guest.name.localeCompare(b.guest.name, undefined, { sensitivity: 'base' }));
  }, [guests, search]);

  function addGuest() {
    const name = newName.trim();
    if (!name) return;
    save.mutate([...guests, { name, seat: newSeat.trim() }]);
    setNewName('');
    setNewSeat('');
  }

  function commitEdit() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    save.mutate(
      guests.map((guest, index) => (index === editing.index ? { name, seat: editing.seat.trim() } : guest)),
    );
    setEditing(null);
  }

  function exportList() {
    const url = URL.createObjectURL(new Blob([downloadableCsv(guests)], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Seating plan.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (isLoading) return <CentredState busy />;
  if (isError) {
    return (
      <CentredState
        title="We couldn't load the seating plan"
        body="Check your connection and try again."
        action={<ToolButton label="Try again" onPress={() => void refetch()} />}
      />
    );
  }

  const guestPanel = (
    <View style={[S.panel, S.grow]}>
      <View style={S.panelHeader}>
        <AppText variant="heading" style={S.grow}>
          Guest list{guests.length > 0 ? ` · ${guests.length.toLocaleString()}` : ''}
        </AppText>
        {save.isPending ? (
          <AppText variant="caption" tone="secondary">
            Saving…
          </AppText>
        ) : null}
        {guests.length > 0 ? <ToolButton label="Export" onPress={exportList} /> : null}
        <ToolButton label="Import list" tone={guests.length === 0 ? 'primary' : 'default'} onPress={() => setImportOpen(true)} />
      </View>

      <View style={S.addRow}>
        <View style={S.grow}>
          <CompactInput label="New guest's name" placeholder="Guest name" value={newName} onChangeText={setNewName} onSubmit={addGuest} />
        </View>
        <View style={S.grow}>
          <CompactInput label="New guest's seat" placeholder="Table 4, Seat 2" value={newSeat} onChangeText={setNewSeat} onSubmit={addGuest} />
        </View>
        <ToolButton label="Add" disabled={!newName.trim()} onPress={addGuest} />
      </View>

      {guests.length > 8 ? (
        <CompactInput label="Search guests" placeholder="Search names or tables" value={search} onChangeText={setSearch} onSubmit={() => {}} />
      ) : null}

      {guests.length === 0 ? (
        <CentredState title="No guests yet" body="Add guests one by one, or bring in your whole list at once." />
      ) : rows.length === 0 ? (
        <CentredState title="No one matches" body="Try a different name or table." />
      ) : (
        <View style={S.table}>
          {rows.map(({ guest, index }, position) => (
            <View
              key={`${index}-${guest.name}`}
              style={[S.row, position > 0 && S.rowDivider, !isDesktop && editing?.index === index && S.rowWrap]}
            >
              {editing?.index === index ? (
                <>
                  <View style={S.editField}>
                    <CompactInput
                      label="Guest's name"
                      placeholder="Guest name"
                      value={editing.name}
                      onChangeText={(name) => setEditing({ ...editing, name })}
                      onSubmit={commitEdit}
                      autoFocus
                    />
                  </View>
                  <View style={S.editField}>
                    <CompactInput
                      label="Guest's seat"
                      placeholder="Table 4, Seat 2"
                      value={editing.seat}
                      onChangeText={(seat) => setEditing({ ...editing, seat })}
                      onSubmit={commitEdit}
                    />
                  </View>
                  <ToolButton label="Save" tone="primary" disabled={!editing.name.trim()} onPress={commitEdit} />
                  <ToolButton label="Cancel" onPress={() => setEditing(null)} />
                </>
              ) : (
                <>
                  <View style={[S.grow, S.guest, isDesktop && S.guestDesktop]}>
                    <AppText variant="labelLarge" numberOfLines={1} style={isDesktop && S.grow}>
                      {guest.name}
                    </AppText>
                    <AppText
                      variant="bodySmall"
                      numberOfLines={1}
                      style={[isDesktop && S.grow, guest.seat ? S.seat : S.noSeat]}
                    >
                      {guest.seat || 'No seat yet'}
                    </AppText>
                  </View>
                  <ToolButton
                    label="Edit"
                    accessibilityLabel={`Edit ${guest.name}`}
                    onPress={() => setEditing({ index, name: guest.name, seat: guest.seat })}
                  />
                  <ToolButton
                    label="Remove"
                    tone="danger"
                    accessibilityLabel={`Remove ${guest.name}`}
                    onPress={() => setPendingRemove(index)}
                  />
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const floorplanPanel = (
    <FloorplanPanel celebrationId={celebrationId} path={data?.floorplan_path ?? null} onNotice={setNotice} />
  );

  return (
    <Page>
      <View style={S.heading}>
        <AppText variant="titleLarge">Seating</AppText>
        <AppText variant="bodySmall" tone="secondary">
          Guests look up their table by name when they join, and can open the floor plan to find it.
        </AppText>
      </View>

      {notice ? (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      {isDesktop ? (
        <View style={S.columns}>
          {guestPanel}
          <View style={S.sideColumn}>{floorplanPanel}</View>
        </View>
      ) : (
        <>
          {floorplanPanel}
          {guestPanel}
        </>
      )}

      <ImportDialog
        visible={importOpen}
        guests={guests}
        onImport={(next) => save.mutate(next)}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmDialog
        visible={pendingRemove !== null}
        title={`Remove ${pendingRemove !== null ? (guests[pendingRemove]?.name ?? 'this guest') : 'this guest'}?`}
        body="They will no longer be able to look up their seat."
        confirmLabel="Remove"
        onConfirm={() => {
          save.mutate(guests.filter((_, index) => index !== pendingRemove));
          setPendingRemove(null);
        }}
        onClose={() => setPendingRemove(null)}
      />
    </Page>
  );
}

const PLAN_IMAGE_STYLE = {
  display: 'block',
  width: '100%',
  maxHeight: 520,
  objectFit: 'contain',
} as const;

const S = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
  },
  sideColumn: {
    width: 400,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  panel: {
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.lg,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  panelHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    height: 36,
    width: '100%',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    color: colours.textPrimary,
    fontFamily: typography.bodySmall.fontFamily,
    fontSize: typography.bodySmall.fontSize,
  },
  table: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
  },
  rowWrap: {
    flexWrap: 'wrap',
  },
  guest: {
    gap: spacing.xxs,
  },
  guestDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editField: {
    flexGrow: 1,
    flexBasis: 140,
  },
  seat: {
    color: colours.accentWarm,
  },
  noSeat: {
    color: colours.textSecondary,
  },
  planFrame: {
    minHeight: 200,
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colours.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  planEmpty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    borderStyle: 'dashed',
    borderColor: colours.borderStrong,
  },
  dropActive: {
    borderColor: colours.brandPrimary,
    backgroundColor: colours.surfaceRaised,
  },
  importDrop: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: layout.hairline,
    borderStyle: 'dashed',
    borderColor: colours.borderStrong,
  },
  importInput: {
    minHeight: 120,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  preview: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colours.surface,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
