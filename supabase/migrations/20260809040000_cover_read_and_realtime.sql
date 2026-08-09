-- Make an event's cover readable by the people the event is for.
--
-- `celebration-covers` is a private bucket whose only read policy is
-- "workspace members". A guest is anonymous, so no guest has ever been able to
-- fetch a cover — the invitation page and the gallery hero fell back to stock
-- artwork no matter what the host uploaded. (The host dashboard fared no
-- better: it called `getPublicUrl` against this private bucket, which cannot
-- resolve.)
--
-- The fix is a read policy rather than making the bucket public. A cover is
-- only readable once its event is published, so a draft's artwork stays
-- private, and access remains revocable per-event by unpublishing.

create or replace function private.storage_path_celebration_id(p_name text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_segment text := split_part(p_name, '/', 2);
begin
  -- Fail closed on a malformed path, exactly as storage_path_workspace_id
  -- does: NULL makes every policy comparison below false.
  if v_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return v_segment::uuid;
end;
$$;

comment on function private.storage_path_celebration_id(text) is
  'Celebration id from the second segment of a storage path, or NULL when the path is malformed.';

drop policy if exists "covers: readable for published events" on storage.objects;

create policy "covers: readable for published events"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'celebration-covers'
    and exists (
      select 1
      from public.celebrations c
      where c.id = private.storage_path_celebration_id(name)
        and c.deleted_at is null
        and c.status <> 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
--
-- So a cover swapped on one device reaches another without a reload. As with
-- event_challenges this carries the subscriber's own RLS, so it reaches hosts
-- and collaborators; guests pick the change up on their next fetch.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'celebrations'
  ) then
    alter publication supabase_realtime add table public.celebrations;
  end if;
end;
$$;
