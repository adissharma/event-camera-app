-- Let hosts choose whether an on-demand recap should use the event's photo
-- treatment or the untouched originals. Videos remain original, matching the
-- existing save/export behaviour.

create or replace function public.request_event_recap(
  p_event_session_id uuid,
  p_selected_media_ids uuid[],
  p_render_mode text default 'original'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.event_sessions%rowtype;
  v_selected uuid[];
  v_valid_count integer;
  v_recap public.event_recaps%rowtype;
  v_render_mode text;
begin
  v_render_mode := case when p_render_mode = 'filtered' then 'filtered' else 'original' end;

  if p_selected_media_ids is null or cardinality(p_selected_media_ids) = 0 then
    raise exception 'Choose at least one photo or video for the recap.' using errcode = '22023';
  end if;

  select array_agg(distinct media_id) into v_selected
  from unnest(p_selected_media_ids) as media_id;

  if cardinality(v_selected) <> cardinality(p_selected_media_ids) then
    raise exception 'Each selected item can only be included once.' using errcode = '22023';
  end if;

  if cardinality(v_selected) > 80 then
    raise exception 'Choose up to 80 items for one recap.' using errcode = '22023';
  end if;

  select * into v_session
  from public.event_sessions
  where id = p_event_session_id and deleted_at is null;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  if not private.can_manage_event_session(v_session.id) then
    raise exception 'not allowed to create this recap' using errcode = '42501';
  end if;

  if v_session.ends_at is null or v_session.ends_at > now() then
    raise exception 'Recaps can be created after the event ends.' using errcode = '22023';
  end if;

  select count(*) into v_valid_count
  from public.media_items mi
  where mi.event_session_id = v_session.id
    and mi.id = any(v_selected)
    and mi.status = 'ready'
    and mi.deleted_at is null
    and mi.original_storage_path is not null
    and mi.media_type in ('photo', 'video')
    and coalesce(mi.metadata ->> 'submission_kind', '') <> 'guestbook';

  if v_valid_count <> cardinality(v_selected) then
    raise exception 'One or more selected items are no longer available.' using errcode = '22023';
  end if;

  insert into public.event_recaps (
    event_session_id,
    celebration_id,
    status,
    selected_media_ids,
    available_at,
    attempt_count,
    storage_path,
    playback_url,
    duration_ms,
    media_count,
    locked_by,
    lease_expires_at,
    started_at,
    completed_at,
    failed_at,
    last_error_code,
    last_error_message,
    metadata
  )
  values (
    v_session.id,
    v_session.celebration_id,
    'queued',
    p_selected_media_ids,
    now(),
    0,
    null,
    null,
    null,
    cardinality(p_selected_media_ids),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object('requested_by', auth.uid(), 'requested_at', now(), 'render_mode', v_render_mode)
  )
  on conflict (event_session_id) do update
    set status = 'queued',
        selected_media_ids = excluded.selected_media_ids,
        available_at = now(),
        attempt_count = 0,
        storage_path = null,
        playback_url = null,
        duration_ms = null,
        media_count = excluded.media_count,
        locked_by = null,
        lease_expires_at = null,
        started_at = null,
        completed_at = null,
        failed_at = null,
        last_error_code = null,
        last_error_message = null,
        metadata = jsonb_build_object('requested_by', auth.uid(), 'requested_at', now(), 'render_mode', v_render_mode)
  returning * into v_recap;

  return jsonb_build_object(
    'id', v_recap.id,
    'status', v_recap.status,
    'playback_url', v_recap.playback_url,
    'duration_ms', v_recap.duration_ms,
    'media_count', v_recap.media_count
  );
end;
$$;

revoke all on function public.request_event_recap(uuid, uuid[], text) from public;
grant execute on function public.request_event_recap(uuid, uuid[], text) to authenticated;
