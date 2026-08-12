import { requireSupabase } from '@/lib/supabase/client';
import { loadStoredGuestSessionByCelebrationId } from '@/services/guest-session';

export interface GuestbookMessageRecord {
  id: string;
  storagePath: string;
  capturedAt: string | null;
  displayName?: string | null;
  guestSessionId?: string | null;
  mediaType: 'audio' | 'video';
  durationMs: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  isMine?: boolean;
}

export interface GuestbookRecord {
  id: string;
  celebrationId: string;
  instructions: string;
  icon: string;
}

export interface HostGuestbookPayload {
  guestbook: GuestbookRecord;
  messages: GuestbookMessageRecord[];
}

export interface GuestGuestbookPayload {
  guestbook: GuestbookRecord;
  guest: {
    id: string;
    displayName: string;
  };
  messages: GuestbookMessageRecord[];
  eventCode: string;
  guestToken: string;
  guestSessionId: string;
}

function mapGuestbookRecord(value: any): GuestbookRecord {
  return {
    id: String(value?.id ?? ''),
    celebrationId: String(value?.celebration_id ?? ''),
    instructions:
      typeof value?.instructions === 'string' && value.instructions.trim().length > 0
        ? value.instructions
        : 'Leave a message for the host.',
    icon: typeof value?.icon === 'string' && value.icon.trim().length > 0 ? value.icon : '💌',
  };
}

function mapGuestbookMessage(value: any): GuestbookMessageRecord | null {
  const mediaType = value?.media_type;
  if (mediaType !== 'audio' && mediaType !== 'video') return null;
  if (typeof value?.storage_path !== 'string' || value.storage_path.length === 0) return null;

  return {
    id: String(value.id ?? ''),
    storagePath: value.storage_path,
    capturedAt: typeof value.captured_at === 'string' ? value.captured_at : null,
    displayName: typeof value.display_name === 'string' ? value.display_name : null,
    guestSessionId: typeof value.guest_session_id === 'string' ? value.guest_session_id : null,
    mediaType,
    durationMs: typeof value.duration_ms === 'number' ? value.duration_ms : null,
    mimeType: typeof value.mime_type === 'string' ? value.mime_type : null,
    width: typeof value.width === 'number' ? value.width : null,
    height: typeof value.height === 'number' ? value.height : null,
    isMine: value.is_mine === true,
  };
}

export async function fetchHostGuestbook(celebrationId: string): Promise<HostGuestbookPayload> {
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_host_guestbook', {
    p_celebration_id: celebrationId,
  });

  if (error) throw error;

  return {
    guestbook: mapGuestbookRecord(data?.guestbook),
    messages: Array.isArray(data?.messages)
      ? data.messages.map(mapGuestbookMessage).filter((item: GuestbookMessageRecord | null): item is GuestbookMessageRecord => item !== null)
      : [],
  };
}

export async function fetchGuestGuestbook(celebrationId: string): Promise<GuestGuestbookPayload> {
  const found = await loadStoredGuestSessionByCelebrationId(celebrationId);
  if (!found) {
    throw new Error('This device is not joined to the event as a guest.');
  }

  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_guest_guestbook', {
    p_event_code: found.slug,
    p_guest_token: found.session.guestToken,
  });

  if (error) throw error;

  return {
    guestbook: mapGuestbookRecord(data?.guestbook),
    guest: {
      id: String(data?.guest?.id ?? found.session.guestSessionId),
      displayName: String(data?.guest?.display_name ?? found.session.displayName),
    },
    messages: Array.isArray(data?.messages)
      ? data.messages.map(mapGuestbookMessage).filter((item: GuestbookMessageRecord | null): item is GuestbookMessageRecord => item !== null)
      : [],
    eventCode: found.slug,
    guestToken: found.session.guestToken,
    guestSessionId: found.session.guestSessionId,
  };
}

export async function upsertGuestbookInstructions(
  celebrationId: string,
  instructions: string,
  icon = '💌',
): Promise<GuestbookRecord> {
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('upsert_event_guestbook', {
    p_celebration_id: celebrationId,
    p_instructions: instructions,
    p_icon: icon,
  });

  if (error) throw error;
  return mapGuestbookRecord(data);
}
