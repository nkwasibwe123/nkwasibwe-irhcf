# Nkwasibwe Market — six-source feature deep dive

**Status:** researched design baseline, not a claim that every listed capability is implemented. Runtime code, provider eligibility, Rwanda-specific settlement availability, production payment credentials, and live end-to-end flows must be verified independently.

## 1. Sources reviewed (six distinct products/sites)

1. **Stripe Connect — marketplaces**: https://stripe.com/connect/marketplaces  
   Pattern: seller onboarding and verification, fee collection, payout scheduling, and compliance support.  
   IRHCF decision: keep seller verification, platform fees, balance accounting, payout state, and reconciliation explicit. Do not assume Stripe Connect is enabled or available for every country/account.

2. **Adyen — marketplaces**: https://docs.adyen.com/marketplaces  
   Pattern: onboard/verify marketplace users, split payments, hold/transfer funds, manage risk, and reconcile reports.  
   IRHCF decision: model each payment as explicit allocations (seller share, platform fee, provider fees, refunds) and require signed webhooks plus reconciliation before changing balances.

3. **PayPal — seller onboarding**: https://developer.paypal.com/platforms/seller-onboarding  
   Pattern: seller onboarding is an explicit risk/compliance process, not merely collecting a payout email.  
   IRHCF decision: seller payout destinations need a provider-owned onboarding/verification state and must not become eligible for payouts until approved.

4. **Flutterwave — split payments**: https://developer.flutterwave.com/v3.0.0/docs/split-payments  
   Pattern: subaccounts and split settlement can distribute a transaction and commission; the platform still has merchant vetting and dispute/chargeback responsibility.  
   IRHCF decision: the current hosted-checkout integration must verify provider transaction ID, reference, successful status, exact amount and currency, and webhook signature. Automated split payouts remain disabled until provider onboarding and sandbox/live evidence exist.

5. **WooCommerce — Product Vendors**: https://woocommerce.com/document/product-vendors/  
   Pattern: vendor applications and approval, vendor storefronts, product/order management, commissions, withdrawal requests, and manual or provider-dependent payout paths.  
   IRHCF decision: use role-scoped seller dashboards, listing moderation, explicit fulfillment states, commission ledger entries, and payout approvals with audit trails.

6. **Sharetribe — marketplace features**: https://www.sharetribe.com/features/  
   Pattern: buyer/seller profiles, listings, search/filter/sort, inventory, bookings or purchases, messaging, notifications, reviews, admin moderation, and digital downloads.  
   IRHCF decision: implement the core buyer journey first, then extend it with digital goods, bookings/services, AI-assisted discovery, seller analytics, and controlled integrations. Every transaction state and review must be tied to a real user and transaction.

## 2. Synthesis — the product contract

The strongest common pattern across the six sources is not simply a product grid. A real marketplace requires **two-sided identities, listings, discovery, transaction state, buyer/seller communication, trust and moderation, and a financial ledger**. Payments and payouts are separate state machines. Provider approval, geographic availability, fees, KYC/merchant vetting, chargebacks, and settlement timing constrain what can safely be enabled.

IRHCF should keep its own order and ledger records authoritative, while treating the payment provider as the source of truth for external transaction status. A browser return URL is a UX signal only; it must never by itself mark an order paid.

## 3. Hierarchy and dashboard placement

### Platform → Nkwasibwe Market

- **Buyer workspace**
  - Discovery
    - Search by keyword, category, seller, price range, rating and availability
    - Sort by relevance, newest, price and rating using server-side allowlists
    - Product/service detail, seller profile, verified reviews and related items
  - Cart and checkout
    - Add/update/remove items; validate inventory and seller eligibility
    - Shipping address/rate and tax quote where configured
    - Coupon validation and immutable price quote
    - Idempotent checkout creation; hosted provider redirect
    - Verified return/status refresh; never trust client-supplied amount or payment status
  - Orders
    - Pending payment → paid → processing → shipped/delivered/completed, or failed/cancelled/refunded
    - Order details, seller messages, delivery/fulfillment evidence, support and dispute path
  - Purchases and digital library
    - Download only after server-confirmed payment and owner check
    - Expiring/authorized downloads, retention and audit events

- **Seller workspace**
  - Seller application and identity
    - Application → under review → approved/rejected/suspended
    - Provider onboarding status and payout eligibility
  - Storefront and catalogue
    - Profile, branding, categories, product/service listings, media, inventory and price
    - Draft → submitted → approved/published → rejected/archived
  - Fulfillment and customer care
    - Paid orders only; allowed state transitions; tracking/reference; buyer communication
  - Finance
    - Sales, platform fees, refunds, chargebacks, provider settlements, payable balance and reconciliation
    - Payout request → review → approved → paid/failed, with immutable audit trail
    - Automatic payouts disabled until a real provider integration is approved and verified
  - Analytics
    - Gross sales, net sales, fees, refunds, conversion and listing performance from persisted records

- **Admin workspace**
  - Seller/listing moderation and abuse reports
  - Order, payment, refund and dispute review
  - Coupon/tax/shipping/platform-fee configuration with validation and audit logs
  - Ledger reconciliation and payout approval; no direct arbitrary balance edits
  - Health, provider readiness, webhook failures, idempotency conflicts and operational alerts

### Dashboard rule

The main dashboard shows only the Market workspace entry, recent/pinned work, global search and genuine attention items. Inside Market, show buyer/seller/admin tabs based on server-authorized roles. Inside each feature, use Recent / Running / Succeeded / Failed only when that feature performs tasks. Do not put seller finance, payment diagnostics or activity cards into general chat.

## 4. Security and data invariants

- Every order, address, cart, review, message, download, payout request and analytics query is scoped to the authenticated account or authorized seller/admin role.
- The server calculates the quote and persists the exact total/currency before checkout. Never accept a total, discount, seller share, status, or owner ID as authoritative from the browser.
- Require idempotency keys for checkout creation; scope them to account and request fingerprint; serialize concurrent duplicate requests.
- Webhook validation must fail closed for malformed signatures and bind the provider's verified transaction ID, transaction reference, order, amount and currency.
- Only verified successful provider states can mark an order paid. Pending, failed, cancelled, mismatched, underpaid, wrong-currency and replayed events must not double-book ledger entries.
- Provider calls need bounded timeouts. Redirect and hosted checkout URLs must be HTTPS. Secrets must never appear in logs or status responses.
- Refunds reverse ledger allocations and preserve the original entries. Payouts require verified available balance, approved destination, idempotency, role authorization and an audit record.
- Seller payout state must be distinct from buyer payment state. A paid order does not prove that a seller has been paid.
- Rate-limit high-risk routes, validate uploaded listing media, and preserve safe error codes and request IDs.

## 5. State machines

- **Listing:** draft → submitted → approved/published → archived; rejection returns to draft with a reason.
- **Order:** pending_payment → paid → processing → fulfilled/completed; failure/cancel/refund transitions are explicit and idempotent.
- **Payment:** created → pending_provider → succeeded/failed/cancelled/expired; only provider-verified success is final.
- **Refund:** requested → reviewed → submitted_to_provider → succeeded/failed; retry only with a stable idempotency key.
- **Seller:** applied → under_review → approved/rejected/suspended; payout eligibility is an independent state.
- **Payout:** requested → approved → submitted → paid/failed/cancelled; only real provider confirmation can set paid.

Illegal transitions must return stable errors and must not mutate financial records.

## 6. Acceptance tests and release gates

- [ ] Search, category filters, allowlisted sorting, listing details and seller pages work on mobile.
- [ ] Listing ownership and seller/admin roles are enforced on every write and read path.
- [ ] Checkout rejects missing secrets, invalid HTTPS redirect, invalid cart/inventory, wrong-account addresses, and malformed idempotency keys.
- [ ] Parallel requests with the same account/key create one order/provider checkout; reusing the key with different cart details returns conflict.
- [ ] Provider timeout, malformed response, HTTP failure and unsafe hosted link leave no paid order and release reservations safely.
- [ ] Webhook tests cover bad/missing signature, invalid UTF-8, wrong transaction ID/reference, pending status, underpayment, wrong currency, duplicate/replayed event and concurrent delivery.
- [ ] Refund, seller commission, platform fee, payout approval and ledger reconciliation are tested with immutable transaction records.
- [ ] Buyer cannot access another buyer's orders, addresses, digital files or messages; seller cannot access another seller's finance/order details.
- [ ] Downloads are unavailable until payment is verified and are restricted to the rightful buyer.
- [ ] Browser return refreshes from backend status and cannot mark payment as successful on its own.
- [ ] CI passes, the deployed backend health check passes, CORS preflight permits the storefront origin and idempotency header, and a provider sandbox round-trip is recorded before production payment claims.
- [ ] Dashboard states match backend records; no fake progress, fabricated payouts, or success claims when provider credentials/scopes are absent.

## 7. Current verified scope versus remaining work

Recent code/CI coverage includes hosted Flutterwave checkout configuration, account-scoped idempotency, checkout replay behavior, authenticated customer email, HTTPS redirect validation, bounded provider calls, webhook signature/replay checks, verified transaction ID/reference, amount/currency and pending-status rejection, order ownership checks, and CORS preflight smoke tests.

Still requiring separate evidence: live Flutterwave sandbox round-trip using authorized credentials, country/account eligibility, provider settlement reconciliation, actual refund execution, any real automated seller payout, and end-to-end mobile buyer/seller journeys. Do not advertise those as enabled until each gate passes.
