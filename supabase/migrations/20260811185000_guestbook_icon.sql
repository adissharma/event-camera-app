-- Persist the Guestbook identity chosen by the host and expose it through the
-- same privacy-gated RPCs as the instructions.
alter table public.event_guestbooks
  add column if not exists guestbook_icon text not null default U&'\+1F48C';

drop function if exists public.upsert_event_guestbook(uuid, text, text);

create or replace function public.upsert_event_guestbook(
  p_celebration_id uuid,
  p_instructions text,
  p_icon text default U&'\+1F48C'
)
returns public.event_guestbooks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_guestbooks%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to manage this guestbook' using errcode = '42501';
  end if;

  insert into public.event_guestbooks (celebration_id, instructions, guestbook_icon)
  values (
    p_celebration_id,
    coalesce(nullif(trim(p_instructions), ''), 'Leave a message for the host.'),
    case
      when p_icon in (U&'\+1F48C', U&'\+1F381', U&'\+1F49B', U&'\+1F31F', U&'\+1F4AB', U&'\+1F338') then p_icon
      else U&'\+1F48C'
    end
  )
  on conflict (celebration_id) do update
    set instructions = excluded.instructions,
        guestbook_icon = excluded.guestbook_icon
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_event_guestbook(uuid, text, text) from public, anon;
grant execute on function public.upsert_event_guestbook(uuid, text, text) to authenticated;

create or replace function public.get_host_guestbook(p_celebration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guestbook public.event_guestbooks%rowtype;
  v_messages jsonb;
begin
  if (select auth.uid()) is null or not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to view this guestbook' using errcode = '42501';
  end if;

  insert into public.event_guestbooks (celebration_id)
  values (p_celebration_id)
  on conflict (celebration_id) do nothing;

  select * into v_guestbook from public.event_guestbooks where celebration_id = p_celebration_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', mi.id, 'storage_path', mi.original_storage_path, 'captured_at', mi.captured_at,
    'display_name', coalesce(gs.display_name, 'Guest'), 'guest_session_id', mi.guest_session_id,
    'media_type', mi.media_type, 'duration_ms', mi.duration_ms, 'mime_type', mi.mime_type,
    'width', mi.width, 'height', mi.height
  ) order by mi.captured_at desc, mi.created_at desc), '[]'::jsonb) into v_messages
  from public.media_items mi
  join public.event_sessions es on es.id = mi.event_session_id
  left join public.guest_sessions gs on gs.id = mi.guest_session_id
  where es.celebration_id = p_celebration_id and es.deleted_at is null
    and mi.status = 'ready' and mi.deleted_at is null
    and coalesce(mi.metadata ->> 'submission_kind', '') = 'guestbook';

  return jsonb_build_object(
    'guestbook', jsonb_build_object('id', v_guestbook.id, 'celebration_id', v_guestbook.celebration_id,
      'instructions', v_guestbook.instructions, 'icon', v_guestbook.guestbook_icon),
    'messages', v_messages
  );
end;
$$;

create or replace function public.get_guest_guestbook(p_event_code text, p_guest_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_guest public.guest_sessions%rowtype;
  v_guestbook public.event_guestbooks%rowtype;
  v_messages jsonb;
begin
  select * into v_celebration from public.celebrations
  where lower(event_code) = trim(lower(p_event_code)) and deleted_at is null and status <> 'draft';
  if not found then raise exception 'event not found or unavailable' using errcode = '42501'; end if;

  select * into v_session from public.event_sessions
  where celebration_id = v_celebration.id and deleted_at is null
  order by sequence_number asc limit 1;
  if not found then raise exception 'event session not found' using errcode = '42501'; end if;

  select * into v_guest from public.guest_sessions
  where anonymous_token_hash = private.digest_token(p_guest_token) and event_session_id = v_session.id;
  if not found then raise exception 'invalid guest session for this event' using errcode = '42501'; end if;

  insert into public.event_guestbooks (celebration_id) values (v_celebration.id)
  on conflict (celebration_id) do nothing;
  select * into v_guestbook from public.event_guestbooks where celebration_id = v_celebration.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', mi.id, 'storage_path', mi.original_storage_path, 'captured_at', mi.captured_at,
    'media_type', mi.media_type, 'duration_ms', mi.duration_ms, 'mime_type', mi.mime_type,
    'width', mi.width, 'height', mi.height, 'is_mine', true
  ) order by mi.captured_at desc, mi.created_at desc), '[]'::jsonb) into v_messages
  from public.media_items mi
  where mi.event_session_id = v_session.id and mi.guest_session_id = v_guest.id
    and mi.status = 'ready' and mi.deleted_at is null
    and coalesce(mi.metadata ->> 'submission_kind', '') = 'guestbook';

  return jsonb_build_object(
    'guestbook', jsonb_build_object('id', v_guestbook.id, 'celebration_id', v_guestbook.celebration_id,
      'instructions', v_guestbook.instructions, 'icon', v_guestbook.guestbook_icon),
    'guest', jsonb_build_object('id', v_guest.id, 'display_name', v_guest.display_name),
    'messages', v_messages
  );
end;
$$;

revoke all on function public.get_host_guestbook(uuid) from public, anon;
grant execute on function public.get_host_guestbook(uuid) to authenticated;
revoke all on function public.get_guest_guestbook(text, text) from public;
grant execute on function public.get_guest_guestbook(text, text) to anon, authenticated;
