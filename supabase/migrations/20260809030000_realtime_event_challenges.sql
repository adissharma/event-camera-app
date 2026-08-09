-- Broadcast challenge edits, so a host editing on one device sees the change
-- on another without reaching for refresh.
--
-- Note this reaches authenticated viewers only. `postgres_changes` applies the
-- subscriber's own RLS, and `event_challenges` deliberately has no policy for
-- `anon` — a guest reads through `get_guest_challenges`, which validates a
-- guest token. Guests therefore pick changes up on their next fetch rather
-- than live, which is the correct trade: the alternative is exposing the table
-- to every anonymous client to save them a reload.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_challenges'
  ) then
    alter publication supabase_realtime add table public.event_challenges;
  end if;
end;
$$;

-- Realtime sends the old row on UPDATE/DELETE only when the table has a
-- replica identity that includes it. Soft deletes arrive as UPDATEs setting
-- `deleted_at`, and a subscriber needs to see which row changed to react.
alter table public.event_challenges replica identity full;
