-- Reconcile get_host_challenge_photos with what is actually deployed.
--
-- `20260807200000_host_challenge_photos.sql` defines this function as
-- `(p_event_session_id uuid)` returning `{ "challenge_photos": [...] }`, but
-- the live database has a `(p_celebration_id uuid)` version returning a bare
-- array — it was replaced out-of-band, so the migration history and the
-- database disagreed. PostgREST resolves overloads by argument *name*, so the
-- client's `{ p_event_session_id: ... }` call matched nothing and failed with
-- PGRST202 on every host load; challenge photos only still appeared because
-- the caller silently fell back to filtering the general media read.
--
-- Both signatures are dropped and one canonical version is defined, keyed by
-- celebration and shaped like `get_guest_challenge_photos` so the two roles
-- read the same envelope.

drop function if exists public.get_host_challenge_photos(uuid);

create function public.get_host_challenge_photos(
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
      'display_name', coalesce(g.display_name, 'Guest'),
      'challenge_id', mi.metadata ->> 'challenge_id',
      -- A host's own captures carry no guest_sessions row; ownership for the
      -- delete affordance is decided by role upstream, not by this flag.
      'is_mine', false
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
  'Returns all ready, undeleted challenge submissions for a host-managed celebration, wrapped as { challenge_photos: [...] } to match get_guest_challenge_photos.';

revoke all on function public.get_host_challenge_photos from public, anon;
grant execute on function public.get_host_challenge_photos to authenticated;
