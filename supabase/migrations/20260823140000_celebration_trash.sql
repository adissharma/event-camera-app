-- Event Trash / Recently Deleted.
--
-- `deleted_at` is the moment an event moved to Trash. `delete_after` is the
-- server-side expiry used by the scheduled purge. Normal app and guest queries
-- already exclude `deleted_at`, while the RPCs below give hosts a narrow,
-- recoverable management path.

alter table public.celebrations
  add column if not exists delete_after timestamptz;

comment on column public.celebrations.deleted_at is
  'When the event was moved to Trash. Null means active/readable.';

comment on column public.celebrations.delete_after is
  'When a trashed event becomes eligible for permanent deletion.';

create index if not exists celebrations_trash_expiry_idx
  on public.celebrations (delete_after)
  where deleted_at is not null;

create index if not exists celebrations_workspace_trash_idx
  on public.celebrations (workspace_id, deleted_at desc)
  where deleted_at is not null;

create or replace function private.can_manage_celebration_including_trashed(
  p_celebration_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.celebrations c
    where c.id = p_celebration_id
      and (
        private.has_workspace_role(c.workspace_id, array['owner', 'admin']::public.workspace_role[])
        or exists (
          select 1
          from public.celebration_collaborators cc
          where cc.celebration_id = c.id
            and cc.user_id = (select auth.uid())
            and cc.revoked_at is null
            and cc.accepted_at is not null
            and cc.role in ('owner', 'cohost')
        )
      )
  );
$$;

create or replace function public.move_celebration_to_trash(
  p_celebration_id uuid
)
returns table (
  celebration_id uuid,
  trashed_at timestamptz,
  delete_after timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_celebration(p_celebration_id) then
    raise exception 'not allowed to trash celebration' using errcode = '42501';
  end if;

  return query
  update public.celebrations c
     set deleted_at = now(),
         delete_after = now() + interval '7 days',
         updated_at = now()
   where c.id = p_celebration_id
     and c.deleted_at is null
   returning c.id, c.deleted_at, c.delete_after;
end;
$$;

create or replace function public.restore_celebration_from_trash(
  p_celebration_id uuid
)
returns table (
  celebration_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_celebration_including_trashed(p_celebration_id) then
    raise exception 'not allowed to restore celebration' using errcode = '42501';
  end if;

  return query
  update public.celebrations c
     set deleted_at = null,
         delete_after = null,
         updated_at = now()
   where c.id = p_celebration_id
     and c.deleted_at is not null
   returning c.id;
end;
$$;

create or replace function public.permanently_delete_celebration(
  p_celebration_id uuid
)
returns table (
  celebration_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_celebration_including_trashed(p_celebration_id) then
    raise exception 'not allowed to permanently delete celebration' using errcode = '42501';
  end if;

  return query
  delete from public.celebrations c
   where c.id = p_celebration_id
     and c.deleted_at is not null
   returning c.id;
end;
$$;

create or replace function public.list_trashed_celebrations()
returns table (
  id uuid,
  title text,
  status public.celebration_status,
  cover_storage_path text,
  public_slug text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  default_theme_id uuid,
  deleted_at timestamptz,
  delete_after timestamptz,
  primary_session jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.title,
    c.status,
    c.cover_storage_path,
    c.public_slug,
    c.starts_at,
    c.ends_at,
    c.timezone,
    c.default_theme_id,
    c.deleted_at,
    c.delete_after,
    (
      select jsonb_build_object(
        'id', es.id,
        'name', es.name,
        'status', es.status,
        'ends_at', es.ends_at,
        'reveal_at', es.reveal_at,
        'reveal_mode', es.reveal_mode,
        'shot_limit_per_guest', es.shot_limit_per_guest
      )
      from public.event_sessions es
      where es.celebration_id = c.id
        and es.deleted_at is null
      order by es.sequence_number asc
      limit 1
    ) as primary_session
  from public.celebrations c
  where c.deleted_at is not null
    and private.can_manage_celebration_including_trashed(c.id)
  order by c.deleted_at desc;
$$;

create or replace function private.purge_expired_trashed_celebrations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.celebrations c
   where c.deleted_at is not null
     and c.delete_after <= now();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.move_celebration_to_trash(uuid) to authenticated;
grant execute on function public.restore_celebration_from_trash(uuid) to authenticated;
grant execute on function public.permanently_delete_celebration(uuid) to authenticated;
grant execute on function public.list_trashed_celebrations() to authenticated;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;

  if exists (
    select 1
    from pg_catalog.pg_namespace
    where nspname = 'cron'
  ) then
    if exists (
      select 1
      from cron.job
      where jobname = 'purge-expired-trashed-celebrations'
    ) then
      perform cron.unschedule('purge-expired-trashed-celebrations');
    end if;

    perform cron.schedule(
      'purge-expired-trashed-celebrations',
      '* * * * *',
      $cron$select private.purge_expired_trashed_celebrations();$cron$
    );
  end if;
exception
  when undefined_function or invalid_schema_name then
    null;
end $$;
