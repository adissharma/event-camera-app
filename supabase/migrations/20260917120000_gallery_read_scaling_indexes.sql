-- Gallery reads are filtered by session/status and always present pinned
-- items first, then newest captures. The older `(event_session_id, status)`
-- index finds the rows but leaves PostgreSQL to sort every ready item on each
-- event entry. Keep that path bounded as real events move into the hundreds
-- and thousands of contributions.
--
-- This covers both the host table query and the guest security-definer RPC.
-- It is deliberately partial so failed/deleted/in-flight uploads do not add
-- index size or write overhead.
create index if not exists media_items_ready_gallery_order_idx
  on public.media_items (
    event_session_id,
    is_pinned desc,
    pinned_at desc nulls last,
    captured_at desc
  )
  where status = 'ready' and deleted_at is null;
