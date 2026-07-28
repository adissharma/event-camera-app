-- Fix: creating a celebration without a closing time raised a constraint error.
--
-- `create_celebration_with_default_session` defaults `p_reveal_mode` to
-- 'scheduled', and only derived a reveal time when `p_ends_at` was supplied.
-- With no closing time the insert therefore violated
-- `event_sessions_reveal_at_matches_mode`, which requires a scheduled reveal to
-- carry a timestamp.
--
-- A draft with no closing time is a perfectly ordinary state — the host has not
-- reached step 2 yet — so the function must handle it rather than fail.
--
-- The fallback is 'manual', matching `resolveReveal` on the client: a wrong
-- reveal time is worse than asking the host to press a button. Guessing a
-- timestamp here would silently reveal a gallery at a moment nobody chose.
--
-- Found by the publication test suite, which created exactly this fixture.

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
  v_reveal_mode public.reveal_mode := p_reveal_mode;
  v_reveal_at timestamptz := p_reveal_at;
  v_result public.created_celebration;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;

  if v_workspace_id is null then
    v_workspace_id := public.ensure_personal_workspace();
  elsif not private.has_workspace_role(
    v_workspace_id, array['owner', 'admin']::public.workspace_role[]
  ) then
    raise exception 'not permitted to create in this workspace'
      using errcode = '42501';
  end if;

  -- Resolve the reveal so it always satisfies the check constraint.
  if v_reveal_mode = 'scheduled' then
    if v_reveal_at is null and p_ends_at is not null then
      v_reveal_at := p_ends_at + interval '12 hours';
    end if;

    -- Still nothing to schedule against: fall back rather than invent a time.
    if v_reveal_at is null then
      v_reveal_mode := 'manual';
    end if;
  else
    -- A non-scheduled mode must not carry a timestamp.
    v_reveal_at := null;
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
    v_reveal_mode, v_reveal_at,
    p_gallery_visibility, p_photo_treatment
  )
  returning id into v_event_session_id;

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

revoke all on function public.create_celebration_with_default_session from public, anon;
grant execute on function public.create_celebration_with_default_session to authenticated;
