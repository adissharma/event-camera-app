-- Host media upload pipeline, mirroring the guest one
-- (20260804160000_guest_media_upload_pipeline.sql) so a host's own camera
-- captures and camera-roll picks go through the same real backend, appear in
-- the same real gallery, instead of the separate local-mock path they were
-- left on when the guest pipeline was first built.
--
-- Simpler than the guest version in one respect: hosts already have direct,
-- standing storage RLS ("event media: workspace managers write" / "workspace
-- members read", both `to authenticated`, in 20260728100700_storage.sql) —
-- there is no anonymous-identity problem to solve, so no upload_intents-as-
-- scoped-credential trick is required for authorization. An upload_intents
-- row is still created, purely to record the reserved path and give
-- finalize something to look up and mark completed, matching the guest flow's
-- shape.
--
-- Deliberately NOT identical in every respect:
--   - No shot limit. `shot_limit_per_guest` is a cap on guests, by name and
--     by design; capping the host on their own event has no product reason.
--   - No capture_mode gate. That setting controls what GUESTS may submit;
--     a host isn't restricting themselves by choosing to disable the guest
--     camera-roll toggle. The client still uses capture_mode to decide
--     whether to *show* the camera-roll button, for one consistent piece of
--     UI — see camera.tsx — but the server doesn't re-enforce it for a host
--     the way it does for a guest.

create or replace function public.create_host_media_upload_intent(
  p_celebration_id uuid,
  p_client_media_id uuid,
  p_source public.media_source,
  p_mime_type text,
  p_file_size_bytes bigint default null,
  p_captured_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_existing public.media_items%rowtype;
  v_media_item_id uuid;
  v_storage_path text;
  v_intent_id uuid;
  v_existing_intent public.upload_intents%rowtype;
  v_expires_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to add media to this event' using errcode = '42501';
  end if;

  select * into v_celebration
  from public.celebrations
  where id = p_celebration_id and deleted_at is null;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = p_celebration_id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  v_expires_at := now() + interval '3600 seconds';

  select * into v_existing
  from public.media_items
  where event_session_id = v_session.id
    and client_media_id = p_client_media_id;

  if found then
    v_media_item_id := v_existing.id;

    select * into v_existing_intent
    from public.upload_intents
    where media_item_id = v_media_item_id
      and completed_at is null
      and cancelled_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;

    if found then
      return jsonb_build_object(
        'media_item_id', v_media_item_id,
        'upload_intent_id', v_existing_intent.id,
        'bucket', v_existing_intent.bucket,
        'storage_path', v_existing_intent.storage_path
      );
    end if;

    v_storage_path := v_existing.original_storage_path;
    if v_storage_path is null then
      v_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
        || v_session.id::text || '/' || v_media_item_id::text || '/original-v1.'
        || private.extension_for_mime_type(p_mime_type);
    end if;

    update public.media_items
      set status = 'queued'
      where id = v_media_item_id;
  else
    v_media_item_id := gen_random_uuid();
    v_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
      || v_session.id::text || '/' || v_media_item_id::text || '/original-v1.'
      || private.extension_for_mime_type(p_mime_type);

    insert into public.media_items (
      id, event_session_id, uploaded_by_user_id, client_media_id,
      media_type, source, status, mime_type, file_size_bytes, captured_at
    )
    values (
      v_media_item_id, v_session.id, (select auth.uid()), p_client_media_id,
      'photo', p_source, 'queued', p_mime_type, p_file_size_bytes, p_captured_at
    );
  end if;

  insert into public.upload_intents (
    media_item_id, bucket, storage_path, protocol,
    expected_mime_type, expected_size_bytes, expires_at
  )
  values (
    v_media_item_id, 'event-media', v_storage_path, 'standard',
    p_mime_type, p_file_size_bytes, v_expires_at
  )
  returning id into v_intent_id;

  return jsonb_build_object(
    'media_item_id', v_media_item_id,
    'upload_intent_id', v_intent_id,
    'bucket', 'event-media',
    'storage_path', v_storage_path
  );
end;
$$;

comment on function public.create_host_media_upload_intent is
  'Reserves a media_items row and storage path for a host uploading directly to their own event. No shot limit, no capture_mode gate — those restrict guests, not the host.';

revoke all on function public.create_host_media_upload_intent from public, anon;
grant execute on function public.create_host_media_upload_intent to authenticated;

create or replace function public.finalize_host_media_upload(
  p_media_item_id uuid,
  p_file_size_bytes bigint,
  p_mime_type text default null,
  p_width integer default null,
  p_height integer default null,
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

  insert into public.processing_jobs (media_item_id, job_type, status)
  values (p_media_item_id, 'generate_image_variants', 'pending');

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'status', v_item.status,
    'storage_path', v_item.original_storage_path
  );
end;
$$;

comment on function public.finalize_host_media_upload is
  'Marks a host media upload ready after the client has written the bytes to the path returned by create_host_media_upload_intent.';

revoke all on function public.finalize_host_media_upload from public, anon;
grant execute on function public.finalize_host_media_upload to authenticated;
