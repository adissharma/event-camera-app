-- Fix the cover read policy so it can actually run as `anon`.
--
-- `20260809040000` inlined `exists (select 1 from public.celebrations ...)` in
-- the policy body. RLS predicates execute as the calling role, and `anon` has
-- no SELECT grant on `public.celebrations`, so signing a cover as a guest
-- failed with `permission denied for table celebrations` rather than simply
-- returning false.
--
-- Every other storage predicate in this schema routes its table access through
-- a `security definer` helper in `private` for exactly this reason. This does
-- the same.

create or replace function private.is_published_celebration_cover(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.celebrations c
    where c.id = private.storage_path_celebration_id(p_name)
      and c.deleted_at is null
      and c.status <> 'draft'
  );
$$;

comment on function private.is_published_celebration_cover(text) is
  'True when a celebration-covers path belongs to a published, undeleted celebration. Security definer so the predicate works for anon, which cannot read public.celebrations.';

revoke all on function private.is_published_celebration_cover(text) from public;
grant execute on function private.is_published_celebration_cover(text) to anon, authenticated;

drop policy if exists "covers: readable for published events" on storage.objects;

create policy "covers: readable for published events"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'celebration-covers'
    and private.is_published_celebration_cover(name)
  );
