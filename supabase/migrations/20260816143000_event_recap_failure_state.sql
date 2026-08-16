-- On-demand recaps should not sit in queued forever when the client cannot
-- start the worker, or when the worker fails once. The host can re-select media
-- and request a new render from the gallery.

create or replace function public.mark_event_recap_start_failed(
  p_event_session_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_event_session(p_event_session_id) then
    raise exception 'not allowed to update this recap' using errcode = '42501';
  end if;

  update public.event_recaps
  set status = 'failed',
      available_at = null,
      locked_by = null,
      lease_expires_at = null,
      failed_at = now(),
      last_error_code = 'worker_start_failed',
      last_error_message = left(coalesce(p_error_message, 'Could not start recap generation.'), 1000)
  where event_session_id = p_event_session_id
    and status = 'queued'
    and attempt_count = 0;

  return found;
end;
$$;

revoke all on function public.mark_event_recap_start_failed(uuid, text) from public;
grant execute on function public.mark_event_recap_start_failed(uuid, text) to authenticated;

create or replace function public.fail_event_recap_job(
  p_recap_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_recaps
  set status = 'failed',
      available_at = null,
      locked_by = null,
      lease_expires_at = null,
      failed_at = now(),
      last_error_code = left(p_error_code, 120),
      last_error_message = left(p_error_message, 1000)
  where id = p_recap_id and status = 'processing' and locked_by = p_worker_id;
  return found;
end;
$$;

revoke all on function public.fail_event_recap_job(uuid, text, text, text) from public;
grant execute on function public.fail_event_recap_job(uuid, text, text, text) to service_role;
