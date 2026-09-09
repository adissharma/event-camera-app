-- Close the development purchase path.
--
-- `allow_development_purchases` let a paid plan bought through the development
-- provider (platform = web) activate with no store receipt, so the tiers could
-- be exercised end to end while StoreKit was unreachable. That is no longer
-- needed: real App Store purchases now complete, verify against RevenueCat and
-- activate — including the upgrade path priced at the difference.
--
-- While it stays true, any authenticated user can grant themselves any tier by
-- calling `publish_celebration` or `upgrade_celebration_plan` directly. That is
-- a door, not a test fixture, and it must be shut before launch.
--
-- Apple purchases are unaffected either way: those have always required
-- verification, switch or no switch.
--
-- To reopen it temporarily for testing, set the value back to 'true' — but
-- treat that as a change to production security, not a convenience.

update private.app_settings
set
  value = 'false'::jsonb,
  updated_at = now()
where key = 'allow_development_purchases';

-- The setting must exist and be false, not merely be absent. `setting_enabled`
-- reads an absent key as disabled, so either state is safe — but an explicit
-- row is what makes the decision visible to the next person who looks.
insert into private.app_settings (key, value, description)
values (
  'allow_development_purchases',
  'false'::jsonb,
  'Closed 2026-09-09, once verified App Store purchases were working. While '
  'true, any authenticated user can grant themselves any tier without paying.'
)
on conflict (key) do update
set value = 'false'::jsonb, updated_at = now();
