-- Host-visible challenge submissions.
--
-- Guest challenge photos are already exposed through `get_guest_gallery`, but
-- the host dashboard was still trying to infer them from a general media read.
-- That worked in some states and failed in others, so the host path now reads
-- challenge submissions through a dedicated security-definer RPC instead.

create or replace function public.get_host_challenge_photos(
  p_event_session_id uuid
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

  select * into v_session
  from public.event_sessions
  where id = p_event_session_id
    and deleted_at is null;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  if not private.can_manage_event_session(p_event_session_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'storage_path', mi.original_storage_path,
      'captured_at', mi.captured_at,
      'display_name', coalesce(g.display_name, 'Guest'),
      'challenge_id', mi.metadata ->> 'challenge_id'
    )
    order by mi.captured_at desc
  ), '[]'::jsonb) into v_challenge_photos
  from public.media_items mi
  left join public.guest_sessions g on g.id = mi.guest_session_id
  where mi.event_session_id = p_event_session_id
    and mi.status = 'ready'
    and mi.deleted_at is null
    and mi.metadata ? 'challenge_id';

  return jsonb_build_object(
    'challenge_photos', v_challenge_photos
  );
end;
$$;

comment on function public.get_host_challenge_photos(uuid) is
  'Returns all ready, undeleted challenge submissions for a host-managed event session.';

revoke all on function public.get_host_challenge_photos from public;
grant execute on function public.get_host_challenge_photos to authenticated;
