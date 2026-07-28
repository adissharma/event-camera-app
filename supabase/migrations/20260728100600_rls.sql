-- Row Level Security.
--
-- Principles applied throughout:
--
-- 1. RLS is enabled on EVERY table in `public`. A table with RLS enabled and no
--    matching policy denies by default, which is the behaviour we want for
--    internal pipeline tables.
-- 2. No `using (true)` on anything private.
-- 3. `anon` cannot read any user or guest data directly. Guest participation is
--    mediated by restricted server-side operations that validate a token; the
--    anonymous role never gets a blanket read.
-- 4. Every policy names its role explicitly with `to authenticated` / `to anon`.
--    A policy without a role list also applies to unauthenticated requests.
-- 5. Membership questions go through the SECURITY DEFINER helpers in `private`
--    to avoid infinite policy recursion.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles                  enable row level security;
alter table public.workspaces                enable row level security;
alter table public.workspace_members         enable row level security;
alter table public.themes                    enable row level security;
alter table public.celebrations              enable row level security;
alter table public.celebration_collaborators enable row level security;
alter table public.event_sessions            enable row level security;
alter table public.access_links              enable row level security;
alter table public.guest_sessions            enable row level security;
alter table public.qr_assets                 enable row level security;
alter table public.media_items               enable row level security;
alter table public.upload_intents            enable row level security;
alter table public.upload_attempts           enable row level security;
alter table public.media_variants            enable row level security;
alter table public.processing_jobs           enable row level security;
alter table public.storage_deletion_jobs     enable row level security;
alter table public.plans                     enable row level security;
alter table public.add_ons                   enable row level security;
alter table public.entitlement_definitions   enable row level security;
alter table public.plan_entitlements         enable row level security;
alter table public.add_on_entitlements       enable row level security;
alter table public.purchases                 enable row level security;
alter table public.celebration_entitlements  enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------

create policy "workspaces: read own memberships"
  on public.workspaces for select to authenticated
  using (deleted_at is null and private.is_workspace_member(id));

create policy "workspaces: create own"
  on public.workspaces for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "workspaces: owners and admins update"
  on public.workspaces for update to authenticated
  using (private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
  with check (private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]));

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------

create policy "workspace_members: read within own workspaces"
  on public.workspace_members for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "workspace_members: owners and admins manage"
  on public.workspace_members for all to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- ---------------------------------------------------------------------------
-- themes — public, non-sensitive catalogue
-- ---------------------------------------------------------------------------
--
-- Readable by anonymous requests because the guest web experience renders a
-- theme before any guest identity exists. Contains no user data.

create policy "themes: read active"
  on public.themes for select to anon, authenticated
  using (is_active);

-- ---------------------------------------------------------------------------
-- celebrations
-- ---------------------------------------------------------------------------

create policy "celebrations: read accessible"
  on public.celebrations for select to authenticated
  using (deleted_at is null and private.can_view_celebration(id));

create policy "celebrations: create in own workspace"
  on public.celebrations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_workspace_role(
      workspace_id, array['owner', 'admin']::public.workspace_role[]
    )
  );

create policy "celebrations: managers update"
  on public.celebrations for update to authenticated
  using (private.can_manage_celebration(id))
  with check (private.can_manage_celebration(id));

-- No delete policy. Important user content is soft-deleted by setting
-- deleted_at, so a mistaken tap is recoverable and media cleanup can be queued.

-- ---------------------------------------------------------------------------
-- celebration_collaborators
-- ---------------------------------------------------------------------------

create policy "collaborators: read own row or on viewable celebration"
  on public.celebration_collaborators for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_view_celebration(celebration_id)
  );

create policy "collaborators: managers manage"
  on public.celebration_collaborators for all to authenticated
  using (private.can_manage_celebration(celebration_id))
  with check (private.can_manage_celebration(celebration_id));

-- ---------------------------------------------------------------------------
-- event_sessions
-- ---------------------------------------------------------------------------

create policy "event_sessions: read on viewable celebration"
  on public.event_sessions for select to authenticated
  using (deleted_at is null and private.can_view_celebration(celebration_id));

create policy "event_sessions: managers insert"
  on public.event_sessions for insert to authenticated
  with check (private.can_manage_celebration(celebration_id));

create policy "event_sessions: managers update"
  on public.event_sessions for update to authenticated
  using (private.can_manage_celebration(celebration_id))
  with check (private.can_manage_celebration(celebration_id));

-- ---------------------------------------------------------------------------
-- access_links — hosts only
-- ---------------------------------------------------------------------------
--
-- Deliberately NOT readable by viewers or collaborators below cohost. A row
-- here is the key to an event; the digest is useless on its own, but the
-- existence, expiry and activity of a link is still host information.

create policy "access_links: managers read"
  on public.access_links for select to authenticated
  using (private.can_manage_event_session(event_session_id));

create policy "access_links: managers manage"
  on public.access_links for all to authenticated
  using (private.can_manage_event_session(event_session_id))
  with check (private.can_manage_event_session(event_session_id));

-- ---------------------------------------------------------------------------
-- guest_sessions — hosts only, never anonymous
-- ---------------------------------------------------------------------------

create policy "guest_sessions: managers read"
  on public.guest_sessions for select to authenticated
  using (private.can_manage_event_session(event_session_id));

-- No insert policy for any client role. A guest session is created only by the
-- server-side join operation, after it has validated the access token. If
-- clients could insert here, anyone could manufacture a guest session for any
-- event by guessing an event_session_id.

-- ---------------------------------------------------------------------------
-- qr_assets
-- ---------------------------------------------------------------------------

create policy "qr_assets: managers read"
  on public.qr_assets for select to authenticated
  using (private.can_manage_event_session(event_session_id));

create policy "qr_assets: managers manage"
  on public.qr_assets for all to authenticated
  using (private.can_manage_event_session(event_session_id))
  with check (private.can_manage_event_session(event_session_id));

-- ---------------------------------------------------------------------------
-- media_items
-- ---------------------------------------------------------------------------
--
-- Hosts and collaborators read media for events they can see. Guests do NOT
-- read through this policy — guest gallery access is served by a restricted
-- operation that also enforces reveal timing and gallery visibility, neither of
-- which can be expressed safely for an anonymous role here.

create policy "media_items: viewers read on accessible session"
  on public.media_items for select to authenticated
  using (deleted_at is null and private.can_view_event_session(event_session_id));

create policy "media_items: managers update"
  on public.media_items for update to authenticated
  using (private.can_manage_event_session(event_session_id))
  with check (private.can_manage_event_session(event_session_id));

-- No client insert. Media rows are created by the upload-intent operation,
-- which enforces the shot limit, the event's open/closed state and the
-- permitted media types. A direct insert would bypass all three.

-- ---------------------------------------------------------------------------
-- media_variants
-- ---------------------------------------------------------------------------

create policy "media_variants: viewers read"
  on public.media_variants for select to authenticated
  using (
    exists (
      select 1
      from public.media_items mi
      where mi.id = media_variants.media_item_id
        and mi.deleted_at is null
        and private.can_view_event_session(mi.event_session_id)
    )
  );

-- ---------------------------------------------------------------------------
-- purchases and entitlements
-- ---------------------------------------------------------------------------

create policy "purchases: read on viewable celebration"
  on public.purchases for select to authenticated
  using (private.can_view_celebration(celebration_id));

-- No client write. A purchase row is created and verified server-side against
-- the store. Trusting a client-reported purchase is how an app gets given away.

create policy "celebration_entitlements: read on viewable celebration"
  on public.celebration_entitlements for select to authenticated
  using (private.can_view_celebration(celebration_id));

-- ---------------------------------------------------------------------------
-- Commercial catalogue — public, non-sensitive
-- ---------------------------------------------------------------------------

create policy "plans: read active"
  on public.plans for select to anon, authenticated
  using (is_active);

create policy "add_ons: read active"
  on public.add_ons for select to anon, authenticated
  using (is_active);

create policy "entitlement_definitions: read"
  on public.entitlement_definitions for select to anon, authenticated
  using (true);

create policy "plan_entitlements: read"
  on public.plan_entitlements for select to anon, authenticated
  using (
    exists (select 1 from public.plans p where p.id = plan_entitlements.plan_id and p.is_active)
  );

create policy "add_on_entitlements: read"
  on public.add_on_entitlements for select to anon, authenticated
  using (
    exists (select 1 from public.add_ons a where a.id = add_on_entitlements.add_on_id and a.is_active)
  );

-- ---------------------------------------------------------------------------
-- Internal pipeline tables — no client access at all
-- ---------------------------------------------------------------------------
--
-- RLS is enabled with no policies, so every client request returns zero rows.
-- Privileges are revoked as well, so the denial does not rest on RLS alone —
-- a future policy added by mistake still cannot expose these.
--
-- These are reached only by the service role from Edge Functions and workers.

revoke all on public.upload_intents        from anon, authenticated;
revoke all on public.upload_attempts       from anon, authenticated;
revoke all on public.processing_jobs       from anon, authenticated;
revoke all on public.storage_deletion_jobs from anon, authenticated;

-- Clients never write these directly either.
revoke insert, update, delete on public.media_items       from anon, authenticated;
revoke insert, update, delete on public.media_variants    from anon, authenticated;
revoke insert, update, delete on public.guest_sessions    from anon, authenticated;
revoke insert, update, delete on public.purchases         from anon, authenticated;
revoke insert, update, delete on public.celebration_entitlements from anon, authenticated;
revoke insert, update, delete on public.themes            from anon, authenticated;
revoke insert, update, delete on public.plans             from anon, authenticated;
revoke insert, update, delete on public.add_ons           from anon, authenticated;
revoke insert, update, delete on public.entitlement_definitions from anon, authenticated;
revoke insert, update, delete on public.plan_entitlements from anon, authenticated;
revoke insert, update, delete on public.add_on_entitlements from anon, authenticated;

-- media_items needs UPDATE for host moderation (hide/restore), which the policy
-- above already constrains to managers.
grant update on public.media_items to authenticated;
