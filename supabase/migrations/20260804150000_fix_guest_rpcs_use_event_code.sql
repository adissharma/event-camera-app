-- Fixes a third bug traced back to 20260801140000_event_codes.sql: it
-- introduced the `event_code` column and had `publish_celebration` generate
-- one, and the client was updated to build guest share links from it
-- (`buildGuestUrl(published.event_code, ...)` in publication.ts) — but none
-- of the three guest-facing lookup RPCs were ever updated to match. All three
-- still resolve the celebration by `public_slug`, despite their parameter
-- being named `p_event_code` and receiving the actual event_code value from
-- the client. Every newly published event is therefore unreachable by its own
-- share link with "invalid event code" / "event not found or unavailable",
-- surfaced to the guest as the generic "This invitation is no longer
-- available."
--
-- This went unnoticed through everything tested earlier in this session
-- because the one event ever used for guest-side testing — the seeded demo
-- event — has its public_slug and event_code set to the same literal value in
-- seed.sql, which predates the event_code column entirely. A real event
-- published through the app has a properly generated 6-character event_code
-- that is never equal to its public_slug, so this only surfaced once an event
-- created through the actual publish flow was tested end to end.
--
-- Fixes, matching function signatures exactly so `create or replace` updates
-- them in place rather than creating overloads:
--   - get_event_preview_by_code
--   - join_event_by_code
--   - get_guest_gallery

create or replace function public.get_event_preview_by_code(
  p_event_code text
)
returns public.guest_event_preview
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_preview public.guest_event_preview;
  v_clean_code text;
begin
  v_clean_code := trim(lower(p_event_code));

  if v_clean_code is null or v_clean_code = '' then
    raise exception 'invalid event code' using errcode = '42501';
  end if;

  select * into v_celebration
  from public.celebrations
  where lower(event_code) = v_clean_code
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'invalid event code' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  v_preview.celebration_id := v_celebration.id;
  v_preview.title := v_celebration.title;
  v_preview.ends_at := coalesce(v_session.ends_at, v_celebration.ends_at);
  v_preview.shot_limit_per_guest := v_session.shot_limit_per_guest;
  v_preview.cover_storage_path := v_celebration.cover_storage_path;

  return v_preview;
end;
$$;

comment on function public.get_event_preview_by_code is
  'Fetches preview details for an event cover screen using its guest-facing event_code. Security definer bypasses RLS for anonymous preview access.';

revoke all on function public.get_event_preview_by_code from public;
grant execute on function public.get_event_preview_by_code to anon, authenticated;

create or replace function public.join_event_by_code(
  p_event_code text,
  p_display_name text,
  p_device_fingerprint text default null
)
returns public.joined_guest_session
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_link public.access_links%rowtype;
  v_token text;
  v_guest public.guest_sessions%rowtype;
  v_shots integer;
begin
  -- 1. Resolve celebration and verify availability
  select * into v_celebration
  from public.celebrations
  where lower(event_code) = trim(lower(p_event_code))
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'event not found or unavailable' using errcode = '42501';
  end if;

  -- 2. Resolve event session
  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  -- 3. Resolve the active guest access link for this session
  select * into v_link
  from public.access_links
  where event_session_id = v_session.id
    and kind = 'guest'
    and is_active = true
  limit 1;

  if not found then
    raise exception 'no active guest access link' using errcode = '42501';
  end if;

  -- 4. Re-use or create guest session idempotently
  if p_device_fingerprint is not null then
    select * into v_guest
    from public.guest_sessions
    where event_session_id = v_session.id
      and device_identifier_hash = private.digest_token(p_device_fingerprint)
    limit 1;
  end if;

  if found and v_guest.id is not null then
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

comment on function public.join_event_by_code is
  'Registers or resumes a guest session using the guest-facing event_code directly, resolving the default access link server-side.';

revoke all on function public.join_event_by_code from public;
grant execute on function public.join_event_by_code to anon, authenticated;

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

  -- Resolve the celebration
  select * into v_celebration
  from public.celebrations
  where lower(event_code) = v_clean_code
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'event not found or unavailable' using errcode = '42501';
  end if;

  -- Resolve the event session
  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  -- Resolve and validate the guest using the guest token
  select * into v_guest
  from public.guest_sessions
  where anonymous_token_hash = private.digest_token(p_guest_token)
    and event_session_id = v_session.id;

  if not found then
    raise exception 'invalid guest session for this event' using errcode = '42501';
  end if;

  -- Check if gallery is locked
  v_is_locked := (v_session.reveal_mode = 'scheduled' and v_session.reveal_at is not null and v_session.reveal_at > now())
              or v_session.reveal_mode = 'manual';

  -- Enforce gallery visibility and lock settings securely
  -- Returns:
  --   1. Guests can always see their own photos (even if locked).
  --   2. Other photos are only returned if NOT locked AND visible to guests.
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

  -- Count the guest's own photos to compute shots used accurately
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
  'Retrieves event details, session configurations, and guest-specific photo list securely, resolving the celebration by its guest-facing event_code and validating the guest token.';
