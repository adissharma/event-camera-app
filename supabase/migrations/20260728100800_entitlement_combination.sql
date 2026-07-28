-- How entitlement values combine when a plan and one or more add-ons both
-- grant the same key.
--
-- This was missing from the original commerce migration, and the omission is a
-- real bug rather than a tidiness issue: the "extra guests" add-on grants
-- participant_limit = 100. Combining by "highest wins" would mean buying extra
-- guests on the Signature plan (150) does nothing at all, and the customer has
-- paid for it. It has to add.
--
-- Different keys genuinely need different rules, so the rule belongs on the
-- definition rather than being assumed in application code.

create type public.entitlement_combine_strategy as enum (
  'max',        -- highest value wins (a cap that an add-on may raise)
  'sum',        -- values add together (an allowance an add-on extends)
  'any_true',   -- granted if any source grants it (a capability)
  'union',      -- set union of the options (a list of permitted choices)
  'override'    -- the highest-ranked source wins outright
);

alter table public.entitlement_definitions
  add column combine_strategy public.entitlement_combine_strategy not null default 'max';

comment on column public.entitlement_definitions.combine_strategy is
  'How a plan grant and add-on grants for this key are reconciled. Chosen per '
  'key because an allowance an add-on extends (sum) and a cap an add-on raises '
  '(max) are genuinely different, and getting it wrong means a customer pays '
  'for something that has no effect.';

-- NOTE: no UPDATE statements here on purpose.
--
-- `entitlement_definitions` is populated by seed.sql, which runs AFTER all
-- migrations. Backfilling here would match zero rows on a fresh `db reset`, and
-- every key would silently keep the 'max' column default — which is precisely
-- the bug this migration exists to prevent, reintroduced invisibly.
--
-- The per-key strategy is therefore set in seed.sql alongside each definition,
-- where it is visible next to the value it governs.
--
-- The 'max' default is a safe fallback: it never grants more than the largest
-- single source, so an unclassified key under-grants rather than giving
-- something away.
