-- Fixes two bugs in the same function, both raising
-- "new row for relation \"celebrations\" violates check constraint
-- \"celebrations_event_code_format\"" (the column requires '^[A-Z0-9]{6}$')
-- from inside publish_celebration:
--
-- 1. Length. The `chars` subquery is a `union all` of exactly two single-row
--    selects — one A-Z pick, one 0-9 pick — so it only ever has 2 rows to
--    give out. `order by random() limit 6` on a 2-row set still returns just
--    those 2 rows; the code this produced was always 2 characters, not 6, so
--    it failed the format check on essentially every call. This was invisible
--    in prior testing because the one event ever verified against this
--    constraint (the seeded demo event) has its event_code set directly in
--    seed.sql, never generated through this function.
-- 2. Rounding. `::int` on a float ROUNDS in Postgres, it does not truncate.
--    `(random() * 26)::int` ranges over [0, 26), but a value landing in
--    [25.5, 26) rounds up to 26, giving 65 + 26 = 91 ('['), and
--    `(random() * 10)::int` can likewise round to 10, giving 48 + 10 = 58
--    (':') — both outside the intended character set. `floor()` clamps the
--    range to exactly [0, 25] / [0, 9] before the cast.
--
-- Rewritten to draw 6 independent characters from one 36-character alphabet,
-- rather than trying to interleave two differently-sized ranges.

create or replace function private.generate_event_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_attempts int := 0;
  v_alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
begin
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'Failed to generate unique event code after 10 attempts';
    end if;

    -- Generate random 6-char code: A-Z, 0-9
    select string_agg(
      substr(v_alphabet, floor(random() * length(v_alphabet))::int + 1, 1),
      ''
    )
    into v_code
    from generate_series(1, 6);

    -- Check uniqueness
    if not exists(select 1 from public.celebrations where event_code = v_code) then
      return v_code;
    end if;
  end loop;
end;
$$;
