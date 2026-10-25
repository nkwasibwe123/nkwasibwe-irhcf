# Nkwasibwe Market commerce API

The commerce API is mounted at `/api/commerce`.

## Catalogue and cart

- `GET /api/commerce/products?q=&category=&sort=&limit=` — list active products with server-side search/category filtering and allowlisted sorting (`newest`, `price_asc`, `price_desc`, `name_asc`, `rating`); returns categories and rating aggregates.
- `POST /api/commerce/products` — create a product; requires an authenticated user whose numeric ID is listed in `COMMERCE_ADMIN_USER_IDS` (comma-separated).
- `PATCH /api/commerce/products/:productId` — update an existing product; same administrator allowlist.
- `GET /api/commerce/cart` — read the signed-in user's persisted cart.
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
- `FLW_REDIRECT_URL` — HTTPS URL in the storefront that handles return navigation.
- `COMMERCE_ADMIN_USER_IDS` — comma-separated numeric user IDs allowed to manage products.

`POST /api/commerce/checkout` accepts `{"items":[{"productId":1,"quantity":1}]}`. It creates a pending database order and returns a hosted checkout URL only after the provider accepts the request. If payment credentials are missing, it fails closed with `503 PAYMENT_PROVIDER_NOT_CONFIGURED`.

Set the Flutterwave webhook destination to `https://nkwasibwe-irhcf.onrender.com/api/commerce/webhook/flutterwave`. The webhook validates the `verif-hash` header, asks Flutterwave to verify the transaction server-side, and compares transaction reference, amount, and currency before marking an order paid. Do not mark an order paid from the browser redirect.

## Not yet production complete

- Do not accept real payments until a Flutterwave sandbox checkout and webhook have been verified end-to-end with test credentials.
- Product admin UI, shipping/tax calculation, refunds, order expiry/stock reservation, and production operational monitoring need further work.
- Add and test any required environment values without committing credentials to Git.
