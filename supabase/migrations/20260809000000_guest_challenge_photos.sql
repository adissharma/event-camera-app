-- Guest-visible challenge submissions.
--
-- Guests can upload photos to challenges but couldn't see submissions from
-- other guests because get_guest_gallery omits challenge photos entirely, and
-- guests cannot call the host-only get_host_challenge_photos RPC. This RPC
-- exposes challenge submissions to guests with proper visibility controls.

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
  'Returns all ready, undeleted challenge submissions for a guest-joined event, with is_mine flag set.';

revoke all on function public.get_guest_challenge_photos from public;
grant execute on function public.get_guest_challenge_photos to anon, authenticated;
