-- Guests need the same joined count/list as hosts, but `guest_sessions` remains
-- host-readable only under RLS. This RPC exposes the participants for exactly
-- the event session represented by the caller's guest token.

create or replace function public.get_guest_joined_guests(
  p_celebration_id uuid,
  p_guest_token text
)
returns table (
  id uuid,
  display_name text,
  created_at timestamptz,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.event_sessions%rowtype;
  v_guest public.guest_sessions%rowtype;
begin
  select * into v_session
  from public.event_sessions
  where celebration_id = p_celebration_id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  select * into v_guest
  from public.guest_sessions
  where anonymous_token_hash = private.digest_token(p_guest_token)
    and event_session_id = v_session.id;

  if not found then
    raise exception 'invalid guest session for this event' using errcode = '42501';
  end if;

  return query
  select
    gs.id,
    gs.display_name,
    gs.created_at,
    gs.last_seen_at
  from public.guest_sessions gs
  where gs.event_session_id = v_session.id
  order by gs.created_at desc;
end;
$$;

revoke all on function public.get_guest_joined_guests(uuid, text) from public;
grant execute on function public.get_guest_joined_guests(uuid, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guest_sessions'
  ) then
    alter publication supabase_realtime add table public.guest_sessions;
  end if;
end;
$$;
