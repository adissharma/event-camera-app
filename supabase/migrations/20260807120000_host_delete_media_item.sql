create or replace function public.delete_host_media_item(
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
    raise exception 'not permitted to delete this media item' using errcode = '42501';
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

  return jsonb_build_object(
    'media_item_id', v_item.id,
    'deleted_at', v_item.deleted_at
  );
end;
$$;

comment on function public.delete_host_media_item is
  'Soft-deletes a media item when the current authenticated user manages the event session.';

revoke all on function public.delete_host_media_item from public;
grant execute on function public.delete_host_media_item to authenticated;
