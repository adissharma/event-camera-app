import { Platform } from 'react-native';

import { FEATURE_FLAGS } from '@/config/feature-flags';
import { developmentPaymentProvider } from './development-provider';
import { revenueCatPaymentProvider } from './revenuecat-provider';
import type { PaymentProvider } from './types';

export * from './types';

/**
 * Selects the payment provider for the current platform.
 *
 * `realPurchases` is the single switch. StoreKit and Play Billing
 * implementations slot in here and nowhere else — no screen changes, because
 * screens only ever see the `PaymentProvider` interface.
 */
export function getPaymentProvider(): PaymentProvider {
  if (!FEATURE_FLAGS.realPurchases) {
    return developmentPaymentProvider;
  }

  switch (Platform.OS) {
    case 'ios':
      return revenueCatPaymentProvider;
    case 'android':
      throw new Error('Play Billing provider not implemented yet');
    default:
      throw new Error('Web checkout provider not implemented yet');
  }
}
