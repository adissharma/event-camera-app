-- Guests find their table on the join screen, before they have a guest
-- token. Joining needs nothing beyond the event code, so gating this search
-- on a token would protect nothing the code does not already open; it keeps
-- the same shape as `search_guest_seating` instead — matching names only,
-- two characters before anything comes back, and a short list after.
create or replace function public.search_event_seating_by_code(
  p_event_code text,
  p_query text
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_celebration public.celebrations%rowtype;
  v_guests jsonb;
  v_query text := lower(trim(coalesce(p_query, '')));
  v_matches jsonb;
begin
  select * into v_celebration from public.celebrations
  where lower(event_code) = lower(trim(p_event_code))
    and deleted_at is null and status <> 'draft';
  if not found then raise exception 'event not found or unavailable' using errcode = '42501'; end if;

  select coalesce(s.guests, '[]'::jsonb) into v_guests
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
    'matches', v_matches
  );
end; $$;

revoke all on function public.search_event_seating_by_code(text, text) from public;
grant execute on function public.search_event_seating_by_code(text, text) to anon, authenticated;
