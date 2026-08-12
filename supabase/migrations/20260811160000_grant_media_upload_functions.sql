-- The video-aware upload functions replaced older signatures. Re-apply the
-- same client-facing execute grants to the new overloads.

revoke all on function public.create_guest_media_upload_intent(
  text,
  text,
  uuid,
  public.media_type,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) from public, anon;
grant execute on function public.create_guest_media_upload_intent(
  text,
  text,
  uuid,
  public.media_type,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) to anon, authenticated;

revoke all on function public.create_host_media_upload_intent(
  uuid,
  uuid,
  public.media_type,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) from public, authenticated;
grant execute on function public.create_host_media_upload_intent(
  uuid,
  uuid,
  public.media_type,
  public.media_source,
  text,
  bigint,
  timestamptz,
  jsonb
) to authenticated;

revoke all on function public.finalize_guest_media_upload(
  uuid,
  text,
  bigint,
  text,
  integer,
  integer,
  integer,
  text,
  text
) from public, anon;
grant execute on function public.finalize_guest_media_upload(
  uuid,
  text,
  bigint,
  text,
  integer,
  integer,
  integer,
  text,
  text
) to anon, authenticated;

revoke all on function public.finalize_host_media_upload(
  uuid,
  bigint,
  text,
  integer,
  integer,
  integer,
  text,
  text
) from public, authenticated;
grant execute on function public.finalize_host_media_upload(
  uuid,
  bigint,
  text,
  integer,
  integer,
  integer,
  text,
  text
) to authenticated;
