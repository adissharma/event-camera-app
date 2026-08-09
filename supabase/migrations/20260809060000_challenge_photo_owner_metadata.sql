-- Return challenge submission ownership metadata to every client path.
--
-- The story viewer decides whether to show the delete menu by comparing the
-- current viewer identity with the actual uploader stored on media_items.
-- These fields are identifiers only; guests still receive rows only after the
-- guest-token gate below succeeds.

create or replace function public.get_host_challenge_photos(
  p_celebration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.event_sessions%rowtype;
  v_challenge_photos jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to view challenge submissions for this event' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = p_celebration_id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    return jsonb_build_object('challenge_photos', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'storage_path', mi.original_storage_path,
      'captured_at', mi.captured_at,
      'display_name', coalesce(g.display_name, 'Host'),
      'challenge_id', mi.metadata ->> 'challenge_id',
      'guest_session_id', mi.guest_session_id,
      'uploaded_by_user_id', mi.uploaded_by_user_id,
      'is_mine',
        mi.uploaded_by_user_id = (select auth.uid())
        or mi.guest_session_id is null
    )
    order by mi.captured_at desc
  ), '[]'::jsonb) into v_challenge_photos
  from public.media_items mi
  left join public.guest_sessions g on g.id = mi.guest_session_id
  where mi.event_session_id = v_session.id
    and mi.status = 'ready'
    and mi.deleted_at is null
    and mi.metadata ? 'challenge_id';

  return jsonb_build_object('challenge_photos', v_challenge_photos);
end;
$$;

comment on function public.get_host_challenge_photos(uuid) is
  'Returns all ready, undeleted challenge submissions for a host-managed celebration, including uploader metadata for client-side ownership checks.';

revoke all on function public.get_host_challenge_photos from public, anon;
grant execute on function public.get_host_challenge_photos to authenticated;

create or replace function public.get_guest_challenge_photos(
  p_event_code text,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_guest public.guest_sessions%rowtype;
  v_clean_code text;
  v_challenge_photos jsonb;
begin
  v_clean_code := trim(lower(p_event_code));

  select * into v_celebration
  from public.celebrations
  where lower(event_code) = v_clean_code
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'event not found or unavailable' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'storage_path', mi.original_storage_path,
      'captured_at', mi.captured_at,
      'display_name', coalesce(g.display_name, 'Guest'),
      'challenge_id', mi.metadata ->> 'challenge_id',
      'guest_session_id', mi.guest_session_id,
      'uploaded_by_user_id', mi.uploaded_by_user_id,
      'is_mine', mi.guest_session_id = v_guest.id
    )
    order by mi.captured_at desc
  ), '[]'::jsonb) into v_challenge_photos
  from public.media_items mi
  left join public.guest_sessions g on g.id = mi.guest_session_id
  where mi.event_session_id = v_session.id
    and mi.status = 'ready'
    and mi.deleted_at is null
    and mi.metadata ? 'challenge_id';

  return jsonb_build_object(
    'challenge_photos', v_challenge_photos
  );
end;
$$;

comment on function public.get_guest_challenge_photos(text, text) is
  'Returns ready, undeleted challenge submissions for a guest-joined event, including is_mine and uploader metadata for ownership checks.';

revoke all on function public.get_guest_challenge_photos from public;
grant execute on function public.get_guest_challenge_photos to anon, authenticated;
