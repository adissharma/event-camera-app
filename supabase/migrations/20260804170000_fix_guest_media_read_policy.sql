-- Fixes: a guest could never see their own photo in the gallery while the
-- event was locked, even though get_guest_gallery's own row selection has
-- always allowed it ("Guests can always see their own photos (even if
-- locked)" — see 20260801120000_guest_gallery_rpc.sql). The storage read
-- policy from 20260804160000_guest_media_upload_pipeline.sql re-derived the
-- same visibility rule at the object level, but a plain storage.objects
-- policy has no way to know whose gallery is being fetched — every guest
-- shares the same anon API key — so it could only enforce a strictly WEAKER
-- rule: unlocked and all_guests, with no "except my own" carve-out.
--
-- That re-derivation was also unnecessary. get_guest_gallery is the only
-- place a guest ever learns a storage_path in the first place, and it
-- already applies the real rule server-side, correctly, with the guest's
-- actual identity available (`mi.guest_session_id = v_guest.id OR (not
-- locked and gallery_visibility = 'all_guests')`). A guest's client never
-- receives the path to another guest's still-locked photo — there is
-- nothing to guess or enumerate it from — so the storage policy's job is
-- just to confirm "is this genuinely a ready, undeleted item", not to
-- re-referee visibility a second time with less information than the RPC had.

drop policy "event media: guest read unlocked all-guests galleries" on storage.objects;
drop function private.is_readable_unlocked_guest_media(text);

create or replace function private.is_ready_guest_media(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_items mi
    where mi.original_storage_path = p_path
      and mi.status = 'ready'
      and mi.deleted_at is null
  );
$$;

create policy "event media: guest read ready items"
  on storage.objects for select to anon
  using (
    bucket_id = 'event-media'
    and private.is_ready_guest_media(name)
  );
