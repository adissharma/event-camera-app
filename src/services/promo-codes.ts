import { LOCALE_CONFIG } from '@/config/app-config';
import { getPaymentProvider } from '@/features/payments';
import { requireSupabase } from '@/lib/supabase/client';
import { formatPrice } from '@/services/plans';

type RefusedStatus = 'invalid' | 'already_used' | 'used_up' | 'rate_limited';

const REFUSAL_MESSAGES: Record<RefusedStatus, string> = {
  invalid: "That code isn't valid.",
  already_used: "You've already used this code.",
  used_up: 'This code has been fully claimed.',
  rate_limited: 'Too many tries. Please try again in an hour.',
};

export interface PromoCodeTerms {
  /** The only package this code applies to, or null for any paid package. */
  planKey: string | null;
  /** The cheaper store product to charge. Null when the code makes it free. */
  discountedProductId: string | null;
  /** What the store will charge. Null when the code makes it free. */
  discountedPriceLabel: string | null;
}

export type PromoCodeCheck =
  | { usable: true; terms: PromoCodeTerms }
  | { usable: false; message: string };

/**
 * Asks the server whether the signed-in host can use a code, and on what terms.
 *
 * Nothing is spent here: the code is redeemed as the event publishes. A
 * discount's price comes from the store, because that is what the host will be
 * charged; if the store cannot sell the product the code is refused here
 * rather than at the moment of paying.
 */
export async function checkPromoCode(code: string): Promise<PromoCodeCheck> {
  const { data, error } = await requireSupabase().rpc('check_promo_code', { p_code: code });
  if (error) throw error;

  const result = data as {
    status: 'valid' | RefusedStatus;
    plan_key?: string | null;
    apple_product_id?: string | null;
  };
  if (result.status !== 'valid') {
    return { usable: false, message: REFUSAL_MESSAGES[result.status] };
  }

  const discountedProductId = result.apple_product_id ?? null;
  let discountedPriceLabel: string | null = null;
  if (discountedProductId) {
    const [product] = await getPaymentProvider().getProducts([discountedProductId]);
    if (!product) return { usable: false, message: 'This offer is not available right now.' };
    discountedPriceLabel =
      product.priceLabel ??
      formatPrice(product.priceMinorUnits, product.currency, LOCALE_CONFIG.locale);
  }

  return {
    usable: true,
    terms: { planKey: result.plan_key ?? null, discountedProductId, discountedPriceLabel },
  };
}
