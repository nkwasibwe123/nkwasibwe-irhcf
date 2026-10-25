# Nkwasibwe Market commerce API

The commerce API is mounted at `/api/commerce`.

## Catalogue and cart

- `GET /api/commerce/products?q=&category=&sort=&limit=` — list active products with server-side search/category filtering and allowlisted sorting (`newest`, `price_asc`, `price_desc`, `name_asc`, `rating`); returns categories, seller shop names/IDs and rating aggregates. The storefront UI supports side-by-side comparison of up to three products (price, seller, category, rating, availability, delivery requirement and description).
- `GET /api/commerce/sellers/:sellerUserId/storefront` — public profile for an approved seller plus their active products and rating aggregates. Private seller contact email/phone are not returned.
- `POST /api/commerce/seller/apply`, `GET /api/commerce/seller/profile` — submit/read the authenticated account's seller application.
- `GET /api/commerce/seller/applications`, `PATCH /api/commerce/seller/applications/:userId` — administrator-only seller approval/rejection/suspension.
- `GET /api/commerce/seller/products` — list products belonging to the signed-in approved seller.
- `GET /api/commerce/seller/orders` — paid orders containing items owned by the signed-in approved seller.
- `PATCH /api/commerce/seller/order-items/:itemId/fulfillment` — update fulfillment for a seller-owned paid order item using allowed status transitions; marking an item shipped requires a carrier/delivery method and tracking/reference number, which the buyer can see in order details.
- `GET /api/commerce/seller/payouts`, `POST /api/commerce/seller/payout-requests` — account-scoped seller earnings, available balance and payout requests.
- `GET /api/commerce/seller/analytics?days=7|30|90` — approved-seller-only sales totals, daily sales, top products and fulfillment counts from provider-confirmed paid orders.
- `GET /api/commerce/payout-requests`, `PATCH /api/commerce/payout-requests/:requestId` — administrator payout review.
- `POST /api/commerce/products` — create a product; requires a configured administrator or an approved seller. Seller-created products are owned by that seller account.
- `PATCH /api/commerce/products/:productId` — update a product; administrators can manage all products, while sellers can manage only products they own.
- `PUT /api/commerce/products/:productId/image` — upload a JPEG, PNG or WebP product image (max 2 MiB), with byte-signature verification and product ownership enforcement.
- `GET /api/commerce/products/:productId/image` — deliver the stored public image for an active product from an approved seller or the platform.
- `GET /api/commerce/cart` — read the signed-in user's persisted cart.
- `GET /api/commerce/addresses`, `POST /api/commerce/addresses`, `PUT /api/commerce/addresses/:addressId/default`, `DELETE /api/commerce/addresses/:addressId` — private account-owned delivery address book.
- `GET /api/commerce/orders/:orderId` — order details and line items; the order must belong to the signed-in account.
- `GET /api/commerce/orders/:orderId/receipt` — printable HTML receipt/invoice for a paid or refunded order; owner-scoped, HTML-escaped and no-store.
- `POST /api/commerce/quote` — server-calculated cart subtotal, coupon discount, shipping, tax and total from current database prices and server configuration.
- `POST /api/commerce/orders/:orderId/refund-request`, `GET /api/commerce/orders/:orderId/refund-request` — account-owned refund/return request workflow.
- `GET /api/commerce/refund-requests`, `PATCH /api/commerce/refund-requests/:requestId` — administrator review; marking a request `refunded` requires the external payment-provider refund reference.
- `POST /api/commerce/coupons`, `GET /api/commerce/coupons`, `PATCH /api/commerce/coupons/:couponId` — administrator coupon management.
- `GET /api/commerce/wishlist` and `PUT /api/commerce/wishlist/:productId` with `{"saved":true|false}` — private, account-scoped favourites.
- `GET /api/commerce/products/:productId/reviews` — public product reviews.
- `POST /api/commerce/products/:productId/reviews` — create/update a 1–5 star review; the same account must have a confirmed paid order containing that product.
- `PUT /api/commerce/cart/items/:productId` with JSON `{"quantity":2}` — set quantity; quantity 0 removes the item.
- `GET /api/commerce/orders` — list only the signed-in user's orders.

Prices are server-owned integers in minor currency units. Checkout ignores client-supplied prices and calculates totals from database product rows. Product images must use HTTPS.

## Hosted checkout (Flutterwave)

Configure these in Render **Environment** as secrets/configuration values before enabling checkout:

- `FLW_SECRET_KEY` — Flutterwave test secret key while sandbox testing.
- `FLW_SECRET_HASH` — exact webhook secret hash configured in Flutterwave.
- `FLW_REDIRECT_URL` — HTTPS URL for the deployed `market.html` storefront; it receives the provider return and polls the server-side order status by `tx_ref`. The browser return status is never treated as proof of payment.
- `COMMERCE_ADMIN_USER_IDS` — comma-separated numeric user IDs allowed to manage products.

`POST /api/commerce/checkout` accepts `{"items":[{"productId":1,"quantity":1}],"addressId":123}`. Physical products require an address ID owned by the signed-in account; the server stores an address snapshot on the order. Digital/non-shipping products may omit it. It requires an `Idempotency-Key` header containing 16–128 characters from `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, or `-`. Generate a fresh random key (for example, a UUID) for each new checkout attempt and reuse that same key only when retrying the exact same cart, address ID, and coupon. The key is scoped to the signed-in account: repeating it with the same request returns the existing hosted checkout instead of creating a second order; reusing it for different cart/address/coupon details returns `409 IDEMPOTENCY_KEY_REUSED`. Do not reuse a key after the cart or delivery details change. It creates a pending database order and returns a hosted checkout URL only after the provider accepts the request. If payment credentials are missing, it fails closed with `503 PAYMENT_PROVIDER_NOT_CONFIGURED`.

Set the Flutterwave webhook destination to `https://nkwasibwe-irhcf.onrender.com/api/commerce/webhook/flutterwave`. The webhook validates the `verif-hash` header, asks Flutterwave to verify the transaction server-side, and compares transaction reference, amount, and currency before marking an order paid. Do not mark an order paid from the browser redirect.

## Not yet production complete

- Do not accept real payments until a Flutterwave sandbox checkout and webhook have been verified end-to-end with test credentials.
- Shipping carrier/rate integration, tax calculation, automated payment-provider refunds (refund status is not changed to `refunded` until an external refund has been completed and referenced), returns/disputes logistics, seller payouts and settlement reconciliation, product image uploads, order expiry/stock reservation, and production operational monitoring need further work.
- Add and test any required environment values without committing credentials to Git.


- `GET /api/commerce/status` — public, non-secret readiness diagnostics for hosted checkout, webhook verification, shipping, tax and payout automation.

## Shipping and tax configuration

- `COMMERCE_SHIPPING_RATES_JSON` is a JSON object keyed by the exact country name saved on the delivery address, then currency, with the shipping price in minor units. Example: `{"Rwanda":{"RWF":1500},"Kenya":{"KES":500}}`.
- Physical-product quotes and checkout fail closed if no rate exists for the selected country and currency. Digital/non-shipping carts use zero shipping.
- `COMMERCE_TAX_BPS` is an integer tax rate in basis points (`1000` = 10%). It defaults to zero; the business owner must configure a legally appropriate rate with a qualified tax adviser before real sales. Tax is calculated on subtotal minus coupon discount plus shipping.
- Order records keep subtotal, discount, shipping, tax, tax rate and charged total separately so the buyer can inspect the breakdown.


## Product image storage

Product images are currently stored in PostgreSQL as `BYTEA` blobs, limited to 2 MiB each and JPEG/PNG/WebP only. This keeps the first version self-contained without a paid image host, but increases database size and backup time; for a high-volume marketplace, migrate images to object storage with signed upload URLs and CDN delivery.


## Seller earnings and payouts

- `COMMERCE_PLATFORM_FEE_BPS` is stored per order and applied to each seller's product revenue after proportional coupon discount allocation; default is 0 basis points.
- Seller balances are derived from a payment-verified ledger created by the successful provider webhook. Seller IDs are taken from product ownership, not browser-supplied IDs.
- Pending and approved payout requests reduce the available balance; rejected requests release it. Completed refunds create auditable seller-ledger reversals, which reduce earned/available balance; payout completion is blocked if the resulting available balance is negative. A request must not exceed that seller account's available balance for the requested currency.
- Payout requests store only a verified provider beneficiary/subaccount reference, not raw bank credentials. The current admin flow records a transfer reference after the transfer is performed externally; **it does not send money automatically**. Provider transfer API integration, seller KYC and settlement reconciliation are required before production payouts.
