-- Stored video thumbnails.
--
-- The gallery grid has never had a real thumbnail: `VideoPoster` (the
-- client component behind every video cell) is a full `expo-video` player
-- pointed at the actual video file, paused on its first frame. Every cell
-- therefore opens a real network fetch of the full video just to look like
-- a static image — and on web, if the file's moov atom isn't at the front
-- (common for a phone recording that was never remuxed for streaming), the
-- browser can't render anything until much of the file has downloaded. This
-- migration adds a real, small, stored JPEG thumbnail per video so the grid
-- can render a plain `<Image>` instead.
--
-- Client-generated, not server-generated: this project has no Edge Function
-- and no background worker (`processing_jobs` rows have sat `pending`,
-- unconsumed, since the upload pipeline was first built — see this
-- migration's neighbours). The client already has the decoded video in hand
-- right before upload, which is the cheapest possible place to grab one
-- frame, so this reuses that moment rather than adding new infrastructure.
--
-- Same "scoped credential via a live upload_intents row" security model as
-- the original file (see 20260804160000_guest_media_upload_pipeline.sql's
-- header) — the create-intent RPCs below reserve a SECOND upload_intents row,
-- for a deterministic thumbnail path, only for video items. A thumbnail is
-- optional at every step: nothing here blocks or fails a video post if the
-- client never generates or uploads one — the row's `thumbnail_storage_path`
-- just stays null and the grid falls back to today's video-as-poster
-- behaviour for that item, exactly as before this migration.

-- ---------------------------------------------------------------------------
-- media_items.thumbnail_storage_path
-- ---------------------------------------------------------------------------

alter table public.media_items
  add column if not exists thumbnail_storage_path text;

comment on column public.media_items.thumbnail_storage_path is
  'A small JPEG frame grabbed client-side before upload, used by the gallery grid instead of loading the full video. Null when no thumbnail was generated/uploaded (older items, or a thumbnail failure that did not block the post itself) — the grid falls back to the video file as its own poster in that case.';

-- ---------------------------------------------------------------------------
-- create_guest_media_upload_intent — now also reserves a thumbnail path
-- ---------------------------------------------------------------------------

create or replace function public.create_guest_media_upload_intent(
  p_event_code text,
  p_guest_token text,
  p_client_media_id uuid,
  p_media_type public.media_type,
  p_source public.media_source,
  p_mime_type text,
  p_file_size_bytes bigint default null,
  p_captured_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
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
  v_existing public.media_items%rowtype;
  v_media_item_id uuid;
  v_shots_used integer;
  v_storage_path text;
  v_intent_id uuid;
  v_existing_intent public.upload_intents%rowtype;
  v_expires_at timestamptz;
  v_is_guestbook_submission boolean := coalesce(p_metadata ->> 'submission_kind', '') = 'guestbook';
  v_thumbnail_storage_path text;
  v_thumbnail_intent_id uuid;
begin
  v_clean_code := trim(lower(p_event_code));

  select * into v_celebration
  from public.celebrations
  where lower(event_code) = v_clean_code and deleted_at is null and status <> 'draft';
  if not found then raise exception 'event not found or unavailable' using errcode = '42501'; end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id and deleted_at is null
  order by sequence_number asc limit 1;
  if not found then raise exception 'event session not found' using errcode = '42501'; end if;

  select * into v_guest
  from public.guest_sessions
  where anonymous_token_hash = private.digest_token(p_guest_token) and event_session_id = v_session.id;
  if not found then raise exception 'invalid guest session for this event' using errcode = '42501'; end if;

  if not v_is_guestbook_submission and not (p_media_type = any (v_session.allowed_media_types)) then
    raise exception 'this event does not allow this media type' using errcode = '42501';
  end if;

  if p_media_type = 'audio' then
    if not v_is_guestbook_submission then
      raise exception 'audio uploads are only supported for the guestbook' using errcode = '42501';
    end if;
    if p_source <> 'recording' then
      raise exception 'audio uploads currently require in-app recording' using errcode = '42501';
    end if;
    if lower(coalesce(p_mime_type, '')) not in ('audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/webm') then
      raise exception 'unsupported audio format' using errcode = '42501';
    end if;
    if coalesce(p_file_size_bytes, 0) > 25 * 1024 * 1024 then
      raise exception 'audio file is too large' using errcode = '42501';
    end if;
  end if;

  if p_media_type = 'video' then
    if p_source <> 'camera' then
      raise exception 'video uploads currently require camera capture' using errcode = '42501';
    end if;
    if lower(coalesce(p_mime_type, '')) not in ('video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm') then
      raise exception 'unsupported video format' using errcode = '42501';
    end if;
    if coalesce(p_file_size_bytes, 0) > 100 * 1024 * 1024 then
      raise exception 'video file is too large' using errcode = '42501';
    end if;
  end if;

  if p_source = 'library' and v_session.capture_mode = 'camera_only' then
    raise exception 'camera roll uploads are not enabled for this event' using errcode = '42501';
  end if;
  if p_source = 'camera' and v_session.capture_mode = 'library_only' then
    raise exception 'camera capture is not enabled for this event' using errcode = '42501';
  end if;

  if not v_is_guestbook_submission and v_session.shot_limit_per_guest is not null then
    select count(*)::integer into v_shots_used
    from public.media_items
    where guest_session_id = v_guest.id and deleted_at is null and status <> 'permanent_failed'
      and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';
    if v_shots_used >= v_session.shot_limit_per_guest then
      raise exception 'shot limit reached' using errcode = '42501';
    end if;
  end if;

  v_expires_at := now() + interval '3600 seconds';

  select * into v_existing
  from public.media_items
  where event_session_id = v_session.id and client_media_id = p_client_media_id;

  if found then
    v_media_item_id := v_existing.id;

    select * into v_existing_intent
    from public.upload_intents
    where media_item_id = v_media_item_id
      and storage_path like '%/original-v1.%'
      and completed_at is null and cancelled_at is null and expires_at > now()
    order by created_at desc limit 1;

    if found then
      v_intent_id := v_existing_intent.id;
      v_storage_path := v_existing_intent.storage_path;
    else
      v_storage_path := v_existing.original_storage_path;
      if v_storage_path is null then
        v_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
          || v_session.id::text || '/' || v_media_item_id::text || '/original-v1.'
          || private.extension_for_mime_type(p_mime_type);
      end if;

      insert into public.upload_intents (
        media_item_id, bucket, storage_path, protocol, expected_mime_type, expected_size_bytes, expires_at
      )
      values (v_media_item_id, 'event-media', v_storage_path, 'standard', p_mime_type, p_file_size_bytes, v_expires_at)
      returning id into v_intent_id;

      update public.media_items
        set status = 'queued', media_type = p_media_type,
            metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
        where id = v_media_item_id;
    end if;
  else
    v_media_item_id := gen_random_uuid();
    v_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
      || v_session.id::text || '/' || v_media_item_id::text || '/original-v1.'
      || private.extension_for_mime_type(p_mime_type);

    insert into public.media_items (
      id, event_session_id, guest_session_id, client_media_id,
      media_type, source, status, mime_type, file_size_bytes, captured_at, metadata
    )
    values (
      v_media_item_id, v_session.id, v_guest.id, p_client_media_id,
      p_media_type, p_source, 'queued', p_mime_type, p_file_size_bytes, p_captured_at,
      coalesce(p_metadata, '{}'::jsonb)
    );

    insert into public.upload_intents (
      media_item_id, bucket, storage_path, protocol, expected_mime_type, expected_size_bytes, expires_at
    )
    values (v_media_item_id, 'event-media', v_storage_path, 'standard', p_mime_type, p_file_size_bytes, v_expires_at)
    returning id into v_intent_id;
  end if;

  -- A thumbnail is only meaningful for video, and the path is deterministic
  -- from the media item id — a retried request for the same client_media_id
  -- always lands on the identical thumbnail path, so this just finds-or-
  -- creates the live intent for it rather than ever risking a duplicate.
  if p_media_type = 'video' then
    v_thumbnail_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
      || v_session.id::text || '/' || v_media_item_id::text || '/thumb-v1.jpg';

    select id into v_thumbnail_intent_id
    from public.upload_intents
    where media_item_id = v_media_item_id
      and storage_path = v_thumbnail_storage_path
      and completed_at is null and cancelled_at is null and expires_at > now()
    order by created_at desc limit 1;

    if v_thumbnail_intent_id is null then
      insert into public.upload_intents (
        media_item_id, bucket, storage_path, protocol, expected_mime_type, expires_at
      )
      values (v_media_item_id, 'event-media', v_thumbnail_storage_path, 'standard', 'image/jpeg', v_expires_at)
      returning id into v_thumbnail_intent_id;
    end if;
  end if;

  return jsonb_build_object(
    'media_item_id', v_media_item_id, 'upload_intent_id', v_intent_id,
    'bucket', 'event-media', 'storage_path', v_storage_path,
    'thumbnail_storage_path', v_thumbnail_storage_path
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- create_host_media_upload_intent — same thumbnail reservation
-- ---------------------------------------------------------------------------

create or replace function public.create_host_media_upload_intent(
  p_celebration_id uuid,
  p_client_media_id uuid,
  p_media_type public.media_type,
  p_source public.media_source,
  p_mime_type text,
  p_file_size_bytes bigint default null,
  p_captured_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
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
  v_is_guestbook_submission boolean := coalesce(p_metadata ->> 'submission_kind', '') = 'guestbook';
  v_thumbnail_storage_path text;
  v_thumbnail_intent_id uuid;
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

  if not v_is_guestbook_submission and not (p_media_type = any (v_session.allowed_media_types)) then
    raise exception 'this event does not allow this media type' using errcode = '42501';
  end if;

  if p_media_type = 'audio' then
    if not v_is_guestbook_submission then
      raise exception 'audio uploads are only supported for the guestbook' using errcode = '42501';
    end if;
    if p_source <> 'recording' then
      raise exception 'audio uploads currently require in-app recording' using errcode = '42501';
    end if;
    if lower(coalesce(p_mime_type, '')) not in ('audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/webm') then
      raise exception 'unsupported audio format' using errcode = '42501';
    end if;
    if coalesce(p_file_size_bytes, 0) > 25 * 1024 * 1024 then
      raise exception 'audio file is too large' using errcode = '42501';
    end if;
  end if;

  if p_media_type = 'video' then
    if p_source <> 'camera' then
      raise exception 'video uploads currently require camera capture' using errcode = '42501';
    end if;
    if lower(coalesce(p_mime_type, '')) not in ('video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm') then
      raise exception 'unsupported video format' using errcode = '42501';
    end if;
    if coalesce(p_file_size_bytes, 0) > 100 * 1024 * 1024 then
      raise exception 'video file is too large' using errcode = '42501';
    end if;
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
      and storage_path like '%/original-v1.%'
      and completed_at is null
      and cancelled_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;

    if found then
      v_intent_id := v_existing_intent.id;
      v_storage_path := v_existing_intent.storage_path;
    else
      v_storage_path := v_existing.original_storage_path;
      if v_storage_path is null then
        v_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
          || v_session.id::text || '/' || v_media_item_id::text || '/original-v1.'
          || private.extension_for_mime_type(p_mime_type);
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

      update public.media_items
        set status = 'queued',
            media_type = p_media_type,
            metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
        where id = v_media_item_id;
    end if;
  else
    v_media_item_id := gen_random_uuid();
    v_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
      || v_session.id::text || '/' || v_media_item_id::text || '/original-v1.'
      || private.extension_for_mime_type(p_mime_type);

    insert into public.media_items (
      id, event_session_id, uploaded_by_user_id, client_media_id,
      media_type, source, status, mime_type, file_size_bytes, captured_at, metadata
    )
    values (
      v_media_item_id, v_session.id, (select auth.uid()), p_client_media_id,
      p_media_type, p_source, 'queued', p_mime_type, p_file_size_bytes, p_captured_at,
      coalesce(p_metadata, '{}'::jsonb)
    );

    insert into public.upload_intents (
      media_item_id, bucket, storage_path, protocol,
      expected_mime_type, expected_size_bytes, expires_at
    )
    values (
      v_media_item_id, 'event-media', v_storage_path, 'standard',
      p_mime_type, p_file_size_bytes, v_expires_at
    )
    returning id into v_intent_id;
  end if;

  if p_media_type = 'video' then
    v_thumbnail_storage_path := v_celebration.workspace_id::text || '/' || v_celebration.id::text || '/'
      || v_session.id::text || '/' || v_media_item_id::text || '/thumb-v1.jpg';

    select id into v_thumbnail_intent_id
    from public.upload_intents
    where media_item_id = v_media_item_id
      and storage_path = v_thumbnail_storage_path
      and completed_at is null and cancelled_at is null and expires_at > now()
    order by created_at desc limit 1;

    if v_thumbnail_intent_id is null then
      insert into public.upload_intents (
        media_item_id, bucket, storage_path, protocol, expected_mime_type, expires_at
      )
      values (v_media_item_id, 'event-media', v_thumbnail_storage_path, 'standard', 'image/jpeg', v_expires_at)
      returning id into v_thumbnail_intent_id;
    end if;
  end if;

  return jsonb_build_object(
    'media_item_id', v_media_item_id,
    'upload_intent_id', v_intent_id,
    'bucket', 'event-media',
    'storage_path', v_storage_path,
    'thumbnail_storage_path', v_thumbnail_storage_path
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- finalize_guest_media_upload — records the thumbnail if one was uploaded
-- ---------------------------------------------------------------------------

create or replace function public.finalize_guest_media_upload(
  p_media_item_id uuid,
  p_guest_token text,
  p_file_size_bytes bigint,
  p_mime_type text default null,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null,
  p_checksum_algorithm text default null,
  p_checksum_value text default null,
  p_thumbnail_uploaded boolean default false
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
  v_thumbnail_intent public.upload_intents%rowtype;
  v_shots_used integer;
  v_max_duration_ms integer;
  v_thumbnail_storage_path text;
begin
  select * into v_item from public.media_items where id = p_media_item_id and deleted_at is null;
  if not found then raise exception 'media item not found' using errcode = '42501'; end if;

  select * into v_guest from public.guest_sessions
  where id = v_item.guest_session_id and anonymous_token_hash = private.digest_token(p_guest_token);
  if not found then raise exception 'invalid guest session for this media item' using errcode = '42501'; end if;

  if v_item.media_type in ('video', 'audio') then
    v_max_duration_ms := case when v_item.media_type = 'audio' then 60000 else 30000 end;
    if coalesce(p_duration_ms, 0) <= 0 or p_duration_ms > v_max_duration_ms then
      raise exception '% must be % seconds or less', v_item.media_type, v_max_duration_ms / 1000 using errcode = '22023';
    end if;
  end if;

  if v_item.status = 'ready' then
    select count(*)::integer into v_shots_used from public.media_items
    where guest_session_id = v_guest.id and deleted_at is null and status <> 'permanent_failed'
      and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';
    return jsonb_build_object('media_item_id', v_item.id, 'status', v_item.status,
      'storage_path', v_item.original_storage_path, 'shots_used', v_shots_used);
  end if;

  select * into v_intent from public.upload_intents
  where media_item_id = p_media_item_id
    and storage_path like '%/original-v1.%'
    and completed_at is null and cancelled_at is null
  order by created_at desc limit 1;
  if not found then raise exception 'no pending upload intent for this media item' using errcode = '42501'; end if;

  -- Optional and best-effort: a thumbnail the client says it uploaded is
  -- only recorded if a live, matching intent actually exists for it — never
  -- trusted blindly, but never allowed to fail the post either.
  if p_thumbnail_uploaded then
    select * into v_thumbnail_intent from public.upload_intents
    where media_item_id = p_media_item_id
      and storage_path like '%/thumb-v1.%'
      and completed_at is null and cancelled_at is null
    order by created_at desc limit 1;
    if found then
      v_thumbnail_storage_path := v_thumbnail_intent.storage_path;
    end if;
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
        thumbnail_storage_path = coalesce(v_thumbnail_storage_path, thumbnail_storage_path),
        uploaded_at = now(), verified_at = now(), ready_at = now()
    where id = p_media_item_id
    returning * into v_item;

  update public.upload_intents set completed_at = now() where id = v_intent.id;
  if v_thumbnail_intent.id is not null then
    update public.upload_intents set completed_at = now() where id = v_thumbnail_intent.id;
  end if;

  -- Audio has no frame to derive a poster or image variants from.
  if v_item.media_type <> 'audio' then
    insert into public.processing_jobs (media_item_id, job_type, status)
    values (
      p_media_item_id,
      (case when v_item.media_type = 'video' then 'generate_video_poster' else 'generate_image_variants' end)::public.processing_job_type,
      'pending'
    );
  end if;

  select count(*)::integer into v_shots_used from public.media_items
  where guest_session_id = v_guest.id and deleted_at is null and status <> 'permanent_failed'
    and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

  return jsonb_build_object('media_item_id', v_item.id, 'status', v_item.status,
    'storage_path', v_item.original_storage_path, 'shots_used', v_shots_used);
end;
$$;

-- ---------------------------------------------------------------------------
-- finalize_host_media_upload — same thumbnail recording
-- ---------------------------------------------------------------------------

create or replace function public.finalize_host_media_upload(
  p_media_item_id uuid,
  p_file_size_bytes bigint,
  p_mime_type text default null,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null,
  p_checksum_algorithm text default null,
  p_checksum_value text default null,
  p_thumbnail_uploaded boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.media_items%rowtype;
  v_intent public.upload_intents%rowtype;
  v_thumbnail_intent public.upload_intents%rowtype;
  v_max_duration_ms integer;
  v_thumbnail_storage_path text;
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
    and storage_path like '%/original-v1.%'
    and completed_at is null
    and cancelled_at is null
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'no pending upload intent for this media item' using errcode = '42501';
  end if;

  if p_thumbnail_uploaded then
    select * into v_thumbnail_intent from public.upload_intents
    where media_item_id = p_media_item_id
      and storage_path like '%/thumb-v1.%'
      and completed_at is null and cancelled_at is null
    order by created_at desc limit 1;
    if found then
      v_thumbnail_storage_path := v_thumbnail_intent.storage_path;
    end if;
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
        thumbnail_storage_path = coalesce(v_thumbnail_storage_path, thumbnail_storage_path),
        uploaded_at = now(),
        verified_at = now(),
        ready_at = now()
    where id = p_media_item_id
    returning * into v_item;

  update public.upload_intents
    set completed_at = now()
    where id = v_intent.id;
  if v_thumbnail_intent.id is not null then
    update public.upload_intents set completed_at = now() where id = v_thumbnail_intent.id;
  end if;

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

-- ---------------------------------------------------------------------------
-- get_guest_gallery — surface the thumbnail path alongside the original
-- ---------------------------------------------------------------------------

create or replace function public.get_guest_gallery(
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
  v_photos jsonb;
  v_shots_used integer;
  v_is_locked boolean;
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

  v_is_locked := (v_session.reveal_mode = 'scheduled' and v_session.reveal_at is not null and v_session.reveal_at > now())
              or v_session.reveal_mode = 'manual';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'storage_path', mi.original_storage_path,
      'thumbnail_storage_path', mi.thumbnail_storage_path,
      'captured_at', mi.captured_at,
      'display_name', coalesce(g.display_name, 'Guest'),
      'media_type', mi.media_type,
      'duration_ms', mi.duration_ms,
      'mime_type', mi.mime_type,
      'width', mi.width,
      'height', mi.height,
      'is_mine', mi.guest_session_id = v_guest.id,
      'is_pinned', mi.is_pinned,
      'pinned_at', mi.pinned_at,
      'caption', mi.metadata ->> 'caption',
      'guest_session_id', mi.guest_session_id,
      'uploaded_by_user_id', mi.uploaded_by_user_id
    )
    order by mi.is_pinned desc, mi.pinned_at desc nulls last, mi.captured_at desc
  ), '[]'::jsonb) into v_photos
  from public.media_items mi
  left join public.guest_sessions g on g.id = mi.guest_session_id
  where mi.event_session_id = v_session.id
    and mi.status = 'ready'
    and mi.deleted_at is null
    and coalesce(mi.metadata ->> 'submission_kind', '') <> 'guestbook'
    and (
      mi.guest_session_id = v_guest.id
      or (
        not v_is_locked
        and v_session.gallery_visibility = 'all_guests'
      )
    );

  select count(*)::integer into v_shots_used
  from public.media_items
  where guest_session_id = v_guest.id
    and deleted_at is null
    and status <> 'permanent_failed'
    and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

  return jsonb_build_object(
    'celebration', jsonb_build_object(
      'id', v_celebration.id,
      'title', v_celebration.title,
      'public_slug', v_celebration.public_slug,
      'cover_storage_path', v_celebration.cover_storage_path,
      'ends_at', v_celebration.ends_at,
      'timezone', v_celebration.timezone
    ),
    'session', jsonb_build_object(
      'id', v_session.id,
      'name', v_session.name,
      'reveal_mode', v_session.reveal_mode,
      'reveal_at', v_session.reveal_at,
      'gallery_visibility', v_session.gallery_visibility,
      'shot_limit_per_guest', v_session.shot_limit_per_guest,
      'guest_downloads_enabled', v_session.guest_downloads_enabled,
      'capture_mode', v_session.capture_mode,
      'allowed_media_types', v_session.allowed_media_types,
      'is_locked', v_is_locked
    ),
    'guest', jsonb_build_object(
      'id', v_guest.id,
      'display_name', v_guest.display_name,
      'shots_used', v_shots_used,
      'shot_limit', v_session.shot_limit_per_guest
    ),
    'photos', v_photos
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Guest storage read: a thumbnail lives at a different path than the
-- original it belongs to, so the exact-match guest read policy needs to
-- recognise it too. Host read is unaffected — its policy only checks the
-- workspace-id path segment, which a thumbnail already shares.
-- ---------------------------------------------------------------------------

create or replace function private.is_ready_guest_media(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_items mi
    where (mi.original_storage_path = p_path or mi.thumbnail_storage_path = p_path)
      and mi.status = 'ready'
      and mi.deleted_at is null
  );
$$;
