-- Guest join by code RPC: Allows guests to register or resume their session using
-- the public event code (public slug) directly. The database resolves the active
-- guest link internally, making token fragments in URLs optional.

create or replace function public.join_event_by_code(
  p_event_code text,
  p_display_name text,
  p_device_fingerprint text default null
)
returns public.joined_guest_session
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_link public.access_links%rowtype;
  v_token text;
  v_guest public.guest_sessions%rowtype;
  v_shots integer;
begin
  -- 1. Resolve celebration and verify availability
  select * into v_celebration
  from public.celebrations
  where public_slug = trim(lower(p_event_code))
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'event not found or unavailable' using errcode = '42501';
  end if;

  -- 2. Resolve event session
  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  if not found then
    raise exception 'event session not found' using errcode = '42501';
  end if;

  -- 3. Resolve the active guest access link for this session
  select * into v_link
  from public.access_links
  where event_session_id = v_session.id
    and kind = 'guest'
    and is_active = true
  limit 1;

  if not found then
    raise exception 'no active guest access link' using errcode = '42501';
  end if;

  -- 4. Re-use or create guest session idempotently
  if p_device_fingerprint is not null then
    select * into v_guest
    from public.guest_sessions
    where event_session_id = v_session.id
      and device_identifier_hash = private.digest_token(p_device_fingerprint)
    limit 1;
  end if;

  if found and v_guest.id is not null then
    v_token := private.generate_access_token();
    update public.guest_sessions
      set last_seen_at = now(),
          anonymous_token_hash = private.digest_token(v_token),
          display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
      where id = v_guest.id
      returning * into v_guest;
  else
    v_token := private.generate_access_token();
    insert into public.guest_sessions (
      event_session_id, display_name, anonymous_token_hash,
      device_identifier_hash, consent_at
    )
    values (
      v_session.id,
      nullif(trim(p_display_name), ''),
      private.digest_token(v_token),
      case when p_device_fingerprint is null then null
           else private.digest_token(p_device_fingerprint) end,
      now()
    )
    returning * into v_guest;
  end if;

  select count(*)::integer into v_shots
  from public.media_items
  where guest_session_id = v_guest.id
    and deleted_at is null
    and status <> 'permanent_failed';

  return (
    v_guest.id, v_session.id, v_session.celebration_id, v_token,
    v_guest.display_name, v_session.shot_limit_per_guest, v_shots
  )::public.joined_guest_session;
end;
$$;

comment on function public.join_event_by_code is
  'Registers or resumes a guest session using the event code (public slug) directly, resolving the default access link server-side.';

revoke all on function public.join_event_by_code from public;
grant execute on function public.join_event_by_code to anon, authenticated;
