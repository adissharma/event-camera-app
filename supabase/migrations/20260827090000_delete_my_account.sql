-- Account deletion is intentionally performed in one database transaction.
-- The client can invoke this only for its own authenticated user; deleting the
-- Auth row also revokes sessions and removes provider identity links. Storage
-- objects are queued before relational rows cascade so the server-side worker
-- can remove bytes even after the account itself no longer exists.

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_job_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Lock the account for the duration, preventing a concurrent request from
  -- creating more host-owned rows while the cascade is being prepared.
  perform 1 from auth.users where id = v_user_id for update;
  if not found then
    raise exception 'account no longer exists' using errcode = 'P0002';
  end if;

  -- Every product-owned object is stored below {workspaceId}/{celebrationId}.
  -- Queue exact object names from all private buckets, including covers, QR
  -- assets, originals, thumbnails and generated variants.
  with deleted_celebrations as (
    select c.id, c.workspace_id
    from public.celebrations c
    where c.created_by = v_user_id
       or c.workspace_id in (
         select w.id from public.workspaces w where w.created_by = v_user_id
       )
  ), queued as (
    insert into public.storage_deletion_jobs (bucket, storage_path)
    select distinct so.bucket_id, so.name
    from storage.objects so
    join deleted_celebrations c
      on so.name like c.workspace_id::text || '/' || c.id::text || '/%'
    where so.bucket_id in ('event-media', 'celebration-covers', 'qr-assets')
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_job_ids from queued;

  -- Delete explicitly-created events first to satisfy the restrictive
  -- celebrations.created_by foreign key. Cascades then remove sessions,
  -- guest sessions, guestbook entries, challenges, media, variants, recaps,
  -- uploads, purchase records and related collaboration rows.
  delete from public.celebrations c
  where c.created_by = v_user_id
     or c.workspace_id in (
       select w.id from public.workspaces w where w.created_by = v_user_id
     );

  -- Remove personal and any other workspaces created by this account. This
  -- also removes workspace memberships; membership in other users' workspaces
  -- is removed by the Auth-user cascade below.
  delete from public.workspaces where created_by = v_user_id;

  -- This is the material difference from the old profile-only flow: deleting
  -- auth.users removes the Supabase identity links and invalidates sessions.
  delete from auth.users where id = v_user_id;

  return jsonb_build_object(
    'deleted', true,
    'storage_deletion_job_ids', to_jsonb(v_job_ids)
  );
end;
$$;

comment on function public.delete_my_account() is
  'Atomically deletes the authenticated user, owned workspaces/events and cascading data, while queuing related private storage objects for deletion.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
