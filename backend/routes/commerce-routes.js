"use strict";

const express = require("express");
const crypto = require("node:crypto");

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;
const CURRENCIES = new Set(["RWF", "USD", "EUR", "GBP", "UGX", "KES", "TZS", "NGN", "ZAR"]);

async function ensureCommerceSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS commerce_products (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 180),
      description TEXT NOT NULL DEFAULT '',
      sku TEXT UNIQUE,
      price_minor BIGINT NOT NULL CHECK (price_minor >= 0),
      currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency IN ('RWF','USD','EUR','GBP','UGX','KES','TZS','NGN','ZAR')),
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_products_active ON commerce_products(active, id);
    CREATE TABLE IF NOT EXISTS commerce_orders (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      tx_ref TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded')),
      currency TEXT NOT NULL,
      total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
      provider TEXT NOT NULL DEFAULT 'flutterwave',
      provider_transaction_id TEXT,
      checkout_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_orders_user_created ON commerce_orders(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS commerce_order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
      unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
      line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order ON commerce_order_items(order_id);
    CREATE TABLE IF NOT EXISTS commerce_cart_items (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_cart_user_updated ON commerce_cart_items(user_id, updated_at DESC);
  `);
}

function safeInteger(value, min, max) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}
function toProviderAmount(minor, currency) {
  // RWF and several African currencies are conventionally integer-denominated.
  return ["RWF", "UGX", "XAF", "XOF", "JPY"].includes(currency) ? Number(minor) : Number(minor) / 100;
}
function fromProviderAmount(amount, currency) {
  return Math.round(Number(amount) * (["RWF", "UGX", "XAF", "XOF", "JPY"].includes(currency) ? 1 : 100));
}

function createCommerceRouter({ pool, authenticateToken, fetchImpl = globalThis.fetch, env = process.env } = {}) {
  if (!pool || typeof pool.query !== "function") throw new Error("Commerce router requires a database pool.");
  if (typeof authenticateToken !== "function") throw new Error("Commerce router requires authentication middleware.");
  const router = express.Router();

  router.get("/products", async (req, res) => {
    try {
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
      const result = await pool.query(
        "SELECT id, name, description, sku, price_minor, currency, stock_quantity, image_url FROM commerce_products WHERE active = TRUE ORDER BY id LIMIT $1",
        [limit]
      );
      return res.json({ success: true, products: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load products.", code: "PRODUCTS_LOAD_FAILED" });
    }
  });

  router.get("/cart", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT p.id AS product_id, p.name, p.description, p.price_minor, p.currency, p.stock_quantity, p.image_url, c.quantity, (p.price_minor * c.quantity) AS line_total_minor FROM commerce_cart_items c JOIN commerce_products p ON p.id=c.product_id WHERE c.user_id=$1 AND p.active=TRUE ORDER BY c.updated_at DESC",
        [req.user.id]
      );
      return res.json({ success: true, items: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load cart.", code: "CART_LOAD_FAILED" });
    }
  });

  router.put("/cart/items/:productId", authenticateToken, async (req, res) => {
    const productId = safeInteger(req.params.productId, 1, Number.MAX_SAFE_INTEGER);
    const quantity = safeInteger(req.body?.quantity, 0, MAX_QUANTITY);
    if (!productId || quantity === null) {
      return res.status(400).json({ success: false, error: "Use a valid product ID and quantity from 0 to 99.", code: "CART_ITEM_INVALID" });
    }
    try {
      const product = await pool.query("SELECT id, stock_quantity FROM commerce_products WHERE id=$1 AND active=TRUE", [productId]);
      if (!product.rows.length) return res.status(404).json({ success: false, error: "Product not found.", code: "PRODUCT_NOT_FOUND" });
      if (quantity > Number(product.rows[0].stock_quantity)) {
        return res.status(409).json({ success: false, error: "Requested quantity exceeds current stock.", code: "INSUFFICIENT_STOCK" });
      }
      if (quantity === 0) {
        await pool.query("DELETE FROM commerce_cart_items WHERE user_id=$1 AND product_id=$2", [req.user.id, productId]);
        return res.json({ success: true, removed: true });
      }
      const result = await pool.query(
        "INSERT INTO commerce_cart_items (user_id, product_id, quantity) VALUES ($1,$2,$3) ON CONFLICT (user_id, product_id) DO UPDATE SET quantity=EXCLUDED.quantity, updated_at=CURRENT_TIMESTAMP RETURNING user_id, product_id, quantity",
        [req.user.id, productId, quantity]
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not update cart.", code: "CART_UPDATE_FAILED" });
    }
  });

  router.get("/orders", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, tx_ref, status, currency, total_minor, provider, checkout_url, created_at, updated_at, paid_at FROM commerce_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
        [req.user.id]
      );
      return res.json({ success: true, orders: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load orders.", code: "ORDERS_LOAD_FAILED" });
    }
  });

  router.post("/checkout", authenticateToken, async (req, res) => {
    if (!env.FLW_SECRET_KEY || !env.FLW_SECRET_HASH) {
      return res.status(503).json({
        success: false,
        code: "PAYMENT_PROVIDER_NOT_CONFIGURED",
        error: "Hosted checkout is disabled until Flutterwave test credentials and webhook secret are configured."
      });
    }
    if (typeof fetchImpl !== "function") {
      return res.status(503).json({ success: false, code: "PAYMENT_FETCH_UNAVAILABLE", error: "Payment gateway request support is unavailable." });
    }
    const input = req.body?.items;
    if (!Array.isArray(input) || input.length < 1 || input.length > MAX_ITEMS) {
      return res.status(400).json({ success: false, code: "CART_INVALID", error: "Provide between 1 and 50 cart items." });
    }
    const quantities = new Map();
    for (const item of input) {
      const id = safeInteger(item?.productId, 1, Number.MAX_SAFE_INTEGER);
      const quantity = safeInteger(item?.quantity, 1, MAX_QUANTITY);
      if (!id || !quantity) return res.status(400).json({ success: false, code: "CART_ITEM_INVALID", error: "Each cart item needs a valid productId and quantity from 1 to 99." });
      quantities.set(id, (quantities.get(id) || 0) + quantity);
      if (quantities.get(id) > MAX_QUANTITY) return res.status(400).json({ success: false, code: "CART_QUANTITY_LIMIT", error: "A product quantity cannot exceed 99." });
    }

    const client = typeof pool.connect === "function" ? await pool.connect() : null;
    if (!client) return res.status(503).json({ success: false, code: "CHECKOUT_TRANSACTION_UNAVAILABLE", error: "Secure checkout requires transactional database support." });
    let orderId;
    let txRef;
    let totalMinor;
    let currency;
    try {
      await client.query("BEGIN");
      const ids = [...quantities.keys()];
      const productResult = await client.query(
        "SELECT id, name, price_minor, currency, stock_quantity FROM commerce_products WHERE active = TRUE AND id = ANY($1::bigint[]) FOR UPDATE",
        [ids]
      );
      if (productResult.rows.length !== ids.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, code: "PRODUCT_UNAVAILABLE", error: "One or more products are unavailable." });
      }
      const products = new Map(productResult.rows.map(product => [String(product.id), product]));
      const currencies = new Set(productResult.rows.map(product => product.currency));
      if (currencies.size !== 1 || !CURRENCIES.has(productResult.rows[0].currency)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, code: "CURRENCY_MISMATCH", error: "Cart items must use the same supported currency." });
      }
      currency = productResult.rows[0].currency;
      totalMinor = 0;
      const items = [];
      for (const [id, quantity] of quantities) {
        const product = products.get(String(id));
        if (Number(product.stock_quantity) < quantity) {
          await client.query("ROLLBACK");
          return res.status(409).json({ success: false, code: "INSUFFICIENT_STOCK", error: "A product does not have enough stock." });
        }
        const unit = Number(product.price_minor);
        if (!Number.isSafeInteger(unit) || unit < 0 || !Number.isSafeInteger(unit * quantity)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, code: "PRICE_INVALID", error: "Product price is invalid." });
        }
        totalMinor += unit * quantity;
        if (!Number.isSafeInteger(totalMinor)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, code: "TOTAL_INVALID", error: "Cart total is invalid." });
        }
        items.push({ product, quantity, unit, line: unit * quantity });
      }
      if (totalMinor <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, code: "TOTAL_INVALID", error: "Order total must be greater than zero." });
      }
      txRef = "irhcf_" + crypto.randomUUID();
      const order = await client.query(
        "INSERT INTO commerce_orders (user_id, tx_ref, status, currency, total_minor, provider) VALUES ($1,$2,'pending',$3,$4,'flutterwave') RETURNING id",
        [req.user.id, txRef, currency, totalMinor]
      );
      orderId = order.rows[0].id;
      for (const item of items) {
        await client.query(
          "INSERT INTO commerce_order_items (order_id, product_id, product_name, quantity, unit_price_minor, line_total_minor) VALUES ($1,$2,$3,$4,$5,$6)",
          [orderId, item.product.id, item.product.name, item.quantity, item.unit, item.line]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      return res.status(500).json({ success: false, code: "ORDER_CREATE_FAILED", error: "Could not create the order." });
    } finally {
      client.release();
    }

    const customerEmail = String(req.user.email || req.body?.email || "").trim().slice(0, 254);
    const redirectUrl = String(env.FLW_REDIRECT_URL || "").trim();
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || !redirectUrl) {
      await pool.query("UPDATE commerce_orders SET status='failed', updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending'", [orderId]);
      return res.status(503).json({ success: false, code: "CHECKOUT_CONFIGURATION_INCOMPLETE", error: "A verified customer email and FLW_REDIRECT_URL are required for hosted checkout." });
    }
    try {
      const response = await fetchImpl("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.FLW_SECRET_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: toProviderAmount(totalMinor, currency),
          currency,
          redirect_url: redirectUrl,
          customer: { email: customerEmail },
          customizations: { title: "Nkwasibwe Market", description: "Order " + orderId },
          meta: { order_id: String(orderId), user_id: String(req.user.id) }
        })
      });
      const payload = await response.json();
      const checkoutUrl = payload?.data?.link;
      if (!response.ok || payload?.status !== "success" || typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
        await pool.query("UPDATE commerce_orders SET status='failed', updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending'", [orderId]);
        return res.status(502).json({ success: false, code: "CHECKOUT_PROVIDER_FAILED", error: "Payment provider did not create a valid hosted checkout." });
      }
      await pool.query("UPDATE commerce_orders SET checkout_url=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending'", [orderId, checkoutUrl]);
      return res.status(201).json({ success: true, orderId, txRef, currency, totalMinor, checkoutUrl, paymentStatus: "pending" });
    } catch (error) {
      await pool.query("UPDATE commerce_orders SET status='failed', updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending'", [orderId]);
      return res.status(502).json({ success: false, code: "CHECKOUT_PROVIDER_UNAVAILABLE", error: "Payment provider could not be reached. No payment has been confirmed." });
    }
  });

  router.post("/webhook/flutterwave", async (req, res) => {
    const receivedHash = req.get("verif-hash");
    if (!env.FLW_SECRET_HASH || !receivedHash || receivedHash.length !== env.FLW_SECRET_HASH.length ||
        !crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(env.FLW_SECRET_HASH))) {
      return res.status(401).json({ success: false, error: "Invalid webhook signature.", code: "WEBHOOK_SIGNATURE_INVALID" });
    }
    const transactionId = req.body?.data?.id;
    const txRef = String(req.body?.data?.tx_ref || "");
    if (!transactionId || !txRef || !env.FLW_SECRET_KEY) {
      return res.status(400).json({ success: false, error: "Webhook transaction details are incomplete.", code: "WEBHOOK_DATA_INVALID" });
    }
    try {
      const verifiedResponse = await fetchImpl("https://api.flutterwave.com/v3/transactions/" + encodeURIComponent(String(transactionId)) + "/verify", {
        headers: { Authorization: "Bearer " + env.FLW_SECRET_KEY }
      });
      const verified = await verifiedResponse.json();
      const data = verified?.data;
      if (!verifiedResponse.ok || verified?.status !== "success" || data?.status !== "successful" || String(data?.tx_ref) !== txRef) {
        return res.status(400).json({ success: false, error: "Payment could not be verified with the provider.", code: "PAYMENT_NOT_VERIFIED" });
      }
      const orderResult = await pool.query("SELECT id, status, currency, total_minor FROM commerce_orders WHERE tx_ref=$1", [txRef]);
      const order = orderResult.rows[0];
      if (!order) return res.status(404).json({ success: false, error: "Order not found.", code: "ORDER_NOT_FOUND" });
      if (order.status === "paid") return res.json({ success: true, duplicate: true });
      const verifiedAmount = fromProviderAmount(data.amount, data.currency);
      if (String(data.currency) !== order.currency || verifiedAmount !== Number(order.total_minor)) {
        return res.status(400).json({ success: false, error: "Payment amount or currency does not match the order.", code: "PAYMENT_MISMATCH" });
      }
      const updated = await pool.query(
        "UPDATE commerce_orders SET status='paid', provider_transaction_id=$2, paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending' RETURNING id",
        [order.id, String(transactionId)]
      );
      if (!updated.rows.length) return res.status(409).json({ success: false, error: "Order is no longer pending.", code: "ORDER_STATE_CONFLICT" });
      return res.json({ success: true, orderId: order.id, paymentStatus: "paid" });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not process payment notification.", code: "WEBHOOK_PROCESSING_FAILED" });
    }
  });

  return router;
}

module.exports = { MAX_ITEMS, MAX_QUANTITY, CURRENCIES, ensureCommerceSchema, createCommerceRouter, toProviderAmount, fromProviderAmount };
