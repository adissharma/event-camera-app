-- Real guest media upload pipeline.
--
-- Until now, `camera_and_library`/`camera_only` (`event_sessions.capture_mode`)
-- had no effect at all: the camera screen wrote every capture straight into
-- local AsyncStorage and never touched Storage or `media_items`, for guests
-- and hosts alike. This migration builds the guest side of the real pipeline
-- the schema was already designed for — `storage.objects`' own comment says
-- "Guest uploads are authorised by the server-side upload-intent operation,
-- which issues a scoped credential after validating the guest's token" (see
-- 20260728100700_storage.sql) — that operation never existed until now.
--
-- Two RPCs, mirroring the existing create/publish split used elsewhere:
--   1. create_guest_media_upload_intent — validates the guest, the event's
--      capture_mode against the requested source, and the shot limit; then
--      reserves a media_items row and a storage path.
--   2. finalize_guest_media_upload — called after the client has put the
--      bytes in place; records the result and marks the item ready.
--
-- PRE-LAUNCH SIMPLIFICATION, same spirit as publish_celebration's payment
-- handling: there is no Edge Function in this project to call the Storage API
-- from the server, so the "scoped credential" is expressed as a live,
-- unexpired `upload_intents` row matching the exact object path (enforced by
-- the INSERT policy below) rather than a signed URL, and `finalize_guest_
-- media_upload` trusts the client-reported size/mime/checksum rather than
-- re-reading the object from Storage to verify it independently. Before
-- launch this needs a real signed-URL-issuing Edge Function and server-side
-- verification at finalisation — both call out to the Storage API, which SQL
-- alone cannot do. Processing (variants, moderation) is queued as a
-- `processing_jobs` row but left `pending`: no worker exists yet to claim it,
-- matching how `media_variants`/`processing_jobs` were already designed as a
-- later, asynchronous phase.

-- ---------------------------------------------------------------------------
-- get_guest_gallery: add capture_mode to the session projection.
--
-- The camera screen needs to know whether the camera-roll picker should show
-- at all, and a guest has no other way to read event_sessions.capture_mode —
-- RLS on that table is `to authenticated` only.
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
    'photos', v_photos
  );
end;
$$;

comment on function public.get_guest_gallery is
  'Retrieves event details (including capture_mode), session configuration, and guest-specific photo list securely, resolving the celebration by its guest-facing event_code and validating the guest token.';

-- ---------------------------------------------------------------------------
-- Helper: file extension from MIME type. Storage paths carry a real
-- extension (see storage.sql's path convention comment), and the client only
-- reliably reports MIME type, not a filename.
-- ---------------------------------------------------------------------------

create or replace function private.extension_for_mime_type(p_mime_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_mime_type, ''))
    when 'image/jpeg' then 'jpg'
    when 'image/jpg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/heic' then 'heic'
    when 'image/heif' then 'heif'
    when 'image/webp' then 'webp'
    else 'jpg' -- Photo capture defaults to JPEG; an unrecognised type still
               -- needs a usable path rather than failing the whole intent.
  end;
$$;

-- ---------------------------------------------------------------------------
-- create_guest_media_upload_intent
-- ---------------------------------------------------------------------------

create or replace function public.create_guest_media_upload_intent(
  p_event_code text,
  p_guest_token text,
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

  -- The setting this whole pipeline exists to respect: capture_mode decides
  -- which sources are legal, not a client-side flag.
  if p_source = 'library' and v_session.capture_mode = 'camera_only' then
    raise exception 'camera roll uploads are not enabled for this event' using errcode = '42501';
  end if;
  if p_source = 'camera' and v_session.capture_mode = 'library_only' then
    raise exception 'camera capture is not enabled for this event' using errcode = '42501';
  end if;

  -- Shot limit. Counts everything that isn't a dead end, so an in-flight
  -- upload already claims its slot rather than allowing a burst past the
  -- limit while several uploads are still in progress.
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

  -- Idempotency: a retried request for the same client-generated id reuses
  -- the same row and path rather than creating a duplicate contribution.
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
      id, event_session_id, guest_session_id, client_media_id,
      media_type, source, status, mime_type, file_size_bytes, captured_at
    )
    values (
      v_media_item_id, v_session.id, v_guest.id, p_client_media_id,
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

comment on function public.create_guest_media_upload_intent is
  'Validates a guest against capture_mode and the shot limit, then reserves a media_items row and storage path. The returned path is only writable while a live upload_intents row for it exists — see the storage.objects insert policy below.';

revoke all on function public.create_guest_media_upload_intent from public, anon;
grant execute on function public.create_guest_media_upload_intent to anon, authenticated;

-- ---------------------------------------------------------------------------
-- finalize_guest_media_upload
-- ---------------------------------------------------------------------------

create or replace function public.finalize_guest_media_upload(
  p_media_item_id uuid,
  p_guest_token text,
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
  v_guest public.guest_sessions%rowtype;
  v_intent public.upload_intents%rowtype;
  v_shots_used integer;
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

  -- Already finalised: idempotent success, matching publish_celebration's
  -- own "retry after a timeout converges" idempotency, rather than erroring
  -- on a second finalise call for the same upload.
  if v_item.status = 'ready' then
    select count(*)::integer into v_shots_used
    from public.media_items
    where guest_session_id = v_guest.id
      and deleted_at is null
      and status <> 'permanent_failed';

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

  -- See the migration header: trusting client-reported metadata here rather
  -- than re-reading the object from Storage is a pre-launch simplification.
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

  -- Queued for a future worker. No worker exists yet — see migration header —
  -- so this row simply waits, matching how media_variants/processing_jobs
  -- were already designed as a later phase.
  insert into public.processing_jobs (media_item_id, job_type, status)
  values (p_media_item_id, 'generate_image_variants', 'pending');

  select count(*)::integer into v_shots_used
  from public.media_items
  where guest_session_id = v_guest.id
    and deleted_at is null
    and status <> 'permanent_failed';

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'status', v_item.status,
    'storage_path', v_item.original_storage_path,
    'shots_used', v_shots_used
  );
end;
$$;

comment on function public.finalize_guest_media_upload is
  'Marks a guest media upload ready after the client has written the bytes to the path returned by create_guest_media_upload_intent, and returns the guest''s updated shots-used count.';

revoke all on function public.finalize_guest_media_upload from public, anon;
grant execute on function public.finalize_guest_media_upload to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage RLS: the "scoped credential" the storage.sql comment refers to.
--
-- A write is authorised only for a path that exactly matches a live,
-- unexpired, uncompleted upload_intents row — which only exists because
-- create_guest_media_upload_intent already validated the guest, capture_mode
-- and shot limit. `anon` still has no standing access to the bucket at all;
-- this grants exactly one write, to exactly one path, for a limited time.
--
-- `anon` has no SELECT grant on upload_intents (deliberately — that table is
-- otherwise only ever touched through SECURITY DEFINER RPCs), so the check
-- itself has to run as one, the same way private.can_access_storage_path
-- already does for the covers/qr-assets policies above. A raw subquery here
-- would fail with "permission denied for table upload_intents" before RLS
-- ever gets to evaluate it.
-- ---------------------------------------------------------------------------

create or replace function private.has_live_upload_intent(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.upload_intents ui
    where ui.bucket = p_bucket
      and ui.storage_path = p_path
      and ui.completed_at is null
      and ui.cancelled_at is null
      and ui.expires_at > now()
  );
$$;

create policy "event media: guest write via live upload intent"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'event-media'
    and private.has_live_upload_intent(bucket_id, name)
  );

-- Read access for guests. PRE-LAUNCH SIMPLIFICATION: this covers the common
-- case (an unlocked, all_guests gallery) but not "a guest can always see
-- their own photo even while the gallery is otherwise locked or own_only" —
-- that rule (already implemented in get_guest_gallery's own row selection)
-- needs the request to carry the asking guest's identity, which a plain
-- storage.objects policy cannot see: every guest shares the same anon API
-- key, with nothing per-guest in the request for a policy to check. Doing
-- this exactly right needs signed URLs issued per guest by a server-side
-- operation — the same Edge Function gap noted at the top of this file.
create or replace function private.is_readable_unlocked_guest_media(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_items mi
    join public.event_sessions es on es.id = mi.event_session_id
    where mi.original_storage_path = p_path
      and mi.status = 'ready'
      and mi.deleted_at is null
      and es.gallery_visibility = 'all_guests'
      and not (
        (es.reveal_mode = 'scheduled' and es.reveal_at is not null and es.reveal_at > now())
        or es.reveal_mode = 'manual'
      )
  );
$$;

create policy "event media: guest read unlocked all-guests galleries"
  on storage.objects for select to anon
  using (
    bucket_id = 'event-media'
    and private.is_readable_unlocked_guest_media(name)
  );
