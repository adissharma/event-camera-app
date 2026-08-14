-- Allow Guestbook audio messages to run to a minute.
--
-- Both finalize functions capped audio and video together at 30 seconds. That
-- ceiling belongs to video: a 30-second clip is the length the capture UI
-- offers and roughly the size a guest can upload on event wifi without it
-- failing. Audio is an order of magnitude smaller per second, and a spoken
-- message to the host wants longer than a clip does — so audio gets 60s and
-- video keeps its 30.
--
-- These limits are the real enforcement, not the countdown in the client: a
-- recording that overruns is rejected here regardless of what the UI did.

create or replace function public.finalize_guest_media_upload(
  p_media_item_id uuid,
  p_guest_token text,
  p_file_size_bytes bigint,
  p_mime_type text default null,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null,
  p_checksum_algorithm text default null,
  p_checksum_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.media_items%rowtype;
  v_guest public.guest_sessions%rowtype;
  v_intent public.upload_intents%rowtype;
  v_shots_used integer;
  v_max_duration_ms integer;
begin
  select * into v_item
  from public.media_items
  where id = p_media_item_id
    and deleted_at is null;

  if not found then
    raise exception 'media item not found' using errcode = '42501';
  end if;

  select * into v_guest
  from public.guest_sessions
  where id = v_item.guest_session_id
    and anonymous_token_hash = private.digest_token(p_guest_token);

  if not found then
    raise exception 'invalid guest session for this media item' using errcode = '42501';
  end if;

  if v_item.media_type in ('video', 'audio') then
    v_max_duration_ms := case when v_item.media_type = 'audio' then 60000 else 30000 end;
    if coalesce(p_duration_ms, 0) <= 0 or p_duration_ms > v_max_duration_ms then
      raise exception '% must be % seconds or less', v_item.media_type, v_max_duration_ms / 1000
        using errcode = '22023';
    end if;
  end if;

  if v_item.status = 'ready' then
    select count(*)::integer into v_shots_used
    from public.media_items
    where guest_session_id = v_guest.id
      and deleted_at is null
      and status <> 'permanent_failed'
      and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

    return jsonb_build_object(
      'media_item_id', v_item.id,
      'status', v_item.status,
      'storage_path', v_item.original_storage_path,
      'shots_used', v_shots_used
    );
  end if;

  select * into v_intent
  from public.upload_intents
  where media_item_id = p_media_item_id
    and completed_at is null
    and cancelled_at is null
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'no pending upload intent for this media item' using errcode = '42501';
  end if;

  update public.media_items
    set status = 'ready',
        original_storage_path = v_intent.storage_path,
        original_filename = split_part(v_intent.storage_path, '/', -1),
        mime_type = coalesce(p_mime_type, v_item.mime_type),
        file_size_bytes = p_file_size_bytes,
        width = p_width,
        height = p_height,
        duration_ms = case when v_item.media_type in ('video', 'audio') then p_duration_ms else null end,
        checksum_algorithm = p_checksum_algorithm,
        checksum_value = p_checksum_value,
        uploaded_at = now(),
        verified_at = now(),
        ready_at = now()
    where id = p_media_item_id
    returning * into v_item;

  update public.upload_intents
    set completed_at = now()
    where id = v_intent.id;

  -- Audio has no frame to derive a poster or image variants from.
  if v_item.media_type <> 'audio' then
    insert into public.processing_jobs (media_item_id, job_type, status)
    values (
      p_media_item_id,
      (case when v_item.media_type = 'video' then 'generate_video_poster' else 'generate_image_variants' end)::public.processing_job_type,
      'pending'
    );
  end if;

  select count(*)::integer into v_shots_used
  from public.media_items
  where guest_session_id = v_guest.id
    and deleted_at is null
    and status <> 'permanent_failed'
    and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'status', v_item.status,
    'storage_path', v_item.original_storage_path,
    'shots_used', v_shots_used
  );
end;
$$;

create or replace function public.finalize_host_media_upload(
  p_media_item_id uuid,
  p_file_size_bytes bigint,
  p_mime_type text default null,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null,
  p_checksum_algorithm text default null,
  p_checksum_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.media_items%rowtype;
  v_intent public.upload_intents%rowtype;
  v_max_duration_ms integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_item
  from public.media_items
  where id = p_media_item_id
    and deleted_at is null;

  if not found then
    raise exception 'media item not found' using errcode = '42501';
  end if;

  if not private.can_manage_event_session(v_item.event_session_id) then
    raise exception 'not permitted to finalize this media item' using errcode = '42501';
  end if;

  if v_item.media_type in ('video', 'audio') then
    v_max_duration_ms := case when v_item.media_type = 'audio' then 60000 else 30000 end;
    if coalesce(p_duration_ms, 0) <= 0 or p_duration_ms > v_max_duration_ms then
      raise exception '% must be % seconds or less', v_item.media_type, v_max_duration_ms / 1000
        using errcode = '22023';
    end if;
  end if;

  if v_item.status = 'ready' then
    return jsonb_build_object(
      'media_item_id', v_item.id,
      'status', v_item.status,
      'storage_path', v_item.original_storage_path
    );
  end if;

  select * into v_intent
  from public.upload_intents
  where media_item_id = p_media_item_id
    and completed_at is null
    and cancelled_at is null
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'no pending upload intent for this media item' using errcode = '42501';
  end if;

  update public.media_items
    set status = 'ready',
        original_storage_path = v_intent.storage_path,
        original_filename = split_part(v_intent.storage_path, '/', -1),
        mime_type = coalesce(p_mime_type, v_item.mime_type),
        file_size_bytes = p_file_size_bytes,
        width = p_width,
        height = p_height,
        duration_ms = case when v_item.media_type in ('video', 'audio') then p_duration_ms else null end,
        checksum_algorithm = p_checksum_algorithm,
        checksum_value = p_checksum_value,
        uploaded_at = now(),
        verified_at = now(),
        ready_at = now()
    where id = p_media_item_id
    returning * into v_item;

  update public.upload_intents
    set completed_at = now()
    where id = v_intent.id;

  if v_item.media_type <> 'audio' then
    insert into public.processing_jobs (media_item_id, job_type, status)
    values (
      p_media_item_id,
      (case when v_item.media_type = 'video' then 'generate_video_poster' else 'generate_image_variants' end)::public.processing_job_type,
      'pending'
    );
  end if;

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'status', v_item.status,
    'storage_path', v_item.original_storage_path
  );
end;
$$;
