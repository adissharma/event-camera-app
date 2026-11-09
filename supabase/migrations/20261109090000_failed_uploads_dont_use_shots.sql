-- A photo that never arrived should not cost a guest a shot.
--
-- WHY
-- ---
-- Asking to upload reserves a row in `media_items`, and the shot counter and
-- limits counted every row short of `permanent_failed`. If the connection then
-- dropped, the reservation stayed for good: the guest lost a shot and had no
-- photo, and the same went for the one video Free allows.
--
-- WHAT CHANGES
-- ------------
--   * The counter a guest sees only counts uploads that actually arrived, so a
--     failed post never moves it.
--   * A reservation unfinished after 15 minutes is released the next time that
--     guest uploads. It is well past any real upload, and the limits still
--     hold places for uploads in progress, so parallel requests cannot beat them.
--   * A retry of the same capture no longer counts against itself, which would
--     otherwise refuse a guest retrying their very last shot.
--
-- Both functions are the current definitions with only those lines changed.

begin;

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

  -- Reservations whose upload never finished stop holding a place. Every limit
  -- counts anything short of permanent_failed, so this frees them all at once.
  update public.media_items
    set status = 'permanent_failed'
    where guest_session_id = v_guest.id
      and client_media_id is distinct from p_client_media_id
      and status in ('upload_authorising', 'queued', 'uploading', 'paused', 'retryable_failed')
      and created_at < now() - interval '15 minutes';

  if not v_is_guestbook_submission and v_session.shot_limit_per_guest is not null then
    select count(*)::integer into v_shots_used
    from public.media_items
    where guest_session_id = v_guest.id and deleted_at is null and status <> 'permanent_failed'
      -- A retry of this same capture already holds its place.
      and client_media_id is distinct from p_client_media_id
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
      'captured_at', mi.captured_at,
      'display_name', coalesce(g.display_name, 'Guest'),
      'media_type', mi.media_type,
      'duration_ms', mi.duration_ms,
      'mime_type', mi.mime_type,
      'width', mi.width,
      'height', mi.height,
      'is_mine', mi.guest_session_id = v_guest.id,
      'guest_session_id', mi.guest_session_id,
      'uploaded_by_user_id', mi.uploaded_by_user_id
    )
    order by mi.captured_at desc
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
    and status in ('uploaded', 'verifying', 'processing', 'ready', 'hidden')
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
      'ends_at', v_session.ends_at,
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

commit;
