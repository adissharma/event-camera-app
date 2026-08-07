-- Allow a guest to remove only their own uploaded media.
--
-- Clients cannot update media_items directly. This RPC keeps that policy intact:
-- the guest token must match the media item's guest_session_id, then the item is
-- soft-deleted and queued for deferred object cleanup.

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

  v_is_locked := v_session.gallery_visibility = 'hosts_only'
              or (v_session.reveal_mode = 'scheduled' and v_session.reveal_at is not null and v_session.reveal_at > now())
              or v_session.reveal_mode = 'manual';

  if v_session.gallery_visibility = 'hosts_only' then
    v_photos := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', mi.id,
        'storage_path', mi.original_storage_path,
        'captured_at', mi.captured_at,
        'display_name', coalesce(g.display_name, 'Guest'),
        'is_mine', mi.guest_session_id = v_guest.id
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
  end if;

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
      'photo_treatment', v_session.photo_treatment,
      'date_stamp_enabled', v_session.date_stamp_enabled,
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
  'Retrieves event details, session configurations, and guest-specific photo list securely, resolving the celebration by its guest-facing event_code and validating the guest token.';

revoke all on function public.get_guest_gallery from public;
grant execute on function public.get_guest_gallery to anon, authenticated;

create or replace function public.delete_guest_media_item(
  p_media_item_id uuid,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.media_items%rowtype;
  v_guest public.guest_sessions%rowtype;
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
    raise exception 'guest cannot delete this media item' using errcode = '42501';
  end if;

  update public.media_items
  set deleted_at = now()
  where id = v_item.id
    and deleted_at is null
  returning * into v_item;

  if v_item.original_storage_path is not null then
    insert into public.storage_deletion_jobs (media_item_id, bucket, storage_path)
    values (v_item.id, 'event-media', v_item.original_storage_path);
  end if;

  select count(*)::integer into v_shots_used
  from public.media_items
  where guest_session_id = v_guest.id
    and deleted_at is null
    and status <> 'permanent_failed';

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'deleted_at', v_item.deleted_at,
    'shots_used', v_shots_used
  );
end;
$$;

comment on function public.delete_guest_media_item is
  'Soft-deletes a media item only when the supplied guest token owns that item.';

revoke all on function public.delete_guest_media_item from public;
grant execute on function public.delete_guest_media_item to anon, authenticated;
