-- Guests can open the host's floor plan alongside their seat.
--
-- `event_seating.floorplan_path` has existed since the seating table was
-- added; nothing wrote it. The host now uploads a plan image (a PDF is
-- rasterised on the host's device first), stored in `celebration-covers`
-- beside the cover so it inherits the same posture: readable by anyone once
-- the event is published, written only by its managers, and removed with the
-- account.
--
-- Both guest searches return the path. `has_plan` keeps meaning "there are
-- names to search", which is what the join screen keys its search sheet on.

create or replace function public.search_guest_seating(
  p_event_code text,
  p_guest_token text,
  p_query text
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_celebration public.celebrations%rowtype;
  v_session public.event_sessions%rowtype;
  v_guests jsonb;
  v_floorplan_path text;
  v_query text := lower(trim(coalesce(p_query, '')));
  v_matches jsonb;
begin
  select * into v_celebration from public.celebrations
  where lower(event_code) = lower(trim(p_event_code))
    and deleted_at is null and status <> 'draft';
  if not found then raise exception 'event not found or unavailable' using errcode = '42501'; end if;

  select * into v_session from public.event_sessions
  where celebration_id = v_celebration.id and deleted_at is null
  order by sequence_number asc limit 1;
  if not found then raise exception 'event session not found' using errcode = '42501'; end if;

  perform 1 from public.guest_sessions gs
  where gs.event_session_id = v_session.id
    and gs.anonymous_token_hash = private.digest_token(p_guest_token);
  if not found then raise exception 'invalid guest session' using errcode = '42501'; end if;

  select coalesce(s.guests, '[]'::jsonb), s.floorplan_path into v_guests, v_floorplan_path
  from public.event_seating s where s.celebration_id = v_celebration.id;
  v_guests := coalesce(v_guests, '[]'::jsonb);

  if length(v_query) < 2 then
    v_matches := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'seat', m.seat) order by m.rank, m.name), '[]'::jsonb)
      into v_matches
    from (
      select
        trim(g ->> 'name') as name,
        trim(both ', ' from concat_ws(', ', nullif(trim(g ->> 'table'), ''), nullif(trim(g ->> 'seat'), ''))) as seat,
        case
          when lower(trim(g ->> 'name')) = v_query then 0
          when lower(trim(g ->> 'name')) like v_query || '%' then 1
          else 2
        end as rank
      from jsonb_array_elements(v_guests) g
      where coalesce(trim(g ->> 'name'), '') <> ''
        and position(v_query in lower(g ->> 'name')) > 0
      order by 3, 1
      limit 8
    ) m;
  end if;

  return jsonb_build_object(
    'has_plan', jsonb_array_length(v_guests) > 0,
    'floorplan_path', v_floorplan_path,
    'matches', v_matches
  );
end; $$;

revoke all on function public.search_guest_seating(text, text, text) from public;
grant execute on function public.search_guest_seating(text, text, text) to anon, authenticated;

create or replace function public.search_event_seating_by_code(
  p_event_code text,
  p_query text
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_celebration public.celebrations%rowtype;
  v_guests jsonb;
  v_floorplan_path text;
  v_query text := lower(trim(coalesce(p_query, '')));
  v_matches jsonb;
begin
  select * into v_celebration from public.celebrations
  where lower(event_code) = lower(trim(p_event_code))
    and deleted_at is null and status <> 'draft';
  if not found then raise exception 'event not found or unavailable' using errcode = '42501'; end if;

  select coalesce(s.guests, '[]'::jsonb), s.floorplan_path into v_guests, v_floorplan_path
  from public.event_seating s where s.celebration_id = v_celebration.id;
  v_guests := coalesce(v_guests, '[]'::jsonb);

  if length(v_query) < 2 then
    v_matches := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'seat', m.seat) order by m.rank, m.name), '[]'::jsonb)
      into v_matches
    from (
      select
        trim(g ->> 'name') as name,
        trim(both ', ' from concat_ws(', ', nullif(trim(g ->> 'table'), ''), nullif(trim(g ->> 'seat'), ''))) as seat,
        case
          when lower(trim(g ->> 'name')) = v_query then 0
          when lower(trim(g ->> 'name')) like v_query || '%' then 1
          else 2
        end as rank
      from jsonb_array_elements(v_guests) g
      where coalesce(trim(g ->> 'name'), '') <> ''
        and position(v_query in lower(g ->> 'name')) > 0
      order by 3, 1
      limit 8
    ) m;
  end if;

  return jsonb_build_object(
    'has_plan', jsonb_array_length(v_guests) > 0,
    'floorplan_path', v_floorplan_path,
    'matches', v_matches
  );
end; $$;

revoke all on function public.search_event_seating_by_code(text, text) from public;
grant execute on function public.search_event_seating_by_code(text, text) to anon, authenticated;
