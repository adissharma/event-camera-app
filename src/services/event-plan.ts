import { isBackendConfigured, requireSupabase } from '@/lib/supabase/client';
import { verifyPurchase, VerificationError, toDatabasePlatform } from './purchase-verification';
import { getPaymentProvider } from '@/features/payments';
import { upgradeChargeFor } from '@/features/payments/upgrade-catalogue';
import type { PaywallPlan } from '@/features/payments/plan-catalogue';

/**
 * The package an event is on, and moving it up.
 *
 * Entitlements belong to the event rather than to whoever is looking at it, so
 * this is keyed on the celebration and never on the signed-in account — a host
 * who bought Stories+ for a wedding has not bought it for their next event.
 */

export const eventPlanKeys = {
  forEvent: (celebrationId: string) => ['event-plan', celebrationId] as const,
};

/**
 * Reads the event's current package key.
 *
 * `null` means "no plan-granted entitlements", which the entitlement layer
 * treats as granting nothing. That is the safe direction: the alternative
 * would show premium controls to a host who has not paid and, worse, to
 * guests who must never see them at all.
 */
export async function fetchEventPlanKey(celebrationId: string): Promise<string | null> {
  if (!isBackendConfigured) return null;
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('celebration_plan_key', {
    p_celebration_id: celebrationId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export class UpgradeError extends Error {
  constructor(
    message: string,
    readonly code: 'cancelled' | 'unavailable' | 'purchase' | 'activation',
  ) {
    super(message);
    this.name = 'UpgradeError';
  }
}

/**
 * Buys the move from the event's current package to a higher one.
 *
 * Two steps, in this order and no other: take the money, then grant the tier.
 * Activating first would hand out entitlements to a purchase that may never
 * complete, and there is no way to take them back once a guest has used them.
 *
 * The product bought is the *upgrade* product, priced at the difference — see
 * `upgrade-catalogue`. What the server then activates is the destination
 * tier's full entitlement set, which is why the plan key is sent separately
 * from the product id rather than inferred from it.
 */
export async function upgradeEventPlan({
  celebrationId,
  from,
  to,
}: {
  celebrationId: string;
  from: PaywallPlan | null;
  to: PaywallPlan;
}): Promise<string> {
  const charge = upgradeChargeFor(from, to);
  if (!charge) {
    throw new UpgradeError('That package is not an upgrade for this event.', 'unavailable');
  }

  const provider = await getPaymentProvider();
  if (!(await provider.isAvailable())) {
    throw new UpgradeError('Purchases are unavailable on this device.', 'unavailable');
  }

  // Priced by the store, not by us — the catalogue's figure is what the host
  // was shown, but the charge is whatever the store says the product costs.
  const [product] = await provider.getProducts([charge.storeProductId]);
  if (!product) {
    throw new UpgradeError('This upgrade is not available to purchase yet.', 'unavailable');
  }

  const outcome = await provider.purchase(product);
  if (outcome.status === 'cancelled') {
    throw new UpgradeError('Purchase cancelled', 'cancelled');
  }
  if (outcome.status === 'failed') {
    throw new UpgradeError(outcome.message, 'purchase');
  }
  if (outcome.status === 'pending') {
    throw new UpgradeError(
      'Your purchase is still being processed. This event will unlock once it completes.',
      'purchase',
    );
  }

  const client = requireSupabase();

  // Records the purchase against the transaction that paid for it. It does
  // NOT grant the tier — the server refuses to do that on the client's word,
  // so this returns the OLD plan key and the new one only arrives once the
  // receipt is verified below.
  const { error } = await (client as any).rpc('upgrade_celebration_plan', {
    p_celebration_id: celebrationId,
    p_plan_key: to.catalogueKey,
    p_platform_product_id: outcome.receipt.platformProductId,
    p_platform_transaction_id: outcome.receipt.platformTransactionId,
    p_platform: toDatabasePlatform(outcome.receipt.platform),
  });
  if (error) {
    // The money is gone and the tier is not active. Say so plainly rather
    // than reporting a generic failure the host would reasonably read as
    // "nothing happened, try again" — and retrying is safe, because both the
    // purchase row and the activation are idempotent.
    throw new UpgradeError(
      'Payment went through but the upgrade could not be applied. Reopen the event to retry — you will not be charged twice.',
      'activation',
    );
  }

  // Verification is what actually grants the tier.
  try {
    await verifyPurchase(outcome.receipt);
  } catch (verificationError) {
    if (verificationError instanceof VerificationError && verificationError.recoverable) {
      // Charged, recorded, not yet confirmed. RevenueCat's webhook grants it
      // independently, so this is a wait rather than a loss — and the copy
      // has to say that, because a host who has just paid and sees an error
      // will otherwise assume the money went nowhere.
      throw new UpgradeError(
        'Payment went through and your package is being applied. It will appear here shortly — you have not been charged twice.',
        'activation',
      );
    }
    throw new UpgradeError(
      verificationError instanceof Error
        ? verificationError.message
        : 'Could not confirm your purchase.',
      'activation',
    );
  }

  return to.catalogueKey;
}
