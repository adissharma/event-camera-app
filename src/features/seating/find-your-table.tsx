import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { CloseIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { searchSeatingByCode, seatingKeys, type SeatingGuest } from '@/services/seating';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 200;
const NAME_MAX_LENGTH = 50;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface FindYourTableProps {
  visible: boolean;
  eventCode: string;
  /** Whatever the guest had already typed, so opening the sheet loses nothing. */
  initialQuery?: string;
  isJoining?: boolean;
  error?: string | null;
  onClose: () => void;
  /** Joins under this name — the plan's spelling when they picked themselves. */
  onJoin: (name: string) => void;
}

/**
 * The join screen's name field, when the host has a seating plan.
 *
 * Entering a name and finding a seat are the same act here: the field moves
 * to the top and becomes a filter, the guest taps themselves, sees their
 * table, and joins under the name on the plan — which is also what lets the
 * in-event seat lookup answer instantly later. Not being on the plan is never
 * a dead end; the guest joins under the name they typed.
 */
export function FindYourTable({
  visible,
  eventCode,
  initialQuery = '',
  isJoining = false,
  error,
  onClose,
  onJoin,
}: FindYourTableProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<SeatingGuest | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery);
    setSelected(null);
  }, [visible, initialQuery]);

  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, SEARCH_DEBOUNCE_MS);
  const canSearch = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: seatingKeys.codeSearch(eventCode, debounced.toLocaleLowerCase()),
    queryFn: () => searchSeatingByCode(eventCode, debounced),
    enabled: visible && canSearch,
    placeholderData: keepPreviousData,
  });

  const matches = canSearch && trimmed.length >= MIN_QUERY_LENGTH ? data?.matches ?? [] : [];
  const settled = canSearch && !isFetching && debounced === trimmed;
  const nobodyFound = settled && matches.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={S.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[S.header, { paddingTop: Platform.OS === 'ios' ? spacing.lg : insets.top + spacing.base }]}>
          <AppText variant="titleLarge">Find your table</AppText>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [S.close, pressed && S.pressed]}
          >
            <CloseIcon size={14} />
          </Pressable>
        </View>

        {selected ? (
          <View style={[S.body, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View
              style={S.seatCard}
              accessible
              accessibilityLabel={`${selected.name}, ${selected.seat || 'seat to be confirmed'}`}
            >
              <AppText variant="eyebrow" tone="secondary">
                {selected.seat ? 'You’re seated at' : 'You’re on the list'}
              </AppText>
              <AppText variant="displayLarge" style={selected.seat ? S.seat : S.seatMissing}>
                {selected.seat || 'Seat to be confirmed'}
              </AppText>
              <AppText variant="body" tone="secondary">{selected.name}</AppText>
            </View>

            <View style={S.actions}>
              {error ? (
                <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">{error}</AppText>
              ) : null}
              <Button
                label="Join the event"
                fullWidth
                haptic
                loading={isJoining}
                onPress={() => onJoin(selected.name)}
              />
              <Button
                label="Not you?"
                variant="quiet"
                fullWidth
                disabled={isJoining}
                onPress={() => setSelected(null)}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={S.searchWrap}>
              <TextField
                value={query}
                onChangeText={setQuery}
                placeholder="Start typing your name"
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
                returnKeyType="search"
                clearButtonMode="while-editing"
                maxLength={NAME_MAX_LENGTH}
              />
            </View>

            <ScrollView
              style={S.flex}
              contentContainerStyle={[S.results, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {trimmed.length < MIN_QUERY_LENGTH ? (
                <AppText variant="bodySmall" tone="secondary" style={S.message}>
                  Type your name to see where you’re sitting.
                </AppText>
              ) : null}

              {matches.length > 0 ? (
                <View style={S.card}>
                  {matches.map((guest, position) => (
                    <View key={`${guest.name}-${position}`}>
                      {position > 0 ? <View style={S.separator} /> : null}
                      <Pressable
                        onPress={() => setSelected(guest)}
                        accessibilityRole="button"
                        accessibilityLabel={`${guest.name}, ${guest.seat || 'seat to be confirmed'}`}
                        style={({ pressed }) => [S.row, pressed && S.rowPressed]}
                      >
                        <AppText variant="labelLarge" numberOfLines={1} style={S.flex}>
                          {guest.name}
                        </AppText>
                        <AppText
                          variant="bodySmall"
                          numberOfLines={1}
                          style={guest.seat ? S.seat : S.seatMissing}
                        >
                          {guest.seat || 'To be confirmed'}
                        </AppText>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              {isFetching && matches.length === 0 && trimmed.length >= MIN_QUERY_LENGTH ? (
                <ActivityIndicator color={colours.textSecondary} style={S.spinner} />
              ) : null}

              {nobodyFound ? (
                <View style={S.welcome}>
                  <AppText variant="body">No worries, come on in.</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    We couldn’t find you on the seating plan. Your host can point you to your table.
                  </AppText>
                </View>
              ) : null}

              {trimmed.length > 0 && (nobodyFound || matches.length > 0) ? (
                <View style={S.actions}>
                  {error ? (
                    <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">{error}</AppText>
                  ) : null}
                  {nobodyFound ? (
                    <Button
                      label={`Join as ${trimmed}`}
                      fullWidth
                      haptic
                      loading={isJoining}
                      onPress={() => onJoin(trimmed)}
                    />
                  ) : (
                    <Pressable
                      onPress={() => onJoin(trimmed)}
                      disabled={isJoining}
                      accessibilityRole="button"
                      hitSlop={8}
                      style={S.notListed}
                    >
                      <AppText variant="bodySmall" tone="secondary" align="center">
                        Not on the list?{' '}
                        <AppText variant="bodySmall" style={S.notListedLink}>Join as {trimmed}</AppText>
                      </AppText>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.base,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  pressed: { opacity: 0.8 },
  searchWrap: { paddingHorizontal: layout.gutter, paddingBottom: spacing.base },
  results: { paddingHorizontal: layout.gutter, gap: spacing.base },
  message: { paddingHorizontal: spacing.xs },
  spinner: { marginTop: spacing.lg },
  card: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 56,
  },
  rowPressed: { backgroundColor: colours.surfaceMuted },
  separator: { height: layout.hairline, backgroundColor: colours.borderSubtle, marginLeft: spacing.base },
  seat: { color: colours.accentWarm },
  seatMissing: { color: colours.textSecondary },
  welcome: { gap: spacing.xs, paddingHorizontal: spacing.xs, paddingTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  notListed: { paddingVertical: spacing.sm },
  notListedLink: { color: colours.textPrimary, textDecorationLine: 'underline' },
  body: {
    flex: 1,
    paddingHorizontal: layout.gutter,
    justifyContent: 'space-between',
  },
  seatCard: {
    marginTop: spacing.xl,
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
