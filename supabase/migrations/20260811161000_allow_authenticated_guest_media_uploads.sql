-- A signed-in host can still join an event through its guest link. In that
-- case Supabase Storage evaluates policies as `authenticated`, even though
-- the upload was authorised by a guest upload intent. Mirror the existing
-- anon policy without granting standing access to any other object path.

drop policy if exists "event media: authenticated guest write via live upload intent"
  on storage.objects;

create policy "event media: authenticated guest write via live upload intent"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-media'
    and private.has_live_upload_intent(bucket_id, name)
  );

notify pgrst, 'reload schema';
