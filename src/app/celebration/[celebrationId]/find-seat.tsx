import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { loadStoredGuestSessionByCelebrationId } from '@/services/guest-session';
import { searchGuestSeating, seatingKeys, type SeatingGuest } from '@/services/seating';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || '?';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

/** Waits for typing to pause so each keystroke is not its own request. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Where a guest looks up their seat.
 *
 * Opens already searching for the name the guest joined with, so in the
 * common case the answer is on screen before they touch anything. The field
 * stays editable because the name a guest typed at the door ("Sam") is often
 * not the name on the host's plan ("Samantha Lee").
 */
export default function FindSeatScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const id = String(celebrationId);

  const [query, setQuery] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    let active = true;
    void loadStoredGuestSessionByCelebrationId(id).then((found) => {
      if (!active) return;
      if (found?.session.displayName) setQuery(found.session.displayName);
      setPrefilled(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const trimmed = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: seatingKeys.guestSearch(id, trimmed.toLocaleLowerCase()),
    queryFn: () => searchGuestSeating(id, trimmed),
    enabled: prefilled && canSearch,
    placeholderData: keepPreviousData,
  });

  const matches = canSearch ? data?.matches ?? [] : [];
  const exact = matches.find(
    (guest) => guest.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
  );
  const others = exact ? matches.filter((guest) => guest !== exact) : matches;

  return (
    <Screen>
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

      <View style={styles.hero}>
        <AppText variant="titleLarge">Find your seat</AppText>
        <AppText variant="body" tone="secondary">
          Search for your name to see where you&apos;re sitting.
        </AppText>
      </View>

      <TextField
        label="Your name"
        value={query}
        onChangeText={setQuery}
        placeholder="Start typing your name"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        containerStyle={styles.field}
      />

      {exact ? <SeatHero guest={exact} /> : null}

      {!canSearch ? (
        <AppText variant="bodySmall" tone="secondary" style={styles.message}>
          Type at least two letters of your name.
        </AppText>
      ) : isError ? (
        <View style={styles.messageRow}>
          <AppText variant="bodySmall" tone="secondary">
            We couldn&apos;t search the seating plan.
          </AppText>
          <Pressable onPress={() => void refetch()} hitSlop={8}>
            <AppText variant="bodySmall" style={styles.retry}>Try again</AppText>
          </Pressable>
        </View>
      ) : data && matches.length === 0 && !isFetching ? (
        <AppText variant="bodySmall" tone="secondary" style={styles.message}>
          No one by that name on the seating plan. Check the spelling, or ask your host.
        </AppText>
      ) : null}

      {others.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <AppText variant="eyebrow" tone="secondary">
              {exact ? 'Other matches' : 'Matches'}
            </AppText>
            {isFetching ? <ActivityIndicator size="small" color={colours.textSecondary} /> : null}
          </View>
          <View style={styles.card}>
            {others.map((guest, position) => (
              <View key={`${guest.name}-${position}`}>
                {position > 0 ? <View style={styles.separator} /> : null}
                <View
                  style={styles.row}
                  accessible
                  accessibilityLabel={`${guest.name}, ${guest.seat || 'seat to be confirmed'}`}
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
                      {guest.seat || 'Seat to be confirmed'}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** The answer, when the search lands on exactly one name. */
function SeatHero({ guest }: { guest: SeatingGuest }) {
  return (
    <View
      style={styles.heroCard}
      accessible
      accessibilityLabel={`${guest.name}, ${guest.seat || 'seat to be confirmed'}`}
    >
      <AppText variant="eyebrow" tone="secondary">{guest.name}</AppText>
      <AppText variant="displayLarge" style={guest.seat ? styles.heroSeat : styles.heroSeatMissing}>
        {guest.seat || 'Seat to be confirmed'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
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
  field: {
    marginBottom: spacing.lg,
  },
  heroCard: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  heroSeat: {
    color: colours.accentWarm,
  },
  heroSeatMissing: {
    color: colours.textSecondary,
  },
  message: {
    paddingHorizontal: spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  retry: {
    color: colours.textPrimary,
    textDecorationLine: 'underline',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 64,
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
});
