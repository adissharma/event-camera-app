import { STORAGE_BUCKETS } from '@/config/app-config';
import { requireSupabase } from '@/lib/supabase/client';
import { readLocalImageBytes } from '@/features/media/read-local-image';
import { buildFloorplanPath, IMMUTABLE_CACHE_SECONDS } from '@/features/media/storage-paths';
import { loadStoredGuestSessionByCelebrationId } from '@/services/guest-session';

/** One guest and where they sit, e.g. "Table 4" or "Table 4, Seat 2". */
export type SeatingGuest = { name: string; seat: string };
export type SeatingPlan = { guests: SeatingGuest[]; floorplan_path: string | null };

type StoredGuest = { name?: unknown; seat?: unknown; table?: unknown };

/**
 * Rows saved before seating collapsed to a single location field carried a
 * separate `table`. Folding it into `seat` keeps those plans readable rather
 * than silently dropping the table half.
 */
export function normaliseSeatingGuests(raw: unknown): SeatingGuest[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row: StoredGuest) => {
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    if (!name) return [];
    const parts = [row.table, row.seat]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return [{ name, seat: parts.join(', ') }];
  });
}

export async function fetchSeatingPlan(celebrationId: string): Promise<SeatingPlan> {
  const { data, error } = await (requireSupabase() as any).from('event_seating')
    .select('guests,floorplan_path').eq('celebration_id', celebrationId).maybeSingle();
  if (error) throw error;
  return { guests: normaliseSeatingGuests(data?.guests), floorplan_path: data?.floorplan_path ?? null };
}

export async function saveSeatingPlan(celebrationId: string, guests: SeatingGuest[]) {
  const { error } = await (requireSupabase() as any).from('event_seating').upsert({
    celebration_id: celebrationId, guests, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Puts the host's floor plan image on the event, replacing any previous one.
 *
 * The new object gets its own versioned path, the row is pointed at it, and
 * only then is the old file removed — so a failed upload never leaves the
 * event without the plan it already had.
 */
export async function uploadSeatingFloorplan(
  celebrationId: string,
  file: { uri: string; mimeType: 'image/png' | 'image/jpeg' },
): Promise<string> {
  const client = requireSupabase() as any;
  const { data: celebration, error } = await client
    .from('celebrations').select('workspace_id').eq('id', celebrationId).single();
  if (error || !celebration) throw error ?? new Error('Could not find the event');

  const { data: existing } = await client
    .from('event_seating').select('floorplan_path').eq('celebration_id', celebrationId).maybeSingle();
  const previousPath: string | null = existing?.floorplan_path ?? null;

  const { bytes } = await readLocalImageBytes(file.uri);
  const path = buildFloorplanPath(
    celebration.workspace_id, celebrationId, file.mimeType === 'image/png' ? 'png' : 'jpg',
  );
  const { error: uploadError } = await client.storage.from(STORAGE_BUCKETS.covers).upload(path, bytes, {
    contentType: file.mimeType, upsert: false, cacheControl: IMMUTABLE_CACHE_SECONDS,
  });
  if (uploadError) throw uploadError;

  const { error: saveError } = await client.from('event_seating').upsert({
    celebration_id: celebrationId, floorplan_path: path, updated_at: new Date().toISOString(),
  });
  if (saveError) throw saveError;

  if (previousPath && previousPath !== path) {
    const { error: removeError } = await client.storage.from(STORAGE_BUCKETS.covers).remove([previousPath]);
    if (removeError) console.warn('[seating] could not remove the previous floor plan', removeError);
  }
  return path;
}

export async function removeSeatingFloorplan(celebrationId: string, path: string) {
  const client = requireSupabase() as any;
  const { error } = await client.from('event_seating')
    .update({ floorplan_path: null, updated_at: new Date().toISOString() })
    .eq('celebration_id', celebrationId);
  if (error) throw error;
  const { error: removeError } = await client.storage.from(STORAGE_BUCKETS.covers).remove([path]);
  if (removeError) console.warn('[seating] could not remove the floor plan file', removeError);
}

export type GuestSeatSearch = { hasPlan: boolean; floorplanPath: string | null; matches: SeatingGuest[] };

function readFloorplanPath(data: any): string | null {
  return typeof data?.floorplan_path === 'string' && data.floorplan_path ? data.floorplan_path : null;
}

/**
 * A guest's search of the seating plan.
 *
 * The server returns only names matching the query (two characters or more),
 * never the whole plan, and says whether the host has added any seats at all
 * so the event page can hide the entry point when there is nothing to find.
 */
export async function searchGuestSeating(celebrationId: string, query: string): Promise<GuestSeatSearch> {
  const found = await loadStoredGuestSessionByCelebrationId(celebrationId);
  if (!found) return { hasPlan: false, floorplanPath: null, matches: [] };
  const { data, error } = await (requireSupabase() as any).rpc('search_guest_seating', {
    p_event_code: found.slug, p_guest_token: found.session.guestToken, p_query: query,
  });
  if (error) throw error;
  return {
    hasPlan: Boolean(data?.has_plan),
    floorplanPath: readFloorplanPath(data),
    matches: normaliseSeatingGuests(data?.matches),
  };
}

/**
 * The same search from the join screen, before the guest has a token.
 *
 * Any failure — including a backend that has not yet been migrated — reads
 * as "no plan", so the join screen falls back to the plain name field rather
 * than blocking entry.
 */
export async function searchSeatingByCode(eventCode: string, query: string): Promise<GuestSeatSearch> {
  try {
    const { data, error } = await (requireSupabase() as any).rpc('search_event_seating_by_code', {
      p_event_code: eventCode, p_query: query,
    });
    if (error) throw error;
    return {
      hasPlan: Boolean(data?.has_plan),
      floorplanPath: readFloorplanPath(data),
      matches: normaliseSeatingGuests(data?.matches),
    };
  } catch {
    return { hasPlan: false, floorplanPath: null, matches: [] };
  }
}

export const seatingKeys = {
  host: (celebrationId: string) => ['seating', celebrationId] as const,
  guestSearch: (celebrationId: string, query: string) => ['seating', 'guest', celebrationId, query] as const,
  codeSearch: (eventCode: string, query: string) => ['seating', 'code', eventCode, query] as const,
};

const NAME_HEADERS = ['name', 'guest', 'guest name', 'full name'];
const SEAT_HEADERS = ['table', 'seat', 'seat location', 'location', 'table number', 'seat number'];

function labelBareNumber(value: string, header: string): string {
  const trimmed = value.trim();
  if (!/^\d+[a-z]?$/i.test(trimmed)) return trimmed;
  if (header.startsWith('table')) return `Table ${trimmed}`;
  if (header.startsWith('seat')) return `Seat ${trimmed}`;
  return trimmed;
}

function splitRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { fields.push(value.trim()); value = ''; }
    else value += char;
  }
  fields.push(value.trim());
  return fields;
}

/**
 * Turns a CSV file or a pasted list into guests.
 *
 * Each line is a name followed by where they sit; everything after the name is
 * the seat, so "Sam Lee, Table 3, Seat 4" keeps both halves. Rows copied out
 * of a spreadsheet arrive tab-separated and are read the same way. A header
 * row is optional — when present, its name and table/seat columns are used
 * and any other columns are ignored.
 */
export function parseSeatingList(text: string): SeatingGuest[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : ',';
  const rows = lines.map((line) => splitRow(line, delimiter));

  const header = rows[0].map((field) => field.toLowerCase());
  const nameIndex = header.findIndex((field) => NAME_HEADERS.includes(field));
  const hasHeader = nameIndex >= 0;
  const seatIndexes = hasHeader
    ? header.flatMap((field, index) => (SEAT_HEADERS.includes(field) ? [index] : []))
    : [];

  return rows.slice(hasHeader ? 1 : 0).flatMap((row) => {
    const name = (hasHeader ? row[nameIndex] : row[0])?.trim() ?? '';
    if (!name) return [];
    // A bare number under a "Table" or "Seat" header borrows the header as
    // its label, so 8 and 1 read as "Table 8, Seat 1" rather than "8, 1".
    const seatParts = hasHeader
      ? seatIndexes.map((index) => labelBareNumber(row[index] ?? '', header[index]))
      : row.slice(1);
    return [{ name, seat: seatParts.map((part) => part.trim()).filter(Boolean).join(', ') }];
  });
}

/**
 * Adds imported guests to a plan. A name already on the plan (ignoring case)
 * is updated in place rather than duplicated, so importing a corrected list
 * twice is safe.
 */
export function mergeSeatingGuests(existing: SeatingGuest[], imported: SeatingGuest[]) {
  const guests = [...existing];
  const indexByName = new Map(guests.map((guest, index) => [guest.name.toLocaleLowerCase(), index]));
  let added = 0;
  let updated = 0;
  for (const guest of imported) {
    const key = guest.name.toLocaleLowerCase();
    const index = indexByName.get(key);
    if (index === undefined) {
      indexByName.set(key, guests.length);
      guests.push(guest);
      added += 1;
    } else {
      // An import with no seat for someone never wipes the seat they had.
      if (guest.seat && guest.seat !== guests[index].seat) updated += 1;
      guests[index] = { name: guests[index].name, seat: guest.seat || guests[index].seat };
    }
  }
  return { guests, added, updated };
}
