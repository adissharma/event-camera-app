-- A newly created social account gets a suggested first name, but onboarding
-- remains incomplete until the user explicitly saves it in the app.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_display_name text;
begin
  v_display_name := nullif(split_part(trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), ' ', 1), '');

  insert into public.profiles (id, display_name, onboarding_completed_at)
  values (new.id, v_display_name, null)
  on conflict (id) do nothing;

  insert into public.workspaces (name, kind, created_by)
  values ('Personal', 'personal', new.id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;
