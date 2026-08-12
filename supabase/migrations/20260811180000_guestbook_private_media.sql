-- Private Guestbook for events.
--
-- Reuses the shared media_items storage pipeline, but tags Guestbook entries in
-- metadata and keeps them out of the normal gallery/query paths. Guests may
-- read only their own Guestbook submissions; hosts may read every submission
-- for events they manage.

create table if not exists public.event_guestbooks (
  id uuid primary key default gen_random_uuid(),
  celebration_id uuid not null references public.celebrations(id) on delete cascade,
  instructions text not null default 'Leave a message for the host.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_guestbooks_celebration_unique unique (celebration_id)
);

comment on table public.event_guestbooks is
  'Host-configurable private Guestbook copy for a celebration.';

create trigger event_guestbooks_set_updated_at
  before update on public.event_guestbooks
  for each row execute function private.set_updated_at();

alter table public.event_guestbooks enable row level security;

create policy "event_guestbooks: managers read"
  on public.event_guestbooks for select to authenticated
  using (private.can_manage_celebration(celebration_id));

create policy "event_guestbooks: managers insert"
  on public.event_guestbooks for insert to authenticated
  with check (private.can_manage_celebration(celebration_id));

create policy "event_guestbooks: managers update"
  on public.event_guestbooks for update to authenticated
  using (private.can_manage_celebration(celebration_id))
  with check (private.can_manage_celebration(celebration_id));

revoke all on public.event_guestbooks from anon;
grant select, insert, update on public.event_guestbooks to authenticated;

create or replace function private.extension_for_mime_type(p_mime_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_mime_type, ''))
    when 'audio/mp4' then 'm4a'
    when 'audio/x-m4a' then 'm4a'
    when 'audio/aac' then 'aac'
    when 'audio/mpeg' then 'mp3'
    when 'audio/wav' then 'wav'
    when 'audio/webm' then 'webm'
    when 'video/mp4' then 'mp4'
    when 'video/quicktime' then 'mov'
    when 'video/x-m4v' then 'm4v'
    when 'video/webm' then 'webm'
    when 'image/jpeg' then 'jpg'
    when 'image/jpg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/heic' then 'heic'
    when 'image/heif' then 'heif'
    when 'image/webp' then 'webp'
    else 'jpg'
  end;
$$;

create or replace function public.upsert_event_guestbook(
  p_celebration_id uuid,
  p_instructions text
)
returns public.event_guestbooks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_guestbooks%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to manage this guestbook' using errcode = '42501';
  end if;

  insert into public.event_guestbooks (celebration_id, instructions)
  values (
    p_celebration_id,
    coalesce(nullif(trim(p_instructions), ''), 'Leave a message for the host.')
  )
  on conflict (celebration_id) do update
    set instructions = excluded.instructions
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_event_guestbook(uuid, text) is
  'Creates or updates the host-configurable Guestbook instructions for a celebration.';

revoke all on function public.upsert_event_guestbook(uuid, text) from public, anon;
grant execute on function public.upsert_event_guestbook(uuid, text) to authenticated;

create or replace function public.get_host_guestbook(
  p_celebration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guestbook public.event_guestbooks%rowtype;
  v_messages jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not permitted to view this guestbook' using errcode = '42501';
  end if;

  insert into public.event_guestbooks (celebration_id)
  values (p_celebration_id)
  on conflict (celebration_id) do nothing;

  select * into v_guestbook
  from public.event_guestbooks
  where celebration_id = p_celebration_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'storage_path', mi.original_storage_path,
      'captured_at', mi.captured_at,
      'display_name', coalesce(gs.display_name, 'Guest'),
      'guest_session_id', mi.guest_session_id,
      'media_type', mi.media_type,
      'duration_ms', mi.duration_ms,
      'mime_type', mi.mime_type,
      'width', mi.width,
      'height', mi.height
    )
    order by mi.captured_at desc, mi.created_at desc
  ), '[]'::jsonb) into v_messages
  from public.media_items mi
  join public.event_sessions es on es.id = mi.event_session_id
  left join public.guest_sessions gs on gs.id = mi.guest_session_id
  where es.celebration_id = p_celebration_id
    and es.deleted_at is null
    and mi.status = 'ready'
    and mi.deleted_at is null
    and coalesce(mi.metadata ->> 'submission_kind', '') = 'guestbook';

  return jsonb_build_object(
    'guestbook', jsonb_build_object(
      'id', v_guestbook.id,
      'celebration_id', v_guestbook.celebration_id,
      'instructions', v_guestbook.instructions
    ),
    'messages', v_messages
  );
end;
$$;

comment on function public.get_host_guestbook(uuid) is
  'Returns the host-configured Guestbook copy and every ready Guestbook submission for a celebration.';

revoke all on function public.get_host_guestbook(uuid) from public, anon;
grant execute on function public.get_host_guestbook(uuid) to authenticated;

create or replace function public.get_guest_guestbook(
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
  v_guestbook public.event_guestbooks%rowtype;
  v_clean_code text;
  v_messages jsonb;
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

  insert into public.event_guestbooks (celebration_id)
  values (v_celebration.id)
  on conflict (celebration_id) do nothing;

  select * into v_guestbook
  from public.event_guestbooks
  where celebration_id = v_celebration.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'storage_path', mi.original_storage_path,
      'captured_at', mi.captured_at,
      'media_type', mi.media_type,
      'duration_ms', mi.duration_ms,
      'mime_type', mi.mime_type,
      'width', mi.width,
      'height', mi.height,
      'is_mine', true
    )
    order by mi.captured_at desc, mi.created_at desc
  ), '[]'::jsonb) into v_messages
  from public.media_items mi
  where mi.event_session_id = v_session.id
    and mi.guest_session_id = v_guest.id
    and mi.status = 'ready'
    and mi.deleted_at is null
    and coalesce(mi.metadata ->> 'submission_kind', '') = 'guestbook';

  return jsonb_build_object(
    'guestbook', jsonb_build_object(
      'id', v_guestbook.id,
      'celebration_id', v_guestbook.celebration_id,
      'instructions', v_guestbook.instructions
    ),
    'guest', jsonb_build_object(
      'id', v_guest.id,
      'display_name', v_guest.display_name
    ),
    'messages', v_messages
  );
end;
$$;

comment on function public.get_guest_guestbook(text, text) is
  'Returns Guestbook copy plus only the calling guest''s own ready Guestbook submissions.';

revoke all on function public.get_guest_guestbook(text, text) from public;
grant execute on function public.get_guest_guestbook(text, text) to anon, authenticated;

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
      'height', mi.height
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
    where guest_session_id = v_guest.id
      and deleted_at is null
      and status <> 'permanent_failed'
      and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

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
          media_type = p_media_type,
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
      p_media_type, p_source, 'queued', p_mime_type, p_file_size_bytes, p_captured_at,
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
          media_type = p_media_type,
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
      p_media_type, p_source, 'queued', p_mime_type, p_file_size_bytes, p_captured_at,
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
  v_is_guestbook_submission boolean;
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

  v_is_guestbook_submission := coalesce(v_item.metadata ->> 'submission_kind', '') = 'guestbook';

  if v_item.media_type in ('video', 'audio') then
    if coalesce(p_duration_ms, 0) <= 0 or p_duration_ms > 30000 then
      raise exception '% must be 30 seconds or less', v_item.media_type using errcode = '22023';
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
    'shots_used', case when v_is_guestbook_submission then v_shots_used else v_shots_used end
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
    if coalesce(p_duration_ms, 0) <= 0 or p_duration_ms > 30000 then
      raise exception '% must be 30 seconds or less', v_item.media_type using errcode = '22023';
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
