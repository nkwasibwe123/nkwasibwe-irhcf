# Nkwasibwe Market — Research Record

> **Document status:** supplementary historical baseline. The canonical, current hierarchy and acceptance contract is [MARKETPLACE_FEATURE_RESEARCH.md](MARKETPLACE_FEATURE_RESEARCH.md). Keep the codebase-review notes below as additional context; update the canonical record first when requirements change.

Status: researched baseline; the codebase has marketplace components and tests, but production payment/payout readiness must be confirmed with provider sandbox and deployment configuration.

## Sources reviewed

1. Stripe Connect marketplace payments — seller onboarding/verification, payment routing, commissions, payout timing, refunds and dispute management: https://stripe.com/connect/marketplaces
2. Stripe Connect features — split/routed payments, payout timing, reporting and multi-party money movement: https://stripe.com/connect/features
3. PayPal multiparty overview — seller onboarding, payment methods, partner fees, FX, payouts, disputes and chargebacks: https://developer.paypal.com/platforms/overview
4. Adyen for Platforms model — verified seller onboarding, payment collection, managed/custom payouts, risk and reconciliation: https://docs.adyen.com/adyen-for-platforms-model
5. Adyen Marketplaces — split payments, deductions/commissions, holding funds, payouts and reconciliation: https://docs.adyen.com/marketplaces
6. Adyen marketplace integration checklist — provider onboarding, design, sandbox integration, testing and live-account activation: https://docs.adyen.com/marketplaces/get-started
7. WooCommerce Multi Vendor Marketplace — vendor approval, scoped product/order permissions, commissions, withdrawal policies and vendor dashboard: https://woocommerce.com/document/multi-vendor-marketplace/
8. WooCommerce Product Vendors — seller profiles, commissions, fulfillment and manual/automatic payout settings: https://woocommerce.com/document/product-vendors/
9. WooCommerce Vendor Guide — role-limited vendor access to products, orders, reports and profile: https://woocommerce.com/document/vendor-guide/

## Synthesis for Nkwasibwe

- Separate buyer, seller, platform-admin and finance-support permissions. Enforce ownership in server queries, not only by hiding UI controls.
- Use integer minor units and explicit currency rules. Document currency exponent differences; never mix displayed decimal values with ledger integers.
- Keep product/catalog, cart, checkout session, order, order items, payment transactions, refunds, seller ledger and payout requests as distinct records with explicit lifecycle states.
- Treat checkout redirect as a pending payment, not proof of payment. Only a verified provider webhook/status reconciliation may mark an order paid.
- Verify webhook signatures, deduplicate event IDs, make webhook processing idempotent and handle out-of-order events safely.
- Use hosted provider checkout; never collect or persist raw card details in Nkwasibwe.
- Seller onboarding and verification must precede seller payouts. Pending/rejected/suspended sellers cannot receive payouts.
- Use a ledger with append-only entries for sales, commission, refunds, reversals and payouts. Compute available balance from ledger/reservations, not from client-submitted amounts.
- Reserve stock transactionally during checkout; expire and release abandoned reservations. Prevent overselling under concurrent purchases.
- Snapshot product name, unit price, currency, tax, shipping, seller and commission at order time so later catalog edits do not rewrite old orders.
- Validate coupon start/end dates, currency, minimum subtotal, redemption count and concurrent redemption transactionally.
- Keep addresses, cart, orders, reviews, wishlist, transaction details and seller analytics scoped to the authenticated user/seller.
- Expose shipping, tax, refund and payout configuration readiness. If provider credentials, supported-country setup, webhook signing secret or shipping/tax rules are missing, block live checkout and show the exact missing prerequisite.
- Reconcile provider reports and internal ledger regularly. Keep audit trails for refund approvals, payout changes, manual overrides and dispute handling.
- Payment provider support is country- and account-dependent. Do not imply a provider can pay out to Rwanda until its current eligibility and the account's live approval are verified.

## Acceptance criteria

1. Buyers can browse public active products, but cart, saved addresses, wishlist, checkout and orders are account-scoped.
2. Sellers can manage only their approved seller account's products, inventory, orders and analytics.
3. Seller onboarding/approval is auditable and blocks payouts until verified.
4. Price/currency, shipping, tax, discount and commission are calculated server-side in integer minor units.
5. Checkout uses hosted provider pages and idempotency; client redirect alone never marks an order paid.
6. Signed webhook handling rejects invalid signatures, safely deduplicates repeated events and records provider references.
7. Concurrent checkout cannot oversell inventory; expired reservations are released and refunded orders update seller balances consistently.
8. Refunds, reversals and payouts update a traceable ledger and cannot make available seller balance negative.
9. Tests cover buyer/seller/admin cross-account access, price tampering, coupon races, webhook replay, invalid signature, delayed/out-of-order status, duplicate checkout, stock race, refund and payout guards.
10. Deployed sandbox checkout and webhook round-trip pass before live payments are enabled. Provider availability, fees, limits and country eligibility are disclosed.

## Codebase review notes

The current code already contains a commerce router/schema, product categories, wishlist/reviews, addresses, cart, order items, stock reservations, seller ledger, refund/payout requests, payment readiness messaging and automated tests. These are useful foundations, not proof of live readiness. The UI itself reports that hosted checkout requires configuration such as FLW_SECRET_KEY and FLW_REDIRECT_URL, webhook verification requires FLW_SECRET_HASH, shipping rates must be configured, tax needs a deliberate rate, and seller transfers may still require an external provider and admin-recorded reference. Those requirements must be verified against the actual deployed environment and sandbox transactions before accepting real money.
