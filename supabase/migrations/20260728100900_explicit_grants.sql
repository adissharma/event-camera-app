-- Explicit table privileges.
--
-- WHY THIS EXISTS
--
-- The earlier RLS migration only ever REVOKED. Everything the client legitimately
-- needs was left to Supabase's `alter default privileges` setup, which grants
-- broadly to anon and authenticated on newly created tables.
--
-- That assumption is environment-dependent, and the divergence is not
-- theoretical: the identical schema returned `[]` for public.celebrations on the
-- hosted project (grant present, RLS filtering) but `permission denied` on a
-- local stack (no grant at all). A schema whose access control depends on which
-- environment applied it is not a schema you can reason about.
--
-- So privileges are now stated explicitly here. RLS decides WHICH ROWS a caller
-- sees; grants decide whether the caller may touch the table at all. Both layers
-- are required, and both are now in source control.
--
-- Anything absent from this file is denied. That is deliberate.

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- authenticated — reads
-- ---------------------------------------------------------------------------
--
-- Every one of these is still row-filtered by the policies in the RLS
-- migration. A grant here is permission to ask the question, not permission to
-- see the answer.

grant select on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.themes,
  public.celebrations,
  public.celebration_collaborators,
  public.event_sessions,
  public.access_links,
  public.guest_sessions,
  public.qr_assets,
  public.media_items,
  public.media_variants,
  public.plans,
  public.add_ons,
  public.entitlement_definitions,
  public.plan_entitlements,
  public.add_on_entitlements,
  public.purchases,
  public.celebration_entitlements
to authenticated;

-- ---------------------------------------------------------------------------
-- authenticated — writes
-- ---------------------------------------------------------------------------
--
-- Narrower than the reads on purpose. Each corresponds to a policy that already
-- constrains it to a workspace member or celebration manager.

grant insert on
  public.workspaces,
  public.celebrations,
  public.event_sessions,
  public.celebration_collaborators,
  public.access_links,
  public.qr_assets
to authenticated;

grant update on
  public.profiles,
  public.workspaces,
  public.celebrations,
  public.event_sessions,
  public.celebration_collaborators,
  public.access_links,
  public.qr_assets,
  public.media_items          -- host moderation: hide and restore
to authenticated;

-- Deletion is limited to collaboration and sharing artefacts. Celebrations,
-- event sessions and media are soft-deleted instead, so an accidental tap is
-- recoverable and storage cleanup can be queued rather than immediate.
grant delete on
  public.celebration_collaborators,
  public.access_links,
  public.qr_assets
to authenticated;

-- ---------------------------------------------------------------------------
-- anon — public catalogue only
-- ---------------------------------------------------------------------------
--
-- The guest web experience renders a theme and a price before any guest
-- identity exists. None of this is user data.
--
-- anon gets SELECT on these six tables and nothing else, anywhere.

grant select on
  public.themes,
  public.plans,
  public.add_ons,
  public.entitlement_definitions,
  public.plan_entitlements,
  public.add_on_entitlements
to anon;

-- ---------------------------------------------------------------------------
-- Re-assert the denials
-- ---------------------------------------------------------------------------
--
-- Repeated after the grants above so this file is the single, complete picture
-- of client privileges, and so a broad grant added later in this file could not
-- silently re-open them.

revoke all on public.upload_intents        from anon, authenticated;
revoke all on public.upload_attempts       from anon, authenticated;
revoke all on public.processing_jobs       from anon, authenticated;
revoke all on public.storage_deletion_jobs from anon, authenticated;

-- Written only by server-side operations that enforce shot limits, event
-- open/closed state, permitted media types and store receipt verification.
revoke insert, update, delete on public.guest_sessions           from anon, authenticated;
revoke insert, update, delete on public.purchases                from anon, authenticated;
revoke insert, update, delete on public.celebration_entitlements from anon, authenticated;
revoke insert, delete         on public.media_items              from anon, authenticated;
revoke insert, update, delete on public.media_variants           from anon, authenticated;

-- Catalogue is read-only to clients.
revoke insert, update, delete on public.themes                  from anon, authenticated;
revoke insert, update, delete on public.plans                   from anon, authenticated;
revoke insert, update, delete on public.add_ons                 from anon, authenticated;
revoke insert, update, delete on public.entitlement_definitions from anon, authenticated;
revoke insert, update, delete on public.plan_entitlements       from anon, authenticated;
revoke insert, update, delete on public.add_on_entitlements     from anon, authenticated;

-- anon never reads user or guest data, regardless of any policy.
revoke all on public.profiles                 from anon;
revoke all on public.workspaces               from anon;
revoke all on public.workspace_members        from anon;
revoke all on public.celebrations             from anon;
revoke all on public.celebration_collaborators from anon;
revoke all on public.event_sessions           from anon;
revoke all on public.access_links             from anon;
revoke all on public.guest_sessions           from anon;
revoke all on public.qr_assets                from anon;
revoke all on public.media_items              from anon;
revoke all on public.media_variants           from anon;
revoke all on public.purchases                from anon;
revoke all on public.celebration_entitlements from anon;
