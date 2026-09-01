-- A client-side UPDATE reports success even when a profile bootstrap failed
-- and matched zero rows. Completing onboarding must instead be an upsert so a
-- user cannot be sent to Home without a durable completed profile.

create or replace function public.complete_my_profile(
  p_display_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_display_name text;
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_display_name := nullif(split_part(trim(coalesce(p_display_name, '')), ' ', 1), '');
  if v_display_name is null then
    raise exception 'a first name is required' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, onboarding_completed_at)
  values (v_user_id, v_display_name, now())
  on conflict (id) do update
    set display_name = excluded.display_name,
        onboarding_completed_at = excluded.onboarding_completed_at
  returning * into v_profile;

  return v_profile;
end;
$$;

comment on function public.complete_my_profile(text) is
  'Atomically saves the authenticated user first name and marks onboarding complete, creating a missing profile if necessary.';

revoke all on function public.complete_my_profile(text) from public, anon;
grant execute on function public.complete_my_profile(text) to authenticated;
