-- Private storage buckets and their access policies.
--
-- Every bucket is private. Nothing is served from a public URL — reads go
-- through short-lived signed URLs issued after an authorisation check, so a
-- leaked path is not a leaked photograph.
--
-- Path convention (immutable, never rewritten in place):
--
--   event-media:
--     {workspaceId}/{celebrationId}/{eventSessionId}/{mediaItemId}/original-v1.ext
--   celebration-covers:
--     {workspaceId}/{celebrationId}/cover-v1.ext
--   qr-assets:
--     {workspaceId}/{celebrationId}/{eventSessionId}/{templateKey}-v1.png
--
-- The first path segment is always the workspace id, which is what makes the
-- policies below expressible without a join per object.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'celebration-covers', 'celebration-covers', false,
    20971520, -- 20 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  ),
  (
    'event-media', 'event-media', false,
    524288000, -- 500 MB, sized for future video rather than today's photos
    null       -- validated server-side at finalisation by actual file inspection
  ),
  (
    'qr-assets', 'qr-assets', false,
    5242880, -- 5 MB
    array['image/png', 'image/svg+xml', 'application/pdf']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helper: does the caller belong to the workspace this object path begins with?
-- ---------------------------------------------------------------------------

create or replace function private.storage_path_workspace_id(p_name text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_segment text := split_part(p_name, '/', 1);
begin
  -- A malformed path must fail closed, not raise. Returning NULL makes every
  -- policy comparison below false.
  if v_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return v_segment::uuid;
end;
$$;

create or replace function private.can_access_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_workspace_member(private.storage_path_workspace_id(p_name));
$$;

create or replace function private.can_manage_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_workspace_role(
    private.storage_path_workspace_id(p_name),
    array['owner', 'admin']::public.workspace_role[]
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
--
-- `anon` is granted nothing on any bucket. Guest uploads are authorised by the
-- server-side upload-intent operation, which issues a scoped credential after
-- validating the guest's token, the event's open state and the shot limit.

create policy "covers: workspace members read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'celebration-covers'
    and private.can_access_storage_path(name)
  );

create policy "covers: workspace managers write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'celebration-covers'
    and private.can_manage_storage_path(name)
  );

create policy "covers: workspace managers update"
  on storage.objects for update to authenticated
  using (bucket_id = 'celebration-covers' and private.can_manage_storage_path(name))
  with check (bucket_id = 'celebration-covers' and private.can_manage_storage_path(name));

create policy "covers: workspace managers delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'celebration-covers' and private.can_manage_storage_path(name));

create policy "event media: workspace members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-media' and private.can_access_storage_path(name));

-- Hosts may add their own media directly. Guest writes never come through this
-- policy — they are mediated by the upload-intent operation.
create policy "event media: workspace managers write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-media' and private.can_manage_storage_path(name));

-- No client delete on event media. Deletion is queued in
-- storage_deletion_jobs and performed by a worker, so a failed delete is
-- retried rather than silently leaking an object, and so a soft-deleted
-- photograph is recoverable within the retention window.

create policy "qr assets: workspace members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'qr-assets' and private.can_access_storage_path(name));

create policy "qr assets: workspace managers write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'qr-assets' and private.can_manage_storage_path(name));

create policy "qr assets: workspace managers update"
  on storage.objects for update to authenticated
  using (bucket_id = 'qr-assets' and private.can_manage_storage_path(name))
  with check (bucket_id = 'qr-assets' and private.can_manage_storage_path(name));
