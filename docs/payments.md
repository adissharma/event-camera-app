# Payments and App Store classification

Referenced from `supabase/migrations/20260728100400_commerce.sql`.

**Nothing in this document has been confirmed with Apple or with a lawyer. It
records the assumptions the schema was built on, and flags the decisions a
human has to make before launch.**

## The core constraint

This product unlocks **digital functionality inside an app** — more guests,
unlimited photos, extra QR templates, longer gallery retention. Apple's
guideline 3.1.1 requires in-app purchase for that, and Stripe or any other
external processor is not permitted for it on iOS.

**Default position: StoreKit on iOS, Google Play Billing on Android.** Web
checkout is available only in genuinely external contexts.

Do not assume a "service" framing exempts this. The exemptions under 3.1.3 —
"reader" apps, multiplatform services, person-to-person experiences — are
narrower than they read, and a photo-sharing app that unlocks features for the
purchaser is squarely inside 3.1.1.

### What needs a human decision before submission

1. **Is this a digital good or a real-world service?** An argument exists that
   the host is buying an event service rather than app functionality. It is not
   a strong one while the deliverable is entirely in-app, and betting the launch
   on it is a poor trade — a rejection costs a review cycle.
2. **Does the physical-goods carve-out ever apply?** Printed QR signage or a
   physical photobook are genuinely physical goods and must **not** go through
   IAP. If those ship, they need a separate, external payment path.
3. **Small Business Program.** Under $1M/year, the commission is 15% rather than
   30%. Enrolment is a form, and it materially changes pricing.
4. **UK/EU alternative payment options.** DMA-driven changes to link-out and
   alternative billing are moving quickly. Verify the current position at
   submission rather than trusting anything written here.

Treat all four as open until someone with authority signs them off.

## Architecture

The payment layer is an abstraction over three billing surfaces. No screen calls
a billing SDK directly, so the platform rules are enforced in one place.

```
PaymentProvider (interface)
  ├── RevenueCatProvider    iOS StoreKit/App Store purchases
  ├── PlayBillingProvider   Android
  ├── WebCheckoutProvider   external web contexts only
  └── DevelopmentProvider   no billing service contacted; FEATURE_FLAGS.realPurchases = false
```

The iOS implementation uses `react-native-purchases` and the plan catalogue's
`storeProductId` values. The current packages are event-scoped non-subscription
products, so the provider fetches them as `PRODUCT_CATEGORY.NON_SUBSCRIPTION`
and purchases them with RevenueCat's direct store-product API rather than using
RevenueCat's hosted paywall.

The catalogue carries `apple_product_id`, `google_product_id` and
`web_product_id` on both `plans` and `add_ons` from the start. Retrofitting a
second billing surface after launch means a migration plus a reconciliation of
live entitlements, which is exactly the kind of change that goes wrong.

## Transaction flow

1. Preserve the draft server-side. **Before** any purchase — a purchase that
   succeeds against a lost draft is the worst outcome available.
2. Start the platform-compliant purchase.
3. Verify the receipt **server-side**. Never trust a client claim of purchase.
4. Activate entitlements into `celebration_entitlements`.
5. Publish the celebration and its access link.
6. Generate QR assets.
7. Show success.

## Idempotency

`purchases` is unique on `(platform, platform_transaction_id)`.

This is not defensive padding. Both stores deliver a transaction more than once
in normal operation, and **restore purchases replays every past transaction**.
Without that constraint a restore double-grants entitlements, and a retried
webhook can double-charge. Verification must be safe to run repeatedly and
converge on the same state.

## Server-side verification

- **iOS:** App Store Server API, verifying the signed transaction (JWS). The
  legacy `verifyReceipt` endpoint is deprecated and must not be used for new work.
- **Android:** Google Play Developer API `purchases.products.get`, then
  acknowledge within three days or **Google automatically refunds the purchase**.
- **Web:** the processor's webhook, with signature verification and replay
  protection.

Verification runs in an Edge Function with the service-role key. That key must
never appear in the app bundle — `EXPO_PUBLIC_*` variables are inlined into the
JavaScript and are readable by anyone who downloads the app.

## Restore purchases

Required by App Store review. A user who reinstalls, or signs in on a second
device, must be able to recover what they paid for without paying again.
Restoring replays past transactions, which is why step 4 must be idempotent.

## Refunds and revocation

`purchases.status` carries `refunded` and `revoked`, and
`celebration_entitlements` records which purchase granted each entitlement. That
provenance is what makes revocation possible at all — without it, a refund
cannot be traced to the features it paid for.

**Open question:** what happens to a live event whose purchase is refunded
mid-celebration. Cutting guests off during a wedding is indefensible; leaving it
running is exploitable. Current thinking is to honour the event to its close and
withhold retention and export, but this needs a product decision.

## Pricing

Prices are stored in **integer minor units** with an explicit currency.
Floating-point currency arithmetic produces rounding errors that surface on
invoices.

Placeholder pricing is £49 / £79 / £149. Store product identifiers are
placeholders (`com.example.eventcamera.*`) and must be replaced before release —
see `docs/renaming.md`.

## Status

| | |
|---|---|
| Schema supports all three billing surfaces | ✅ |
| Idempotency constraint in place | ✅ |
| Entitlement provenance recorded | ✅ |
| Payment abstraction implemented | ❌ Phase 6 |
| Receipt verification implemented | ❌ Phase 6 |
| App Store classification confirmed | ❌ **needs a human decision** |
| Pricing confirmed | ❌ placeholder |
