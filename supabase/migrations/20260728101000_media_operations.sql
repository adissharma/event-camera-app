-- Guest join, and the two idempotent media operations.
--
-- These are the reliability core of the product. A guest photographs something
-- that happens once, on a saturated venue network, on a phone that may be
-- backgrounded or run out of battery mid-upload. The operations below are
-- written so that every retry path converges rather than duplicating or losing
-- a contribution.
--
-- All are SECURITY DEFINER with a pinned empty search_path. Clients hold no
-- INSERT privilege on media_items or guest_sessions precisely so that these
-- functions are the only way in — every limit and state check lives here and
-- cannot be bypassed by writing to a table directly.

-- ---------------------------------------------------------------------------
-- Guest join
-- ---------------------------------------------------------------------------

create type public.joined_guest_session as (
  guest_session_id uuid,
  event_session_id uuid,
  celebration_id uuid,
  guest_token text,
  display_name text,
  shot_limit_per_guest integer,
  shots_used integer
);

create or replace function public.join_event_session(
  p_access_token text,
  p_display_name text default null,
  p_pin text default null,
  p_device_fingerprint text default null
)
returns public.joined_guest_session
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.access_links%rowtype;
  v_session public.event_sessions%rowtype;
  v_guest public.guest_sessions%rowtype;
  v_token text;
  v_shots integer;
begin
  select * into v_link
  from public.access_links
  where token_hash = private.digest_token(p_access_token)
    and kind = 'guest';

  -- Deliberately the same error for "no such link" and "revoked link": a
  -- distinguishable response would let someone probe which tokens exist.
  if not found or not v_link.is_active then
    raise exception 'invalid access link' using errcode = '42501';
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= now() then
    raise exception 'access link expired' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where id = v_link.event_session_id and deleted_at is null;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  if v_session.status = 'draft' then
    raise exception 'event not yet published' using errcode = '42501';
  end if;

  if v_session.status = 'archived' then
    raise exception 'event archived' using errcode = '42501';
  end if;

  if v_session.pin_required then
    if p_pin is null or v_link.pin_hash is null
       or v_link.pin_hash <> private.digest_token(p_pin) then
      raise exception 'incorrect pin' using errcode = '42501';
    end if;
  end if;

  -- A returning guest keeps their identity, so their shot count and their own
  -- contributions survive a browser reload. Matching is on a salted device
  -- fingerprint; no raw device identifier is ever stored.
  if p_device_fingerprint is not null then
    select * into v_guest
    from public.guest_sessions
    where event_session_id = v_session.id
      and device_identifier_hash = private.digest_token(p_device_fingerprint)
    limit 1;
  end if;

  if found and v_guest.id is not null then
    -- ROTATE the token on every rejoin.
    --
    -- Only a digest is stored, so the original cannot be handed back. Returning
    -- nothing would strand a guest who cleared their browser storage and
    -- rescanned the QR: they would rejoin successfully and then be unable to
    -- upload anything, because every subsequent call authenticates with a token
    -- they no longer hold.
    --
    -- Issuing a fresh token preserves the guest's identity — and therefore
    -- their shot count and their own contributions — while giving them a
    -- working credential. It also invalidates the previous token, which is the
    -- desirable behaviour for a bearer credential that may have leaked via a
    -- shared screenshot of the QR.
    v_token := private.generate_access_token();

    update public.guest_sessions
      set last_seen_at = now(),
          anonymous_token_hash = private.digest_token(v_token),
          display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
      where id = v_guest.id
      returning * into v_guest;
  else
    v_token := private.generate_access_token();
    insert into public.guest_sessions (
      event_session_id, display_name, anonymous_token_hash,
      device_identifier_hash, consent_at
    )
    values (
      v_session.id,
      nullif(trim(p_display_name), ''),
      private.digest_token(v_token),
      case when p_device_fingerprint is null then null
           else private.digest_token(p_device_fingerprint) end,
      now()
    )
    returning * into v_guest;
  end if;

  select count(*)::integer into v_shots
  from public.media_items
  where guest_session_id = v_guest.id
    and deleted_at is null
    and status <> 'permanent_failed';

  return (
    v_guest.id, v_session.id, v_session.celebration_id, v_token,
    v_guest.display_name, v_session.shot_limit_per_guest, v_shots
  )::public.joined_guest_session;
end;
$$;

comment on function public.join_event_session is
  'Validates a guest access token and returns (or reuses) a guest session. The '
  'only way a guest_sessions row is ever created — clients hold no INSERT '
  'privilege on that table.';

-- ---------------------------------------------------------------------------
-- Upload intent
-- ---------------------------------------------------------------------------

create type public.media_upload_intent as (
  media_item_id uuid,
  upload_intent_id uuid,
  bucket text,
  storage_path text,
  protocol public.upload_protocol,
  expires_at timestamptz,
  is_existing boolean
);

create or replace function public.create_media_upload_intent(
  p_event_session_id uuid,
  p_client_media_id uuid,
  p_media_type public.media_type default 'photo',
  p_source public.media_source default 'camera',
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_guest_token text default null,
  p_captured_at timestamptz default null,
  p_file_extension text default 'jpg'
)
returns public.media_upload_intent
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.event_sessions%rowtype;
  v_celebration public.celebrations%rowtype;
  v_guest public.guest_sessions%rowtype;
  v_user_id uuid := (select auth.uid());
  v_media public.media_items%rowtype;
  v_intent public.upload_intents%rowtype;
  v_path text;
  v_shots integer;
  v_is_existing boolean := false;
  v_ext text;
begin
  select * into v_session
  from public.event_sessions
  where id = p_event_session_id and deleted_at is null;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  select * into v_celebration
  from public.celebrations where id = v_session.celebration_id and deleted_at is null;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  -- Identify the contributor: a guest holding a token, or an authenticated host.
  if p_guest_token is not null then
    select * into v_guest
    from public.guest_sessions
    where anonymous_token_hash = private.digest_token(p_guest_token)
      and event_session_id = p_event_session_id;

    -- Also catches a guest presenting a valid token for a DIFFERENT event.
    if not found then
      raise exception 'invalid guest session for this event' using errcode = '42501';
    end if;
  elsif v_user_id is null or not private.can_manage_event_session(p_event_session_id) then
    raise exception 'not permitted to contribute to this event' using errcode = '42501';
  end if;

  -- Event state. Hosts may add media to a draft; guests may not.
  if v_guest.id is not null then
    if v_session.status = 'draft' then
      raise exception 'event not yet published' using errcode = '42501';
    end if;

    if v_session.status in ('closed', 'revealed', 'archived')
       or (v_session.ends_at is not null and v_session.ends_at <= now()) then
      -- A closed event may still accept camera-roll uploads if the host allowed
      -- it. Live capture is always refused once closed.
      if not (v_session.camera_roll_uploads_after_close and p_source = 'library') then
        raise exception 'event closed' using errcode = '42501';
      end if;
    end if;
  end if;

  if not (p_media_type = any (v_session.allowed_media_types)) then
    raise exception 'media type not permitted for this event' using errcode = '42501';
  end if;

  if p_source = 'camera' and v_session.capture_mode = 'library_only' then
    raise exception 'camera capture not permitted for this event' using errcode = '42501';
  end if;

  if p_source = 'library' and v_session.capture_mode = 'camera_only' then
    raise exception 'library uploads not permitted for this event' using errcode = '42501';
  end if;

  if p_mime_type is not null and p_media_type = 'photo'
     and p_mime_type not in ('image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp') then
    raise exception 'unsupported file type' using errcode = '22023';
  end if;

  if p_size_bytes is not null and p_size_bytes <= 0 then
    raise exception 'empty file' using errcode = '22023';
  end if;

  if p_size_bytes is not null and p_size_bytes > 524288000 then
    raise exception 'file too large' using errcode = '22023';
  end if;

  -- IDEMPOTENCY. A retried request for the same client id must return the same
  -- media row, never create a second one. This is why client_media_id is
  -- generated on the device before any network access.
  select * into v_media
  from public.media_items
  where event_session_id = p_event_session_id
    and client_media_id = p_client_media_id;

  if found then
    v_is_existing := true;

    if v_media.status = 'ready' then
      raise exception 'media already finalised' using errcode = '23505';
    end if;

    if v_media.deleted_at is not null then
      raise exception 'media deleted' using errcode = '42501';
    end if;
  else
    -- Shot limit applies only to NEW contributions, so a retry of an in-flight
    -- upload can never be refused by a limit the guest has already reached.
    if v_guest.id is not null and v_session.shot_limit_per_guest is not null then
      select count(*)::integer into v_shots
      from public.media_items
      where guest_session_id = v_guest.id
        and deleted_at is null
        and status <> 'permanent_failed';

      if v_shots >= v_session.shot_limit_per_guest then
        raise exception 'shot limit reached' using errcode = '53400';
      end if;
    end if;

    insert into public.media_items (
      event_session_id, guest_session_id, uploaded_by_user_id,
      client_media_id, media_type, source, status,
      mime_type, file_size_bytes, captured_at
    )
    values (
      p_event_session_id, v_guest.id,
      case when v_guest.id is null then v_user_id else null end,
      p_client_media_id, p_media_type, p_source, 'upload_authorising',
      p_mime_type, p_size_bytes, p_captured_at
    )
    returning * into v_media;
  end if;

  -- Reuse a live intent rather than minting a second authorisation for the
  -- same object.
  select * into v_intent
  from public.upload_intents
  where media_item_id = v_media.id
    and completed_at is null
    and cancelled_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    return (
      v_media.id, v_intent.id, v_intent.bucket, v_intent.storage_path,
      v_intent.protocol, v_intent.expires_at, v_is_existing
    )::public.media_upload_intent;
  end if;

  v_ext := lower(regexp_replace(coalesce(p_file_extension, 'jpg'), '[^a-zA-Z0-9]', '', 'g'));
  if v_ext = '' then v_ext := 'jpg'; end if;

  -- Immutable, versioned path. Never overwritten in place — a replacement is
  -- -v2, because overwriting breaks caches in ways that surface as a guest
  -- seeing someone else's photograph.
  v_path := v_celebration.workspace_id || '/' || v_celebration.id || '/'
         || v_session.id || '/' || v_media.id || '/original-v1.' || v_ext;

  insert into public.upload_intents (
    media_item_id, bucket, storage_path, protocol,
    expected_mime_type, expected_size_bytes, expires_at
  )
  values (
    v_media.id, 'event-media', v_path,
    -- TUS above 5 MB: a venue network drops often enough that restarting a
    -- large upload from zero is a real failure mode, not a theoretical one.
    (case when coalesce(p_size_bytes, 0) > 5242880 then 'tus' else 'standard' end)::public.upload_protocol,
    p_mime_type, p_size_bytes, now() + interval '1 hour'
  )
  returning * into v_intent;

  update public.media_items
    set status = 'queued', original_storage_path = v_path
    where id = v_media.id;

  return (
    v_media.id, v_intent.id, v_intent.bucket, v_intent.storage_path,
    v_intent.protocol, v_intent.expires_at, v_is_existing
  )::public.media_upload_intent;
end;
$$;

comment on function public.create_media_upload_intent is
  'Idempotent. Enforces event state, capture mode, permitted media types, MIME '
  'type, size and the per-guest shot limit. Returns the existing media row and '
  'a live intent when called again for the same client_media_id.';

-- ---------------------------------------------------------------------------
-- Finalisation
-- ---------------------------------------------------------------------------

create or replace function public.finalise_media_upload(
  p_media_item_id uuid,
  p_upload_intent_id uuid,
  p_actual_size_bytes bigint default null,
  p_checksum_algorithm text default null,
  p_checksum_value text default null,
  p_guest_token text default null
)
returns public.media_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media public.media_items%rowtype;
  v_intent public.upload_intents%rowtype;
  v_guest public.guest_sessions%rowtype;
begin
  select * into v_media from public.media_items where id = p_media_item_id;
  if not found then
    raise exception 'media not found' using errcode = '42501';
  end if;

  -- Authorisation: the owning guest, or a manager of the event.
  if p_guest_token is not null then
    select * into v_guest
    from public.guest_sessions
    where anonymous_token_hash = private.digest_token(p_guest_token);

    if not found or v_media.guest_session_id is distinct from v_guest.id then
      raise exception 'not permitted' using errcode = '42501';
    end if;
  elsif not private.can_manage_event_session(v_media.event_session_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  -- IDEMPOTENCY. Finalising twice is normal — a client that loses the response
  -- and retries must not double-enqueue processing or reset progress.
  if v_media.status in ('verifying', 'processing', 'ready') then
    return v_media;
  end if;

  select * into v_intent
  from public.upload_intents
  where id = p_upload_intent_id and media_item_id = p_media_item_id;

  if not found then
    raise exception 'upload intent not found for this media' using errcode = '42501';
  end if;

  if v_intent.cancelled_at is not null then
    raise exception 'upload intent cancelled' using errcode = '42501';
  end if;

  if v_intent.expires_at <= now() then
    raise exception 'upload intent expired' using errcode = '42501';
  end if;

  -- The object must live exactly where the intent said. A mismatch means the
  -- client wrote somewhere it was not authorised to.
  if v_media.original_storage_path is distinct from v_intent.storage_path then
    raise exception 'storage path mismatch' using errcode = '42501';
  end if;

  if p_actual_size_bytes is not null then
    if p_actual_size_bytes <= 0 then
      raise exception 'empty file' using errcode = '22023';
    end if;

    -- A declared size that the upload did not match means a truncated or
    -- swapped object. Tolerance is zero on purpose.
    if v_intent.expected_size_bytes is not null
       and p_actual_size_bytes <> v_intent.expected_size_bytes then
      raise exception 'size mismatch' using errcode = '22023';
    end if;
  end if;

  update public.upload_intents set completed_at = now() where id = v_intent.id;

  update public.media_items
    set status = 'verifying',
        uploaded_at = now(),
        file_size_bytes = coalesce(p_actual_size_bytes, file_size_bytes),
        checksum_algorithm = coalesce(p_checksum_algorithm, checksum_algorithm),
        checksum_value = coalesce(p_checksum_value, checksum_value),
        failure_code = null,
        failure_message = null
    where id = p_media_item_id
    returning * into v_media;

  -- Enqueue processing. `on conflict do nothing` against the partial unique
  -- index below is what keeps a duplicate finalisation from queueing the same
  -- work twice.
  insert into public.processing_jobs (media_item_id, job_type, priority)
  values
    (p_media_item_id, 'verify_object', 10),
    (p_media_item_id, 'extract_metadata', 20),
    (p_media_item_id, 'generate_image_variants', 30),
    (p_media_item_id, 'strip_derivative_metadata', 40)
  on conflict do nothing;

  return v_media;
end;
$$;

comment on function public.finalise_media_upload is
  'Idempotent. Verifies the intent is live, the path matches and the size is as '
  'declared, then moves the item to verifying and enqueues processing. Calling '
  'it again after success is a no-op that returns the same row.';

-- Prevents duplicate outstanding work for one item, which is what makes the
-- `on conflict do nothing` above meaningful.
create unique index processing_jobs_unique_pending_idx
  on public.processing_jobs (media_item_id, job_type)
  where status in ('pending', 'available', 'running', 'retrying');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- anon may call join and the guest upload operations: a guest has no account by
-- design. Every one of these validates a token internally and none of them
-- grants table access.

revoke all on function public.join_event_session from public;
grant execute on function public.join_event_session to anon, authenticated;

revoke all on function public.create_media_upload_intent from public;
grant execute on function public.create_media_upload_intent to anon, authenticated;

revoke all on function public.finalise_media_upload from public;
grant execute on function public.finalise_media_upload to anon, authenticated;
