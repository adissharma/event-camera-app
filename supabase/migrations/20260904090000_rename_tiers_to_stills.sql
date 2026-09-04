-- Tier display names follow the app's rename to Stills.
--
-- `plans.name` still read "Stories" and "Stories+", while the paywall, the
-- App Store products and RevenueCat had all moved to "Stills Lite" and
-- "Stills+". A host would have seen one name on the pricing card and another
-- on Apple's purchase sheet at the moment of deciding to pay.
--
-- Display text only. Keys, tier ranks, prices and product ids are untouched,
-- so nothing that resolves an entitlement or matches a store product changes.
--
-- The middle tier stays "Small Event": it describes what it is rather than
-- carrying the brand, which is a deliberate choice rather than an oversight.

begin;

update public.plans set name = 'Stills Lite', updated_at = now() where key = 'guests_100';
update public.plans set name = 'Stills+',     updated_at = now() where key = 'guests_unlimited';

commit;
