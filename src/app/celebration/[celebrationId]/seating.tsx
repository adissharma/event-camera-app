import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';
import {
  fetchSeatingPlan,
  mergeSeatingGuests,
  parseSeatingList,
  saveSeatingPlan,
  type SeatingGuest,
  type SeatingPlan,
} from '@/services/seating';

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || '?';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

/**
 * Reads a CSV the host picks from Files.
 *
 * The picker is loaded on demand rather than imported at the top: it is a
 * native module, and a build that predates it would otherwise fail to open
 * this screen at all instead of just this one button.
 */
async function pickCsvText(): Promise<string | null> {
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoDocumentPicker')) {
    throw new Error('This build does not include the document picker.');
  }
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'public.comma-separated-values-text'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.file) return asset.file.text();
  const { File } = await import('expo-file-system');
  return new File(asset.uri).text();
}

function importSummary(added: number, updated: number) {
  const parts = [];
  if (added > 0) parts.push(`${added} new`);
  if (updated > 0) parts.push(`${updated} already on your plan will get the new seat`);
  return parts.length > 0 ? parts.join(' · ') : 'Everyone here is already on your plan.';
}

/** `null` index means the sheet is adding a new guest rather than editing one. */
type Draft = { index: number | null; name: string; seat: string };

export default function SeatingPlanScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = String(celebrationId);
  const queryKey = useMemo(() => ['seating', id], [id]);
  const seatInputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  // Held apart from `draft` so the sheet keeps its title while it slides away.
  const [isNew, setIsNew] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (shouldBlockHostRouteOnWeb(Platform.OS)) {
      router.replace(`/celebration/${id}`);
    }
  }, [router, id]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchSeatingPlan(id),
    enabled: Boolean(celebrationId),
  });
  const guests = useMemo(() => data?.guests ?? [], [data?.guests]);

  // Alphabetical so the host can find a name in a long list; each entry keeps
  // its stored index so edits land on the right row.
  const sorted = useMemo(
    () => guests
      .map((guest, index) => ({ guest, index }))
      .sort((a, b) => a.guest.name.localeCompare(b.guest.name, undefined, { sensitivity: 'base' })),
    [guests],
  );

  const save = useMutation({
    mutationFn: (next: SeatingGuest[]) => saveSeatingPlan(id, next),
    // Optimistic: the list updates as the sheet closes, and rolls back if the
    // write fails so the screen never shows a plan the server doesn't have.
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
      console.error('[seating] failed to save plan', error);
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      Alert.alert('Could not save', 'Check your connection and try again.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  function openDraft(next: Draft) {
    setNameError(undefined);
    setIsNew(next.index === null);
    setDraft(next);
  }

  function commitDraft({ addAnother }: { addAnother: boolean }) {
    if (!draft) return;
    const name = draft.name.trim();
    const seat = draft.seat.trim();
    if (!name) {
      setNameError('Add the guest’s name.');
      nameInputRef.current?.focus();
      return;
    }
    const entry = { name, seat };
    const next = draft.index === null
      ? [...guests, entry]
      : guests.map((guest, index) => (index === draft.index ? entry : guest));
    save.mutate(next);
    if (addAnother) {
      openDraft({ index: null, name: '', seat: '' });
      nameInputRef.current?.focus();
    } else {
      setDraft(null);
    }
  }

  function removeDraftGuest() {
    if (draft?.index == null) return;
    const index = draft.index;
    const name = guests[index]?.name ?? 'this guest';
    Alert.alert(`Remove ${name}?`, 'They will no longer be able to look up their seat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          save.mutate(guests.filter((_, i) => i !== index));
          setDraft(null);
        },
      },
    ]);
  }

  const parsedImport = useMemo(() => parseSeatingList(importText), [importText]);
  const importPreview = useMemo(
    () => mergeSeatingGuests(guests, parsedImport),
    [guests, parsedImport],
  );

  function openImport() {
    setImportText('');
    setImportOpen(true);
  }

  async function chooseCsvFile() {
    try {
      const text = await pickCsvText();
      if (text === null) return;
      if (parseSeatingList(text).length === 0) {
        Alert.alert('No guests found', 'The file needs a guest name at the start of each row.');
        return;
      }
      // Into the box rather than straight onto the plan, so the host sees
      // what was read and can fix a stray row before anything is saved.
      setImportText(text);
    } catch (error) {
      console.error('[seating] failed to read CSV', error);
      Alert.alert(
        'Could not open the file',
        'Update the app to upload a file, or paste the list into the box instead.',
      );
    }
  }

  function commitImport() {
    if (parsedImport.length === 0) return;
    save.mutate(importPreview.guests);
    setImportOpen(false);
  }

  const backButton = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeftIcon size={20} color={colours.textPrimary} />
      </Pressable>
    </View>
  );

  if (isLoading && !data) {
    return (
      <Screen scrollable={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scrollable={false}>
        {backButton}
        <View style={styles.centered}>
          <AppText variant="titleMedium">Couldn&apos;t load seating</AppText>
          <AppText variant="bodySmall" tone="secondary" align="center">
            We hit a problem loading the seating plan for this event.
          </AppText>
          <Pressable onPress={() => void refetch()} style={styles.textLink}>
            <AppText variant="bodySmall" tone="secondary">Try again</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        stickyAction={
          <Button
            label="Add guest"
            onPress={() => openDraft({ index: null, name: '', seat: '' })}
            haptic
          />
        }
      >
        {backButton}

        <View style={styles.hero}>
          <AppText variant="titleLarge">Seating plan</AppText>
          <AppText variant="body" tone="secondary" style={styles.subtitle}>
            Add each guest and where they&apos;re sitting. Guests can look up their seat from the invitation.
          </AppText>
        </View>

        <View style={styles.sectionHeader}>
          <AppText variant="eyebrow" tone="secondary">
            Guests{guests.length > 0 ? ` · ${guests.length}` : ''}
          </AppText>
          {save.isPending ? (
            <AppText variant="caption" tone="secondary">Saving…</AppText>
          ) : guests.length > 0 ? (
            <Pressable onPress={openImport} hitSlop={10} accessibilityRole="button">
              <AppText variant="label" style={styles.importLink}>Import list</AppText>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          {sorted.length === 0 ? (
            <View style={styles.empty}>
              <AppText variant="titleMedium">No guests yet</AppText>
              <AppText variant="bodySmall" tone="secondary" align="center">
                Add guests one by one, or bring in your whole list at once.
              </AppText>
              <Button
                label="Import a list or CSV"
                variant="secondary"
                size="medium"
                fullWidth={false}
                onPress={openImport}
                style={styles.emptyImport}
              />
            </View>
          ) : (
            sorted.map(({ guest, index }, position) => (
              <View key={`${index}-${guest.name}`}>
                {position > 0 ? <View style={styles.separator} /> : null}
                <Pressable
                  onPress={() => openDraft({ index, name: guest.name, seat: guest.seat })}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${guest.name}, ${guest.seat || 'no seat assigned'}`}
                  accessibilityHint="Edit this guest"
                >
                  <View style={styles.initialsBadge}>
                    <AppText style={styles.initialsText}>{initialsFor(guest.name)}</AppText>
                  </View>
                  <View style={styles.rowText}>
                    <AppText variant="labelLarge" numberOfLines={1}>{guest.name}</AppText>
                    <AppText
                      variant="bodySmall"
                      numberOfLines={1}
                      style={guest.seat ? styles.seat : styles.seatMissing}
                    >
                      {guest.seat || 'No seat yet'}
                    </AppText>
                  </View>
                  <ChevronRightIcon />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </Screen>

      <BottomSheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        title={isNew ? 'Add guest' : 'Edit guest'}
      >
        <TextField
          ref={nameInputRef}
          label="Name"
          value={draft?.name ?? ''}
          onChangeText={(name) => {
            setDraft((current) => (current ? { ...current, name } : current));
            if (nameError) setNameError(undefined);
          }}
          placeholder="Alex Morgan"
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus={isNew && Platform.OS !== 'web'}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => seatInputRef.current?.focus()}
          error={nameError}
        />
        <TextField
          ref={seatInputRef}
          label="Seat"
          value={draft?.seat ?? ''}
          onChangeText={(seat) => setDraft((current) => (current ? { ...current, seat } : current))}
          placeholder="Table 4, Seat 2"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType={isNew ? 'next' : 'done'}
          submitBehavior={isNew ? 'submit' : 'blurAndSubmit'}
          onSubmitEditing={() => commitDraft({ addAnother: isNew })}
          hint={isNew ? 'Press next on the keyboard to add another guest.' : undefined}
        />
        <View style={styles.sheetActions}>
          <Button label={isNew ? 'Add guest' : 'Save'} onPress={() => commitDraft({ addAnother: false })} haptic />
          {isNew ? null : (
            <Button label="Remove guest" variant="quiet" onPress={removeDraftGuest} labelStyle={styles.removeLabel} />
          )}
        </View>
      </BottomSheet>

      <BottomSheet visible={importOpen} onClose={() => setImportOpen(false)} title="Import guests">
        <Button
          label="Choose a CSV file"
          variant="secondary"
          size="medium"
          onPress={() => void chooseCsvFile()}
        />
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <AppText variant="caption" tone="secondary">or paste a list</AppText>
          <View style={styles.orLine} />
        </View>
        <TextField
          label="Guests"
          value={importText}
          onChangeText={setImportText}
          placeholder={'Sam Lee, Table 3, Seat 4\nPriya Shah, Top table'}
          multiline
          autoCapitalize="words"
          autoCorrect={false}
          hint="One guest per line: their name, then where they sit. Rows copied from a spreadsheet work too."
          inputStyle={styles.importInput}
        />
        <View style={styles.sheetActions}>
          {parsedImport.length > 0 ? (
            <AppText variant="caption" tone="secondary" align="center">
              {importSummary(importPreview.added, importPreview.updated)}
            </AppText>
          ) : null}
          <Button
            label={parsedImport.length > 0 ? `Import ${parsedImport.length} ${parsedImport.length === 1 ? 'guest' : 'guests'}` : 'Import guests'}
            onPress={commitImport}
            disabled={parsedImport.length === 0}
            disabledReason="Add at least one guest name."
            haptic
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  textLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  subtitle: {
    maxWidth: 520,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  rowPressed: {
    backgroundColor: colours.surfaceRaised,
  },
  separator: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
    marginLeft: spacing.base + 40 + spacing.md,
  },
  initialsBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.brandPrimary,
  },
  initialsText: {
    color: colours.textOnBrand,
    fontFamily: 'InstrumentSans_700Bold',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  seat: {
    color: colours.accentWarm,
  },
  seatMissing: {
    color: colours.textSecondary,
  },
  sheetActions: {
    gap: spacing.sm,
  },
  importLink: {
    color: colours.accentWarm,
  },
  emptyImport: {
    marginTop: spacing.md,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  orLine: {
    flex: 1,
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
  },
  importInput: {
    minHeight: 132,
    maxHeight: 220,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  removeLabel: {
    color: colours.error,
  },
});
