-- Persist challenge-story submissions in the shared media pipeline.
--
-- Challenge photos were previously stored only in local browser state on the
-- web guest flow, which meant a host on another device could not see them.
-- These changes attach a `challenge_id` marker to the existing media_items
-- row and expose challenge-specific submissions through the guest gallery RPC
-- so every viewer can read the same source of truth.

-- ---------------------------------------------------------------------------
-- Guest upload intent
-- ---------------------------------------------------------------------------

drop function if exists public.create_guest_media_upload_intent(
  text,
  text,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz
);

create or replace function public.create_guest_media_upload_intent(
  p_event_code text,
  p_guest_token text,
  p_client_media_id uuid,
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

  if p_source = 'library' and v_session.capture_mode = 'camera_only' then
    raise exception 'camera roll uploads are not enabled for this event' using errcode = '42501';
  end if;
  if p_source = 'camera' and v_session.capture_mode = 'library_only' then
    raise exception 'camera capture is not enabled for this event' using errcode = '42501';
  end if;

  if v_session.shot_limit_per_guest is not null then
    select count(*)::integer into v_shots_used
    from public.media_items
    where guest_session_id = v_guest.id
      and deleted_at is null
      and status <> 'permanent_failed';

    if v_shots_used >= v_session.shot_limit_per_guest then
      raise exception 'shot limit reached' using errcode = '42501';
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
      set status = 'queued',
          metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
      where id = v_media_item_id;
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
      'photo', p_source, 'queued', p_mime_type, p_file_size_bytes, p_captured_at,
      coalesce(p_metadata, '{}'::jsonb)
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

comment on function public.create_guest_media_upload_intent(
  text,
  text,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) is
  'Validates a guest against capture_mode and the shot limit, then reserves a media_items row and storage path. The returned path is only writable while a live upload_intents row for it exists — see the storage.objects insert policy below.';

revoke all on function public.create_guest_media_upload_intent(
  text,
  text,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) from public, anon;
grant execute on function public.create_guest_media_upload_intent(
  text,
  text,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Host upload intent
-- ---------------------------------------------------------------------------

drop function if exists public.create_host_media_upload_intent(
  uuid,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz
);

create or replace function public.create_host_media_upload_intent(
  p_celebration_id uuid,
  p_client_media_id uuid,
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
      set status = 'queued',
          metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
      where id = v_media_item_id;
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
      'photo', p_source, 'queued', p_mime_type, p_file_size_bytes, p_captured_at,
      coalesce(p_metadata, '{}'::jsonb)
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

comment on function public.create_host_media_upload_intent(
  uuid,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) is
  'Reserves a media_items row and storage path for a host uploading directly to their own event. No shot limit, no capture_mode gate — those restrict guests, not the host.';

revoke all on function public.create_host_media_upload_intent(
  uuid,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) from public, anon;
grant execute on function public.create_host_media_upload_intent(
  uuid,
  uuid,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- Guest gallery now also exposes challenge submissions.
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
  v_challenge_photos jsonb;
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
      'display_name', coalesce(g.display_name, 'Guest')
    )
    order by mi.captured_at desc
  ), '[]'::jsonb) into v_photos
  from public.media_items mi
  left join public.guest_sessions g on g.id = mi.guest_session_id
  where mi.event_session_id = v_session.id
    and mi.status = 'ready'
    and mi.deleted_at is null
    and (
      mi.guest_session_id = v_guest.id
      or (
        not v_is_locked
        and v_session.gallery_visibility = 'all_guests'
      )
    );

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

  select count(*)::integer into v_shots_used
  from public.media_items
  where guest_session_id = v_guest.id
    and deleted_at is null
    and status <> 'permanent_failed';

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
      'is_locked', v_is_locked
    ),
    'guest', jsonb_build_object(
      'id', v_guest.id,
      'display_name', v_guest.display_name,
      'shots_used', v_shots_used,
      'shot_limit', v_session.shot_limit_per_guest
    ),
    'photos', v_photos,
    'challenge_photos', v_challenge_photos
  );
end;
$$;

comment on function public.get_guest_gallery is
  'Retrieves event details (including capture_mode), session configuration, and guest-specific photo list securely, resolving the celebration by its guest-facing event_code and validating the guest token. Includes challenge submissions for the shared story viewer.';
