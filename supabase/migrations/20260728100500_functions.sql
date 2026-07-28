-- Security helpers, identity bootstrap and the atomic creation operation.
--
-- Every SECURITY DEFINER function sets an explicit empty search_path. Without
-- it, a caller can prepend a schema they control and hijack an unqualified name
-- inside a function running with the owner's privileges.

-- ---------------------------------------------------------------------------
-- Token and slug helpers
-- ---------------------------------------------------------------------------

create or replace function private.digest_token(p_token text)
returns bytea
language sql
immutable
security invoker
set search_path = ''
as $$
  select extensions.digest(p_token, 'sha256');
$$;

comment on function private.digest_token is
  'SHA-256 of an access token or PIN. Plaintext secrets are never stored.';

create or replace function private.generate_public_slug()
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  -- 16 random bytes as hex: 32 characters, 128 bits of entropy. Non-sequential
  -- and not practically enumerable, which matters because this appears in every
  -- guest link.
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;

create or replace function private.generate_access_token()
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Authorisation helpers
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER on purpose. A policy on workspaces that queries
-- workspace_members, whose own policy queries workspaces, recurses forever.
-- These read beneath RLS to break that cycle. They are in `private`, which
-- PostgREST does not expose, so no client can call them directly.

create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_workspace_role(
  p_workspace_id uuid,
  p_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (p_roles)
  );
$$;

create or replace function private.can_view_celebration(p_celebration_id uuid)
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
      and c.deleted_at is null
      and (
        private.is_workspace_member(c.workspace_id)
        or exists (
          select 1
          from public.celebration_collaborators cc
          where cc.celebration_id = c.id
            and cc.user_id = (select auth.uid())
            and cc.revoked_at is null
            and cc.accepted_at is not null
        )
      )
  );
$$;

create or replace function private.can_manage_celebration(p_celebration_id uuid)
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
      and c.deleted_at is null
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

create or replace function private.can_view_event_session(p_event_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_sessions es
    where es.id = p_event_session_id
      and es.deleted_at is null
      and private.can_view_celebration(es.celebration_id)
  );
$$;

create or replace function private.can_manage_event_session(p_event_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_sessions es
    where es.id = p_event_session_id
      and es.deleted_at is null
      and private.can_manage_celebration(es.celebration_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Identity bootstrap
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;

  -- Every user gets a personal workspace. Created here rather than in the app
  -- so it cannot be skipped by a client that crashes mid-onboarding, and so a
  -- user can never end up able to sign in but unable to create an event.
  insert into public.workspaces (name, kind, created_by)
  values ('Personal', 'personal', new.id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Idempotent repair path, for users created before this trigger existed or
-- whose bootstrap failed. Safe to call on every app launch.
create or replace function public.ensure_personal_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select w.id into v_workspace_id
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = v_user_id
    and w.kind = 'personal'
    and w.deleted_at is null
  order by w.created_at
  limit 1;

  if v_workspace_id is not null then
    return v_workspace_id;
  end if;

  insert into public.profiles (id) values (v_user_id) on conflict (id) do nothing;

  insert into public.workspaces (name, kind, created_by)
  values ('Personal', 'personal', v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner')
  on conflict do nothing;

  return v_workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic creation
-- ---------------------------------------------------------------------------

create type public.created_celebration as (
  celebration_id uuid,
  event_session_id uuid,
  access_link_id uuid,
  public_slug text,
  guest_access_token text
);

create or replace function public.create_celebration_with_default_session(
  p_title text,
  p_session_name text default 'Main event',
  p_celebration_type public.celebration_type default 'wedding',
  p_inspiration_pack public.inspiration_pack default 'universal',
  p_timezone text default 'Europe/London',
  p_ends_at timestamptz default null,
  p_starts_at timestamptz default null,
  p_theme_id uuid default null,
  p_workspace_id uuid default null,
  p_capture_mode public.capture_mode default 'camera_and_library',
  p_shot_limit_per_guest integer default 20,
  p_camera_roll_upload_limit integer default 5,
  p_reveal_mode public.reveal_mode default 'scheduled',
  p_reveal_at timestamptz default null,
  p_gallery_visibility public.gallery_visibility default 'all_guests',
  p_photo_treatment public.photo_treatment default 'original'
)
returns public.created_celebration
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_id uuid := p_workspace_id;
  v_celebration_id uuid;
  v_event_session_id uuid;
  v_access_link_id uuid;
  v_slug text;
  v_token text;
  v_result public.created_celebration;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;

  -- Resolve the workspace, defaulting to the caller's personal one.
  if v_workspace_id is null then
    v_workspace_id := public.ensure_personal_workspace();
  elsif not private.has_workspace_role(
    v_workspace_id, array['owner', 'admin']::public.workspace_role[]
  ) then
    raise exception 'not permitted to create in this workspace'
      using errcode = '42501';
  end if;

  -- A scheduled reveal must carry a time; default to 12 hours after close
  -- rather than failing the whole operation on a caller omission.
  if p_reveal_mode = 'scheduled' and p_reveal_at is null and p_ends_at is not null then
    p_reveal_at := p_ends_at + interval '12 hours';
  end if;

  v_slug := private.generate_public_slug();

  insert into public.celebrations (
    workspace_id, created_by, title, celebration_type, inspiration_pack,
    status, starts_at, ends_at, timezone, default_theme_id, public_slug
  )
  values (
    v_workspace_id, v_user_id, trim(p_title), p_celebration_type, p_inspiration_pack,
    'draft', p_starts_at, p_ends_at, p_timezone, p_theme_id, v_slug
  )
  returning id into v_celebration_id;

  insert into public.event_sessions (
    celebration_id, name, sequence_number, status,
    starts_at, ends_at, timezone, theme_id,
    capture_mode, shot_limit_per_guest, camera_roll_upload_limit,
    reveal_mode, reveal_at, gallery_visibility, photo_treatment
  )
  values (
    v_celebration_id, coalesce(nullif(trim(p_session_name), ''), 'Main event'),
    1, 'draft',
    p_starts_at, p_ends_at, p_timezone, p_theme_id,
    p_capture_mode, p_shot_limit_per_guest, p_camera_roll_upload_limit,
    p_reveal_mode,
    case when p_reveal_mode = 'scheduled' then p_reveal_at else null end,
    p_gallery_visibility, p_photo_treatment
  )
  returning id into v_event_session_id;

  -- The guest token is returned to the caller exactly once, here. Only its
  -- digest is stored, so it cannot be recovered later — regenerating the link
  -- is the recovery path.
  v_token := private.generate_access_token();

  insert into public.access_links (event_session_id, kind, token_hash, is_active)
  values (v_event_session_id, 'guest', private.digest_token(v_token), true)
  returning id into v_access_link_id;

  insert into public.celebration_collaborators (
    celebration_id, user_id, role, invited_at, accepted_at
  )
  values (v_celebration_id, v_user_id, 'owner', now(), now());

  v_result := (
    v_celebration_id, v_event_session_id, v_access_link_id, v_slug, v_token
  )::public.created_celebration;

  return v_result;
end;
$$;

comment on function public.create_celebration_with_default_session is
  'Creates a celebration, its default event session, the guest access link and '
  'the owner collaborator row as one unit. A function body is a single '
  'transaction, so this either fully succeeds or fully fails — there is no '
  'state where a celebration exists without a way for guests to join it.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_celebration_with_default_session from public, anon;
grant execute on function public.create_celebration_with_default_session to authenticated;

revoke all on function public.ensure_personal_workspace from public, anon;
grant execute on function public.ensure_personal_workspace to authenticated;
