import AsyncStorage from '@react-native-async-storage/async-storage';

import { requireSupabase, isBackendConfigured } from '@/lib/supabase/client';
import { loadStoredGuestSessionByCelebrationId } from '@/services/guest-session';

/**
 * Challenges, as the whole app sees them.
 *
 * These used to live only in `AsyncStorage` under
 * `__mock_challenges_<celebrationId>`, which meant a host's titles and "Guest
 * instructions" never left the device that typed them — every guest fell back
 * to the hardcoded defaults. They are now rows in `public.event_challenges`,
 * and this module is the single door to them:
 *
 * - **Hosts** read and write the table directly; RLS scopes it to celebrations
 *   they manage.
 * - **Guests** have no authenticated identity, so they read through the
 *   `get_guest_challenges` RPC, which validates their guest token. They cannot
 *   write, which is correct — challenges are the host's brief to them.
 *
 * The local key is still read once per event, to migrate anything a host
 * configured before this existed. See `listChallenges`.
 */

export interface EventChallenge {
  id: string;
  label: string;
  icon: string;
  instructions: string | null;
  /** Cover thumbnail for the challenge ring; null renders the icon instead. */
  photoUri: string | null;
  sortOrder: number;
}

/** Shape used when seeding, where the row does not exist yet. */
export interface NewChallenge {
  label: string;
  icon: string;
  instructions?: string | null;
  photoUri?: string | null;
}

export const legacyChallengesKey = (celebrationId: string) =>
  `__mock_challenges_${celebrationId}`;

/** Marks a celebration's local challenges as already migrated to the server. */
const migratedKey = (celebrationId: string) =>
  `__challenges_migrated_${celebrationId}`;

function fromRow(row: any): EventChallenge {
  return {
    id: String(row.id),
    label: row.label ?? '',
    icon: row.icon ?? 'confetti',
    instructions: row.instructions ?? null,
    photoUri: row.photo_uri ?? row.photoUri ?? null,
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
  };
}

/** Reads whatever a host configured on this device before challenges synced. */
async function readLegacyLocal(celebrationId: string): Promise<NewChallenge[]> {
  try {
    const stored = await AsyncStorage.getItem(legacyChallengesKey(celebrationId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.label === 'string' && typeof item.icon === 'string')
      .map((item) => ({
        label: item.label,
        icon: item.icon,
        instructions: typeof item.instructions === 'string' ? item.instructions : null,
        photoUri: typeof item.photo === 'string' ? item.photo : null,
      }));
  } catch {
    return [];
  }
}

/**
 * The challenge list for an event, from the server.
 *
 * `defaults` is what a brand-new event should start with. It is only consulted
 * for a host, and only when the event has no challenges at all — a guest never
 * seeds, because inventing a challenge list on the guest's device is precisely
 * the bug this replaced.
 *
 * On a host's first load the device's pre-sync local list wins over `defaults`,
 * so challenges configured before challenges synced are carried up rather than
 * silently replaced by the stock set.
 */
export async function listChallenges(
  celebrationId: string,
  defaults: NewChallenge[] = [],
): Promise<EventChallenge[] | null> {
  if (!isBackendConfigured) return null;

  const client = requireSupabase();

  const { data, error } = await client
    .from('event_challenges')
    .select('id, label, icon, instructions, photo_uri, sort_order')
    .eq('celebration_id', celebrationId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!error && data && data.length > 0) return data.map(fromRow);

  // An empty result is ambiguous: RLS hides rows by filtering them out, not by
  // erroring, so a guest and a host with a genuinely empty event look
  // identical here. Try to seed — the RPC is the thing that can actually
  // decide, since it checks `can_manage_celebration`. A guest is refused, and
  // falls through to the guest read below.
  if (!error && data) {
    const alreadyMigrated = await AsyncStorage.getItem(migratedKey(celebrationId));
    const local = alreadyMigrated ? [] : await readLegacyLocal(celebrationId);
    const seed = local.length > 0 ? local : defaults;

    // Always attempt this, even with an empty `seed` — the RPC's manager
    // check is the only reliable way to tell "a host whose event genuinely
    // has zero challenges" from "a guest with no read access at all", and an
    // empty `p_challenges` array is a safe no-op insert. Without this, a host
    // on a brand-new event fell through to the guest branch below and came
    // back `null`, which sent every screen back to its old local/defaults
    // fallback instead of a real empty list.
    try {
      const seeded = await seedChallenges(celebrationId, seed);
      if (seed.length > 0) await AsyncStorage.setItem(migratedKey(celebrationId), '1');
      return seeded;
    } catch {
      // Not a manager of this event. Fall through and read as a guest.
    }
  }

  // Not a host for this event (or not signed in at all): read as a guest.
  const guest = await loadStoredGuestSessionByCelebrationId(celebrationId);
  if (!guest) {
    console.error('[challenges] no host or guest access to challenges', {
      celebrationId,
      message: error?.message,
    });
    return null;
  }

  const { data: guestData, error: guestError } = await (client as any).rpc(
    'get_guest_challenges',
    { p_event_code: guest.slug, p_guest_token: guest.session.guestToken },
  );

  if (guestError || !guestData) {
    console.error('[challenges] guest challenge read failed', guestError);
    return null;
  }

  const rows = Array.isArray(guestData.challenges) ? guestData.challenges : [];
  return rows.map(fromRow);
}

/** Inserts `challenges` only if the event has none. Host only. */
export async function seedChallenges(
  celebrationId: string,
  challenges: NewChallenge[],
): Promise<EventChallenge[]> {
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('seed_event_challenges_if_empty', {
    p_celebration_id: celebrationId,
    p_challenges: challenges.map((c, index) => ({
      label: c.label,
      icon: c.icon,
      instructions: c.instructions ?? '',
      photo_uri: c.photoUri ?? '',
      sort_order: index,
    })),
  });

  if (error) throw error;
  const rows = Array.isArray(data?.challenges) ? data.challenges : [];
  return rows.map(fromRow);
}

export async function createChallenge(
  celebrationId: string,
  challenge: NewChallenge & { sortOrder?: number },
): Promise<EventChallenge> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('event_challenges')
    .insert({
      celebration_id: celebrationId,
      label: challenge.label,
      icon: challenge.icon,
      instructions: challenge.instructions ?? null,
      photo_uri: challenge.photoUri ?? null,
      sort_order: challenge.sortOrder ?? 0,
    } as any)
    .select('id, label, icon, instructions, photo_uri, sort_order')
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function updateChallenge(
  challengeId: string,
  patch: Partial<Pick<EventChallenge, 'label' | 'icon' | 'instructions' | 'photoUri' | 'sortOrder'>>,
): Promise<void> {
  const client = requireSupabase();
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.instructions !== undefined) row.instructions = patch.instructions;
  if (patch.photoUri !== undefined) row.photo_uri = patch.photoUri;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (Object.keys(row).length === 0) return;

  const { error } = await client
    .from('event_challenges')
    .update(row as any)
    .eq('id', challengeId);

  if (error) throw error;
}

/**
 * Reconciles the event's challenges against `next`, in one pass.
 *
 * For screens that edit the whole list at once rather than a single row: the
 * creation/edit step builds an array in local state and saves it wholesale.
 * Rows whose id is already on the server are updated in place — which keeps
 * their id, and therefore keeps any submissions pointing at them — rows with a
 * client-invented id are inserted, and rows the host removed are soft-deleted.
 */
export async function replaceChallenges(
  celebrationId: string,
  next: { id?: string; label: string; icon: string; instructions?: string | null; photoUri?: string | null }[],
): Promise<EventChallenge[]> {
  const client = requireSupabase();

  const { data: current, error } = await client
    .from('event_challenges')
    .select('id')
    .eq('celebration_id', celebrationId)
    .is('deleted_at', null);

  if (error) throw error;

  const currentIds = new Set((current ?? []).map((row: any) => String(row.id)));
  const keptIds = new Set<string>();

  for (const [index, item] of next.entries()) {
    if (item.id && currentIds.has(item.id)) {
      keptIds.add(item.id);
      await updateChallenge(item.id, {
        label: item.label,
        icon: item.icon,
        instructions: item.instructions ?? null,
        photoUri: item.photoUri ?? null,
        sortOrder: index,
      });
    } else {
      const created = await createChallenge(celebrationId, {
        label: item.label,
        icon: item.icon,
        instructions: item.instructions ?? null,
        photoUri: item.photoUri ?? null,
        sortOrder: index,
      });
      keptIds.add(created.id);
    }
  }

  await Promise.all(
    [...currentIds]
      .filter((id) => !keptIds.has(id))
      .map((id) => deleteChallenge(id)),
  );

  return (await listChallenges(celebrationId)) ?? [];
}

/**
 * Soft-deletes, matching how media is removed. The challenge's submissions are
 * left alone deliberately — they are real photographs guests took, and they
 * stay in the main gallery even once the prompt that asked for them is gone.
 */
export async function deleteChallenge(challengeId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('event_challenges')
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq('id', challengeId);

  if (error) throw error;
}
