-- Guests find their seat by searching for a name rather than receiving the
-- whole plan. `get_guest_seating` returned every guest and seat to anyone
-- holding a guest token; nothing in the app ever called it, so it goes.
drop function if exists public.get_guest_seating(text, text);

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
  v_query text := lower(trim(coalesce(p_query, '')));
  v_matches jsonb;
begin
  -- Same gate as the other guest RPCs: a live, published event and a guest
  -- token issued for its first session.
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

  select coalesce(s.guests, '[]'::jsonb) into v_guests
  from public.event_seating s where s.celebration_id = v_celebration.id;
  v_guests := coalesce(v_guests, '[]'::jsonb);

  -- Two characters before anything comes back, and a short list after, so
  -- the screen answers "where am I sitting" without paging through everyone.
  if length(v_query) < 2 then
    v_matches := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'seat', m.seat) order by m.rank, m.name), '[]'::jsonb)
      into v_matches
    from (
      select
        trim(g ->> 'name') as name,
        -- Legacy rows kept the table separately; fold it in as the app does.
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
    'matches', v_matches
  );
end; $$;

revoke all on function public.search_guest_seating(text, text, text) from public;
grant execute on function public.search_guest_seating(text, text, text) to anon, authenticated;
