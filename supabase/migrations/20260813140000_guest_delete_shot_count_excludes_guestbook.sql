-- Stop Guestbook messages eating into a guest's photo allowance on delete.
--
-- Every other place that counts a guest's shots excludes Guestbook
-- submissions, because a private message to the host is not one of the photos
-- the host allotted them: `create_guest_media_upload_intent` skips them when
-- enforcing the limit, `finalize_guest_media_upload` skips them when reporting
-- the new total, and `get_guest_gallery` skips them when reporting
-- `shots_used`. This function did not.
--
-- The count it returns is not cosmetic — the client writes it straight into
-- the stored guest session, which is what drives the "photos remaining"
-- figure. So a guest who had left a Guestbook message and then deleted any
-- photo had their remaining allowance quietly reduced by the number of
-- messages they had left, and the only way back was rejoining the event.

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
    and status <> 'permanent_failed'
    and coalesce(metadata ->> 'submission_kind', '') <> 'guestbook';

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'deleted_at', v_item.deleted_at,
    'shots_used', v_shots_used
  );
end;
$$;

comment on function public.delete_guest_media_item is
  'Soft-deletes a media item only when the supplied guest token owns that item. The returned shot count excludes Guestbook messages, which do not draw on the guest photo allowance.';

revoke all on function public.delete_guest_media_item from public;
grant execute on function public.delete_guest_media_item to anon, authenticated;
