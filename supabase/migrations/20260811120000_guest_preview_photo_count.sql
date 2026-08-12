-- Surface the real event-wide photo total on the guest cover preview so an
-- ended event can say how many moments were captured, not how many shots this
-- device has used. Challenge submissions count too because they are stored as
-- normal ready media_items on the session.

do $$
begin
  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.guest_event_preview'::regtype
      and attname = 'photo_count'
      and not attisdropped
  ) then
    alter type public.guest_event_preview
      add attribute photo_count integer;
  end if;
end
$$;

create or replace function public.get_event_preview_by_code(
  p_event_code text
)
returns public.guest_event_preview
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_theme public.themes%rowtype;
  v_preview public.guest_event_preview;
  v_clean_code text;
begin
  v_clean_code := trim(lower(p_event_code));

  if v_clean_code is null or v_clean_code = '' then
    raise exception 'invalid event code' using errcode = '42501';
  end if;

  select * into v_celebration
  from public.celebrations
  where lower(event_code) = v_clean_code
    and deleted_at is null
    and status <> 'draft';

  if not found then
    raise exception 'invalid event code' using errcode = '42501';
  end if;

  select * into v_session
  from public.event_sessions
  where celebration_id = v_celebration.id
    and deleted_at is null
  order by sequence_number asc
  limit 1;

  select * into v_theme
  from public.themes
  where id = v_celebration.default_theme_id
  limit 1;

  v_preview.celebration_id := v_celebration.id;
  v_preview.title := v_celebration.title;
  v_preview.ends_at := coalesce(v_session.ends_at, v_celebration.ends_at);
  v_preview.shot_limit_per_guest := v_session.shot_limit_per_guest;
  v_preview.cover_storage_path := v_celebration.cover_storage_path;
  v_preview.theme_accent := coalesce((v_theme.design_tokens ->> 'accent'), '#EFE9E0');
  v_preview.photo_count := coalesce((
    select count(*)::integer
    from public.media_items
    where event_session_id = v_session.id
      and deleted_at is null
      and status = 'ready'
  ), 0);

  return v_preview;
end;
$$;

comment on function public.get_event_preview_by_code is
  'Fetches preview details for an event cover screen using its guest-facing event_code, including the selected theme accent and the event-wide ready photo count.';
