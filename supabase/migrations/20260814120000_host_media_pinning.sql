-- Allow hosts to pin up to two photos or videos to the top of the event gallery.

alter table public.media_items
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

create index if not exists idx_media_items_pinned
  on public.media_items (event_session_id, is_pinned)
  where is_pinned = true and deleted_at is null;

-- ── Pin RPC ──

create or replace function public.pin_host_media_item(
  p_media_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.media_items%rowtype;
  v_pinned_count integer;
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
    raise exception 'not permitted to pin this media item' using errcode = '42501';
  end if;

  if not v_item.is_pinned then
    select count(*)::integer into v_pinned_count
    from public.media_items
    where event_session_id = v_item.event_session_id
      and is_pinned = true
      and deleted_at is null;

    if v_pinned_count >= 2 then
      raise exception 'Maximum of 2 pinned items allowed' using errcode = '42501';
    end if;

    update public.media_items
      set is_pinned = true,
          pinned_at = now()
      where id = v_item.id
      returning * into v_item;
  end if;

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'is_pinned', true,
    'pinned_at', v_item.pinned_at
  );
end;
$$;

comment on function public.pin_host_media_item is
  'Pins a photo or video to the top of the event gallery (maximum 2 pinned items per session).';

revoke all on function public.pin_host_media_item(uuid) from public;
grant execute on function public.pin_host_media_item(uuid) to authenticated;

-- ── Unpin RPC ──

create or replace function public.unpin_host_media_item(
  p_media_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.media_items%rowtype;
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
    raise exception 'not permitted to unpin this media item' using errcode = '42501';
  end if;

  if v_item.is_pinned then
    update public.media_items
      set is_pinned = false,
          pinned_at = null
      where id = v_item.id
      returning * into v_item;
  end if;

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'is_pinned', false
  );
end;
$$;

comment on function public.unpin_host_media_item is
  'Unpins a photo or video from the top of the event gallery.';

revoke all on function public.unpin_host_media_item(uuid) from public;
grant execute on function public.unpin_host_media_item(uuid) to authenticated;

-- ── Updated Guest Gallery RPC ──

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
      'is_pinned', mi.is_pinned,
      'pinned_at', mi.pinned_at,
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

revoke all on function public.get_guest_gallery(text, text) from public;
grant execute on function public.get_guest_gallery(text, text) to anon, authenticated;
