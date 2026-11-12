import { Platform } from 'react-native';

import { FEATURE_FLAGS } from '@/config/feature-flags';
import { developmentPaymentProvider } from './development-provider';
import { hasStoreApiKey, revenueCatPaymentProvider } from './revenuecat-provider';
import type { PaymentProvider } from './types';

const STORE_NOT_READY_MESSAGE = 'Packages can’t be bought in the Android app yet. Please try again soon.';

/**
 * Stands in on Android until a Google Play key is configured, so a build with
 * real purchases switched on degrades to "not available" instead of throwing
 * the moment a host opens the package screen.
 */
const storeNotReadyProvider: PaymentProvider = {
  platform: 'google_play',
  async isAvailable() {
    return false;
  },
  async getProducts() {
    return [];
  },
  async purchase() {
    return { status: 'failed', code: 'store_not_configured', message: STORE_NOT_READY_MESSAGE };
  },
  async restore() {
    return [];
  },
};

export * from './types';

/**
 * Selects the payment provider for the current platform.
 *
 * `realPurchases` is the single switch. RevenueCat fronts both StoreKit and
 * Play Billing; implementations slot in here and nowhere else — no screen changes, because
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
      // Play Billing through RevenueCat, once EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY is set.
      return hasStoreApiKey() ? revenueCatPaymentProvider : storeNotReadyProvider;
    default:
      throw new Error('Web checkout provider not implemented yet');
  }
}
