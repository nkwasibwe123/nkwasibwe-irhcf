"use strict";

const express = require("express");
const crypto = require("node:crypto");

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;
const CURRENCIES = new Set(["RWF", "USD", "EUR", "GBP", "UGX", "KES", "TZS", "NGN", "ZAR"]);

async function ensureCommerceSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS commerce_sellers (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL CHECK (length(trim(shop_name)) BETWEEN 2 AND 120),
      description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 3000),
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      provider_refund_reference TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_sellers_status ON commerce_sellers(status, created_at DESC);
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
      category TEXT NOT NULL DEFAULT 'General' CHECK (length(trim(category)) BETWEEN 1 AND 80),
      requires_shipping BOOLEAN NOT NULL DEFAULT TRUE,
      seller_user_id INTEGER REFERENCES commerce_sellers(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE commerce_products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
    ALTER TABLE commerce_products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE commerce_products ADD COLUMN IF NOT EXISTS seller_user_id INTEGER REFERENCES commerce_sellers(user_id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_commerce_products_seller ON commerce_products(seller_user_id, active, id);
    CREATE INDEX IF NOT EXISTS idx_commerce_products_active ON commerce_products(active, id);
    CREATE TABLE IF NOT EXISTS commerce_wishlist_items (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_wishlist_user_created ON commerce_wishlist_items(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS commerce_product_reviews (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review_text TEXT NOT NULL DEFAULT '' CHECK (length(review_text) <= 2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_reviews_product_created ON commerce_product_reviews(product_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS commerce_coupons (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,40}
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      tx_ref TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded')),
      currency TEXT NOT NULL,
      total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
      subtotal_minor BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
      discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
      coupon_code TEXT,
      provider TEXT NOT NULL DEFAULT 'flutterwave',
      provider_transaction_id TEXT,
      checkout_url TEXT,
      shipping_address JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMPTZ
    );
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS subtotal_minor BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS discount_minor BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_commerce_orders_user_created ON commerce_orders(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS commerce_refund_requests (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 2000),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','refunded')),
      admin_note TEXT NOT NULL DEFAULT '',
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_refunds_status ON commerce_refund_requests(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_commerce_refunds_user ON commerce_refund_requests(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS commerce_addresses (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
      recipient_name TEXT NOT NULL CHECK (length(trim(recipient_name)) BETWEEN 1 AND 160),
      phone TEXT NOT NULL CHECK (length(trim(phone)) BETWEEN 3 AND 40),
      country TEXT NOT NULL CHECK (length(trim(country)) BETWEEN 2 AND 100),
      region TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL CHECK (length(trim(city)) BETWEEN 1 AND 120),
      address_line1 TEXT NOT NULL CHECK (length(trim(address_line1)) BETWEEN 1 AND 240),
      address_line2 TEXT NOT NULL DEFAULT '',
      postal_code TEXT NOT NULL DEFAULT '',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_commerce_addresses_user_default ON commerce_addresses(user_id, is_default DESC, updated_at DESC);
    CREATE TABLE IF NOT EXISTS commerce_order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES commerce_products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
      unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
      line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0),
      seller_user_id INTEGER REFERENCES commerce_sellers(user_id) ON DELETE SET NULL,
      fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending','processing','shipped','delivered','cancelled'))
    );
    ALTER TABLE commerce_order_items ADD COLUMN IF NOT EXISTS seller_user_id INTEGER REFERENCES commerce_sellers(user_id) ON DELETE SET NULL;
    ALTER TABLE commerce_order_items ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending';
    CREATE INDEX IF NOT EXISTS idx_commerce_order_items_seller ON commerce_order_items(seller_user_id, fulfillment_status, id);
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
function calculateCouponDiscount(coupon, subtotalMinor, currency) {
  if (!coupon) return { discountMinor: 0, error: null };
  if (coupon.currency !== currency) return { discountMinor: 0, error: "Coupon currency does not match the cart." };
  if (subtotalMinor < Number(coupon.min_subtotal_minor || 0)) return { discountMinor: 0, error: "The cart does not meet this coupon's minimum subtotal." };
  const value = Number(coupon.discount_value);
  if (!Number.isSafeInteger(value) || value <= 0) return { discountMinor: 0, error: "Coupon discount is invalid." };
  const discountMinor = coupon.discount_type === "percent" ? Math.floor(subtotalMinor * value / 100) : Math.min(subtotalMinor, value);
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0 || discountMinor >= subtotalMinor) return { discountMinor: 0, error: "Coupon must leave a positive order total." };
  return { discountMinor, error: null };
}

function createCommerceRouter({ pool, authenticateToken, fetchImpl = globalThis.fetch, env = process.env } = {}) {
  if (!pool || typeof pool.query !== "function") throw new Error("Commerce router requires a database pool.");
  if (typeof authenticateToken !== "function") throw new Error("Commerce router requires authentication middleware.");
  const router = express.Router();

  function isCommerceAdmin(req) {
    const allowed = String(env.COMMERCE_ADMIN_USER_IDS || "").split(",").map(value => value.trim()).filter(Boolean);
    return allowed.includes(String(req.user?.id ?? ""));
  }
  function requireCommerceAdmin(req, res, next) {
    if (!isCommerceAdmin(req)) return res.status(403).json({
      success: false,
      error: "Commerce administration is restricted to configured administrators.",
      code: "COMMERCE_ADMIN_REQUIRED"
    });
    next();
  }
  router.post("/coupons", authenticateToken, requireCommerceAdmin, async (req, res) => {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const description = String(req.body?.description || "").trim().slice(0, 500);
    const discountType = String(req.body?.discountType || "");
    const discountValue = safeInteger(req.body?.discountValue, 1, discountType === "percent" ? 90 : Number.MAX_SAFE_INTEGER);
    const currency = String(req.body?.currency || "RWF").toUpperCase();
    const minSubtotalMinor = safeInteger(req.body?.minSubtotalMinor ?? 0, 0, Number.MAX_SAFE_INTEGER);
    const parseDate = value => value ? new Date(value) : null;
    const startsAt = parseDate(req.body?.startsAt), expiresAt = parseDate(req.body?.expiresAt);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !["percent","fixed"].includes(discountType) || !discountValue || minSubtotalMinor === null || !CURRENCIES.has(currency) ||
        (startsAt && !Number.isFinite(startsAt.getTime())) || (expiresAt && !Number.isFinite(expiresAt.getTime())) ||
        (startsAt && expiresAt && expiresAt <= startsAt)) {
      return res.status(400).json({ success: false, error: "Provide a valid code, discount type/value, currency, minimum subtotal and valid date range.", code: "COUPON_INPUT_INVALID" });
    }
    try {
      const result = await pool.query("INSERT INTO commerce_coupons (code,description,discount_type,discount_value,currency,min_subtotal_minor,starts_at,expires_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,code,description,discount_type,discount_value,currency,min_subtotal_minor,active,starts_at,expires_at,redeemed_count", [code,description,discountType,discountValue,currency,minSubtotalMinor,startsAt,expiresAt,req.user.id]);
      return res.status(201).json({ success: true, coupon: result.rows[0] });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ success: false, error: "That coupon code already exists.", code: "COUPON_CODE_CONFLICT" });
      return res.status(500).json({ success: false, error: "Could not create coupon.", code: "COUPON_CREATE_FAILED" });
    }
  });

  router.get("/coupons", authenticateToken, requireCommerceAdmin, async (req, res) => {
    try {
      const result = await pool.query("SELECT id,code,description,discount_type,discount_value,currency,min_subtotal_minor,active,starts_at,expires_at,redeemed_count,created_at FROM commerce_coupons ORDER BY created_at DESC LIMIT 200");
      return res.json({ success: true, coupons: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load coupons.", code: "COUPONS_LOAD_FAILED" });
    }
  });

  router.patch("/coupons/:couponId", authenticateToken, requireCommerceAdmin, async (req, res) => {
    const couponId = safeInteger(req.params.couponId, 1, Number.MAX_SAFE_INTEGER);
    if (!couponId || typeof req.body?.active !== "boolean") return res.status(400).json({ success: false, error: "A coupon ID and active boolean are required.", code: "COUPON_INPUT_INVALID" });
    try {
      const result = await pool.query("UPDATE commerce_coupons SET active=$2 WHERE id=$1 RETURNING id,code,active,redeemed_count", [couponId,req.body.active]);
      if (!result.rows.length) return res.status(404).json({ success: false, error: "Coupon not found.", code: "COUPON_NOT_FOUND" });
      return res.json({ success: true, coupon: result.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not update coupon.", code: "COUPON_UPDATE_FAILED" });
    }
  });

  router.post("/quote", authenticateToken, async (req, res) => {
    const input = req.body?.items;
    if (!Array.isArray(input) || input.length < 1 || input.length > MAX_ITEMS) return res.status(400).json({ success: false, error: "Provide between 1 and 50 cart items.", code: "CART_INVALID" });
    const quantities = new Map();
    for (const item of input) {
      const id=safeInteger(item?.productId,1,Number.MAX_SAFE_INTEGER), quantity=safeInteger(item?.quantity,1,MAX_QUANTITY);
      if(!id||!quantity)return res.status(400).json({success:false,error:"Invalid cart item.",code:"CART_ITEM_INVALID"});
      quantities.set(id,(quantities.get(id)||0)+quantity);
      if(quantities.get(id)>MAX_QUANTITY)return res.status(400).json({success:false,error:"A product quantity cannot exceed 99.",code:"CART_QUANTITY_LIMIT"});
    }
    try {
      const products=await pool.query("SELECT p.id,p.price_minor,p.currency,p.stock_quantity FROM commerce_products p WHERE p.active=TRUE AND (p.seller_user_id IS NULL OR EXISTS (SELECT 1 FROM commerce_sellers s WHERE s.user_id=p.seller_user_id AND s.status='approved')) AND p.id=ANY($1::bigint[])",[[...quantities.keys()]]);
      if(products.rows.length!==quantities.size)return res.status(400).json({success:false,error:"One or more products are unavailable.",code:"PRODUCT_UNAVAILABLE"});
      const currencies=new Set(products.rows.map(row=>row.currency));
      if(currencies.size!==1||!CURRENCIES.has(products.rows[0].currency))return res.status(400).json({success:false,error:"Cart items must use the same supported currency.",code:"CURRENCY_MISMATCH"});
      const byId=new Map(products.rows.map(row=>[String(row.id),row]));let subtotalMinor=0;
      for(const [id,quantity] of quantities){const product=byId.get(String(id));const unit=Number(product.price_minor);if(Number(product.stock_quantity)<quantity)return res.status(409).json({success:false,error:"A product does not have enough stock.",code:"INSUFFICIENT_STOCK"});if(!Number.isSafeInteger(unit)||unit<0||!Number.isSafeInteger(unit*quantity))return res.status(400).json({success:false,error:"Product price is invalid.",code:"PRICE_INVALID"});subtotalMinor+=unit*quantity;if(!Number.isSafeInteger(subtotalMinor))return res.status(400).json({success:false,error:"Cart total is invalid.",code:"TOTAL_INVALID"});}
      if(subtotalMinor<=0)return res.status(400).json({success:false,error:"Order subtotal must be greater than zero.",code:"TOTAL_INVALID"});
      const currency=products.rows[0].currency;const couponCode=String(req.body?.couponCode||"").trim().toUpperCase().slice(0,40)||null;let discountMinor=0;
      if(couponCode){const couponResult=await pool.query("SELECT code,discount_type,discount_value,currency,min_subtotal_minor FROM commerce_coupons WHERE code=$1 AND active=TRUE AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) LIMIT 1",[couponCode]);if(!couponResult.rows.length)return res.status(400).json({success:false,error:"Coupon is invalid, inactive or expired.",code:"COUPON_INVALID"});const calculation=calculateCouponDiscount(couponResult.rows[0],subtotalMinor,currency);if(calculation.error)return res.status(400).json({success:false,error:calculation.error,code:"COUPON_NOT_APPLICABLE"});discountMinor=calculation.discountMinor;}
      return res.json({success:true,currency,subtotalMinor,discountMinor,totalMinor:subtotalMinor-discountMinor,couponCode});
    } catch(error){return res.status(500).json({success:false,error:"Could not calculate cart quote.",code:"QUOTE_FAILED"});}
  });

  async function requireProductManager(req, res, next) {
    if (isCommerceAdmin(req)) return next();
    try {
      const result = await pool.query("SELECT status FROM commerce_sellers WHERE user_id=$1 LIMIT 1", [req.user.id]);
      if (result.rows[0]?.status !== "approved") return res.status(403).json({
        success: false,
        error: "Apply to become a seller and wait for approval before managing products.",
        code: "APPROVED_SELLER_REQUIRED"
      });
      return next();
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not verify seller access.", code: "SELLER_ACCESS_CHECK_FAILED" });
    }
  }

  router.get("/seller/profile", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query("SELECT user_id, shop_name, description, contact_email, contact_phone, status, created_at, updated_at FROM commerce_sellers WHERE user_id=$1 LIMIT 1", [req.user.id]);
      return res.json({ success: true, seller: result.rows[0] || null });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load seller profile.", code: "SELLER_PROFILE_LOAD_FAILED" });
    }
  });

  router.post("/seller/apply", authenticateToken, async (req, res) => {
    const shopName = String(req.body?.shopName || "").trim().slice(0, 120);
    const description = String(req.body?.description || "").trim().slice(0, 3000);
    const contactEmail = String(req.body?.contactEmail || req.user.email || "").trim().slice(0, 254);
    const contactPhone = String(req.body?.contactPhone || "").trim().slice(0, 40);
    if (shopName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactPhone.length < 3) {
      return res.status(400).json({ success: false, error: "Shop name, valid contact email and phone are required.", code: "SELLER_APPLICATION_INVALID" });
    }
    try {
      const result = await pool.query(
        "INSERT INTO commerce_sellers (user_id,shop_name,description,contact_email,contact_phone,status) VALUES ($1,$2,$3,$4,$5,'pending') ON CONFLICT (user_id) DO UPDATE SET shop_name=EXCLUDED.shop_name,description=EXCLUDED.description,contact_email=EXCLUDED.contact_email,contact_phone=EXCLUDED.contact_phone,status=CASE WHEN commerce_sellers.status='approved' THEN 'approved' ELSE 'pending' END,updated_at=CURRENT_TIMESTAMP RETURNING user_id,shop_name,description,contact_email,contact_phone,status,created_at,updated_at",
        [req.user.id,shopName,description,contactEmail,contactPhone]
      );
      return res.status(201).json({ success: true, seller: result.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not submit seller application.", code: "SELLER_APPLICATION_FAILED" });
    }
  });

  router.get("/seller/applications", authenticateToken, requireCommerceAdmin, async (req, res) => {
    try {
      const result = await pool.query("SELECT user_id,shop_name,description,contact_email,contact_phone,status,created_at FROM commerce_sellers ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 200");
      return res.json({ success: true, applications: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load seller applications.", code: "SELLER_APPLICATIONS_LOAD_FAILED" });
    }
  });

  router.patch("/seller/applications/:userId", authenticateToken, requireCommerceAdmin, async (req, res) => {
    const userId = safeInteger(req.params.userId, 1, Number.MAX_SAFE_INTEGER);
    const status = String(req.body?.status || "");
    if (!userId || !["approved","rejected","suspended"].includes(status)) return res.status(400).json({ success: false, error: "A valid seller ID and status are required.", code: "SELLER_REVIEW_INPUT_INVALID" });
    try {
      const result = await pool.query("UPDATE commerce_sellers SET status=$2,reviewed_by=$3,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 RETURNING user_id,shop_name,status,reviewed_at", [userId,status,req.user.id]);
      if (!result.rows.length) return res.status(404).json({ success: false, error: "Seller application not found.", code: "SELLER_NOT_FOUND" });
      return res.json({ success: true, seller: result.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not review seller application.", code: "SELLER_REVIEW_FAILED" });
    }
  });

  router.get("/seller/products", authenticateToken, async (req, res) => {
    try {
      const seller = await pool.query("SELECT status FROM commerce_sellers WHERE user_id=$1 LIMIT 1", [req.user.id]);
      if (seller.rows[0]?.status !== "approved" && !isCommerceAdmin(req)) return res.status(403).json({ success: false, error: "Only approved sellers can manage seller products.", code: "APPROVED_SELLER_REQUIRED" });
      const result = await pool.query("SELECT id,name,description,sku,price_minor,currency,stock_quantity,image_url,category,requires_shipping,active,created_at,updated_at FROM commerce_products WHERE seller_user_id=$1 ORDER BY created_at DESC LIMIT 200", [req.user.id]);
      return res.json({ success: true, products: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load seller products.", code: "SELLER_PRODUCTS_LOAD_FAILED" });
    }
  });

  router.get("/seller/orders", authenticateToken, async (req, res) => {
    try {
      const seller = await pool.query("SELECT status FROM commerce_sellers WHERE user_id=$1 LIMIT 1", [req.user.id]);
      if (seller.rows[0]?.status !== "approved") return res.status(403).json({ success: false, error: "Only approved sellers can view seller orders.", code: "APPROVED_SELLER_REQUIRED" });
      const result = await pool.query("SELECT oi.id AS item_id, o.id AS order_id, o.status AS payment_status, o.paid_at, o.currency, oi.product_name, oi.quantity, oi.line_total_minor, oi.fulfillment_status, o.shipping_address FROM commerce_order_items oi JOIN commerce_orders o ON o.id=oi.order_id WHERE oi.seller_user_id=$1 AND o.status='paid' ORDER BY o.paid_at DESC LIMIT 200", [req.user.id]);
      return res.json({ success: true, orders: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load seller orders.", code: "SELLER_ORDERS_LOAD_FAILED" });
    }
  });

  router.patch("/seller/order-items/:itemId/fulfillment", authenticateToken, async (req, res) => {
    const itemId = safeInteger(req.params.itemId, 1, Number.MAX_SAFE_INTEGER);
    const nextStatus = String(req.body?.status || "");
    if (!itemId || !["processing","shipped","delivered","cancelled"].includes(nextStatus)) return res.status(400).json({ success: false, error: "A valid item ID and fulfillment status are required.", code: "FULFILLMENT_INPUT_INVALID" });
    try {
      const seller = await pool.query("SELECT status FROM commerce_sellers WHERE user_id=$1 LIMIT 1", [req.user.id]);
      if (seller.rows[0]?.status !== "approved") return res.status(403).json({ success: false, error: "Only approved sellers can update fulfillment.", code: "APPROVED_SELLER_REQUIRED" });
      const item = await pool.query("SELECT oi.fulfillment_status, o.status AS payment_status FROM commerce_order_items oi JOIN commerce_orders o ON o.id=oi.order_id WHERE oi.id=$1 AND oi.seller_user_id=$2 LIMIT 1", [itemId,req.user.id]);
      if (!item.rows.length) return res.status(404).json({ success: false, error: "Seller order item not found.", code: "SELLER_ORDER_ITEM_NOT_FOUND" });
      if (item.rows[0].payment_status !== "paid") return res.status(409).json({ success: false, error: "Only paid orders can be fulfilled.", code: "ORDER_NOT_PAID" });
      const current = item.rows[0].fulfillment_status;
      const allowed = ({ pending:["processing","cancelled"], processing:["shipped","cancelled"], shipped:["delivered"], delivered:[], cancelled:[] })[current] || [];
      if (!allowed.includes(nextStatus)) return res.status(409).json({ success: false, error: "That fulfillment status transition is not allowed.", code: "FULFILLMENT_TRANSITION_INVALID" });
      const updated = await pool.query("UPDATE commerce_order_items SET fulfillment_status=$2 WHERE id=$1 AND seller_user_id=$3 RETURNING id,fulfillment_status", [itemId,nextStatus,req.user.id]);
      return res.json({ success: true, item: updated.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not update fulfillment.", code: "FULFILLMENT_UPDATE_FAILED" });
    }
  });

  router.post("/products", authenticateToken, requireProductManager, async (req, res) => {
    const name = String(req.body?.name || "").trim().slice(0, 180);
    const description = String(req.body?.description || "").trim().slice(0, 5000);
    const sku = req.body?.sku == null ? null : String(req.body.sku).trim().slice(0, 80);
    const priceMinor = safeInteger(req.body?.priceMinor, 1, Number.MAX_SAFE_INTEGER);
    const stockQuantity = safeInteger(req.body?.stockQuantity ?? 0, 0, 1000000);
    const currency = String(req.body?.currency || "RWF").toUpperCase();
    const imageUrl = req.body?.imageUrl == null || req.body.imageUrl === "" ? null : String(req.body.imageUrl).trim();
    const category = String(req.body?.category || "General").trim().slice(0, 80) || "General";
    const requiresShipping = req.body?.requiresShipping !== false;
    const sellerUserId = isCommerceAdmin(req) ? null : req.user.id;
    if (!name || !priceMinor || stockQuantity === null || !CURRENCIES.has(currency)) {
      return res.status(400).json({ success: false, error: "Name, positive priceMinor, supported currency and valid stockQuantity are required.", code: "PRODUCT_INPUT_INVALID" });
    }
    if (imageUrl) {
      try { if (new URL(imageUrl).protocol !== "https:") throw new Error("HTTPS required"); }
      catch { return res.status(400).json({ success: false, error: "Product image URL must use HTTPS.", code: "PRODUCT_IMAGE_URL_INVALID" }); }
    }
    try {
      const result = await pool.query(
        "INSERT INTO commerce_products (name, description, sku, price_minor, currency, stock_quantity, image_url, category, requires_shipping, seller_user_id, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE) RETURNING id, name, description, sku, price_minor, currency, stock_quantity, image_url, category, requires_shipping, seller_user_id, active, created_at",
        [name, description, sku || null, priceMinor, currency, stockQuantity, imageUrl, category, requiresShipping, sellerUserId]
      );
      return res.status(201).json({ success: true, product: result.rows[0] });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ success: false, error: "That SKU is already in use.", code: "PRODUCT_SKU_CONFLICT" });
      return res.status(500).json({ success: false, error: "Could not create product.", code: "PRODUCT_CREATE_FAILED" });
    }
  });

  router.patch("/products/:productId", authenticateToken, requireProductManager, async (req, res) => {
    const productId = safeInteger(req.params.productId, 1, Number.MAX_SAFE_INTEGER);
    if (!productId) return res.status(400).json({ success: false, error: "Invalid product ID.", code: "PRODUCT_ID_INVALID" });
    const fields = [];
    const values = [];
    const body = req.body || {};
    const add = (column, value) => { values.push(value); fields.push(column + "=$" + values.length); };
    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const value = String(body.name || "").trim().slice(0, 180);
      if (!value) return res.status(400).json({ success: false, error: "Product name cannot be empty.", code: "PRODUCT_INPUT_INVALID" });
      add("name", value);
    }
    if (Object.prototype.hasOwnProperty.call(body, "description")) add("description", String(body.description || "").trim().slice(0, 5000));
    if (Object.prototype.hasOwnProperty.call(body, "category")) {
      const value = String(body.category || "").trim().slice(0, 80);
      if (!value) return res.status(400).json({ success: false, error: "Category cannot be empty.", code: "PRODUCT_INPUT_INVALID" });
      add("category", value);
    }
    if (Object.prototype.hasOwnProperty.call(body, "requiresShipping")) {
      if (typeof body.requiresShipping !== "boolean") return res.status(400).json({ success: false, error: "requiresShipping must be true or false.", code: "PRODUCT_INPUT_INVALID" });
      add("requires_shipping", body.requiresShipping);
    }
    if (Object.prototype.hasOwnProperty.call(body, "sku")) add("sku", body.sku == null || body.sku === "" ? null : String(body.sku).trim().slice(0, 80));
    if (Object.prototype.hasOwnProperty.call(body, "priceMinor")) {
      const value = safeInteger(body.priceMinor, 1, Number.MAX_SAFE_INTEGER);
      if (!value) return res.status(400).json({ success: false, error: "Price must be a positive integer in minor units.", code: "PRODUCT_INPUT_INVALID" });
      add("price_minor", value);
    }
    if (Object.prototype.hasOwnProperty.call(body, "currency")) {
      const value = String(body.currency).toUpperCase();
      if (!CURRENCIES.has(value)) return res.status(400).json({ success: false, error: "Unsupported currency.", code: "PRODUCT_INPUT_INVALID" });
      add("currency", value);
    }
    if (Object.prototype.hasOwnProperty.call(body, "stockQuantity")) {
      const value = safeInteger(body.stockQuantity, 0, 1000000);
      if (value === null) return res.status(400).json({ success: false, error: "Stock quantity must be a non-negative integer.", code: "PRODUCT_INPUT_INVALID" });
      add("stock_quantity", value);
    }
    if (Object.prototype.hasOwnProperty.call(body, "active")) {
      if (typeof body.active !== "boolean") return res.status(400).json({ success: false, error: "Active must be true or false.", code: "PRODUCT_INPUT_INVALID" });
      add("active", body.active);
    }
    if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) {
      let value = body.imageUrl == null || body.imageUrl === "" ? null : String(body.imageUrl).trim();
      if (value) {
        try { if (new URL(value).protocol !== "https:") throw new Error("HTTPS required"); }
        catch { return res.status(400).json({ success: false, error: "Product image URL must use HTTPS.", code: "PRODUCT_IMAGE_URL_INVALID" }); }
      }
      add("image_url", value);
    }
    if (!fields.length) return res.status(400).json({ success: false, error: "No editable product fields were provided.", code: "PRODUCT_UPDATE_EMPTY" });
    values.push(productId);
    const productIdParam = values.length;
    values.push(isCommerceAdmin(req), req.user.id);
    const adminParam = values.length - 1;
    const userIdParam = values.length;
    try {
      const result = await pool.query(
        "UPDATE commerce_products SET " + fields.join(", ") + ", updated_at=CURRENT_TIMESTAMP WHERE id=$" + productIdParam + " AND ($" + adminParam + "::boolean OR seller_user_id=$" + userIdParam + ") RETURNING id, name, description, sku, price_minor, currency, stock_quantity, image_url, category, requires_shipping, seller_user_id, active, updated_at",
        values
      );
      if (!result.rows.length) return res.status(404).json({ success: false, error: "Product not found.", code: "PRODUCT_NOT_FOUND" });
      return res.json({ success: true, product: result.rows[0] });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ success: false, error: "That SKU is already in use.", code: "PRODUCT_SKU_CONFLICT" });
      return res.status(500).json({ success: false, error: "Could not update product.", code: "PRODUCT_UPDATE_FAILED" });
    }
  });

  router.get("/products", async (req, res) => {
    try {
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
      const search = String(req.query.q || "").trim().slice(0, 120);
      const category = String(req.query.category || "").trim().slice(0, 80);
      const sort = String(req.query.sort || "newest");
      const orderBy = ({ newest: "p.id DESC", price_asc: "p.price_minor ASC, p.id DESC", price_desc: "p.price_minor DESC, p.id DESC", name_asc: "p.name ASC, p.id DESC", rating: "rating_average DESC, p.id DESC" })[sort] || "p.id DESC";
      const result = await pool.query(
        "SELECT p.id, p.name, p.description, p.sku, p.price_minor, p.currency, p.stock_quantity, p.image_url, p.category, p.requires_shipping, COALESCE(s.shop_name, 'Nkwasibwe Market') AS seller_name, COALESCE(rv.rating_average, 0) AS rating_average, COALESCE(rv.review_count, 0) AS review_count FROM commerce_products p LEFT JOIN commerce_sellers s ON s.user_id=p.seller_user_id AND s.status='approved' LEFT JOIN (SELECT product_id, ROUND(AVG(rating)::numeric, 1) AS rating_average, COUNT(*)::int AS review_count FROM commerce_product_reviews GROUP BY product_id) rv ON rv.product_id=p.id WHERE p.active=TRUE AND (p.seller_user_id IS NULL OR s.user_id IS NOT NULL) AND ($1='' OR p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%' OR p.sku ILIKE '%' || $1 || '%') AND ($2='' OR p.category=$2) ORDER BY " + orderBy + " LIMIT $3",
        [search, category, limit]
      );
      const categories = await pool.query("SELECT DISTINCT category FROM commerce_products WHERE active=TRUE ORDER BY category LIMIT 100");
      return res.json({ success: true, products: result.rows, categories: categories.rows.map(row => row.category) });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load products.", code: "PRODUCTS_LOAD_FAILED" });
    }
  });

  router.get("/products/:productId/reviews", async (req, res) => {
    const productId = safeInteger(req.params.productId, 1, Number.MAX_SAFE_INTEGER);
    if (!productId) return res.status(400).json({ success: false, error: "Invalid product ID.", code: "PRODUCT_ID_INVALID" });
    try {
      const result = await pool.query("SELECT rating, review_text, created_at FROM commerce_product_reviews WHERE product_id=$1 ORDER BY created_at DESC LIMIT 100", [productId]);
      return res.json({ success: true, reviews: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load reviews.", code: "REVIEWS_LOAD_FAILED" });
    }
  });

  router.post("/products/:productId/reviews", authenticateToken, async (req, res) => {
    const productId = safeInteger(req.params.productId, 1, Number.MAX_SAFE_INTEGER);
    const rating = safeInteger(req.body?.rating, 1, 5);
    const reviewText = String(req.body?.reviewText || "").trim().slice(0, 2000);
    if (!productId || !rating) return res.status(400).json({ success: false, error: "A product ID and rating from 1 to 5 are required.", code: "REVIEW_INPUT_INVALID" });
    try {
      const purchased = await pool.query("SELECT 1 FROM commerce_orders o JOIN commerce_order_items oi ON oi.order_id=o.id WHERE o.user_id=$1 AND oi.product_id=$2 AND o.status='paid' LIMIT 1", [req.user.id, productId]);
      if (!purchased.rows.length) return res.status(403).json({ success: false, error: "Reviews are available only after this account has paid for the product.", code: "REVIEW_PURCHASE_REQUIRED" });
      const result = await pool.query("INSERT INTO commerce_product_reviews (user_id, product_id, rating, review_text) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, product_id) DO UPDATE SET rating=EXCLUDED.rating, review_text=EXCLUDED.review_text, updated_at=CURRENT_TIMESTAMP RETURNING rating, review_text, created_at, updated_at", [req.user.id, productId, rating, reviewText]);
      return res.status(201).json({ success: true, review: result.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not save review.", code: "REVIEW_SAVE_FAILED" });
    }
  });

  router.get("/wishlist", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query("SELECT p.id, p.name, p.description, p.price_minor, p.currency, p.stock_quantity, p.image_url, p.category, p.requires_shipping, w.created_at AS saved_at FROM commerce_wishlist_items w JOIN commerce_products p ON p.id=w.product_id WHERE w.user_id=$1 AND p.active=TRUE ORDER BY w.created_at DESC", [req.user.id]);
      return res.json({ success: true, products: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load wishlist.", code: "WISHLIST_LOAD_FAILED" });
    }
  });

  router.put("/wishlist/:productId", authenticateToken, async (req, res) => {
    const productId = safeInteger(req.params.productId, 1, Number.MAX_SAFE_INTEGER);
    if (!productId || typeof req.body?.saved !== "boolean") return res.status(400).json({ success: false, error: "A valid product ID and saved boolean are required.", code: "WISHLIST_INPUT_INVALID" });
    try {
      if (req.body.saved) {
        const product = await pool.query("SELECT id FROM commerce_products WHERE id=$1 AND active=TRUE", [productId]);
        if (!product.rows.length) return res.status(404).json({ success: false, error: "Product not found.", code: "PRODUCT_NOT_FOUND" });
        await pool.query("INSERT INTO commerce_wishlist_items (user_id, product_id) VALUES ($1,$2) ON CONFLICT (user_id, product_id) DO NOTHING", [req.user.id, productId]);
      } else {
        await pool.query("DELETE FROM commerce_wishlist_items WHERE user_id=$1 AND product_id=$2", [req.user.id, productId]);
      }
      return res.json({ success: true, saved: req.body.saved });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not update wishlist.", code: "WISHLIST_UPDATE_FAILED" });
    }
  });

  router.get("/addresses", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query("SELECT id, label, recipient_name, phone, country, region, city, address_line1, address_line2, postal_code, is_default, created_at, updated_at FROM commerce_addresses WHERE user_id=$1 ORDER BY is_default DESC, updated_at DESC", [req.user.id]);
      return res.json({ success: true, addresses: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load addresses.", code: "ADDRESSES_LOAD_FAILED" });
    }
  });

  router.post("/addresses", authenticateToken, async (req, res) => {
    const body = req.body || {};
    const address = {
      label: String(body.label || "").trim().slice(0, 80),
      recipientName: String(body.recipientName || "").trim().slice(0, 160),
      phone: String(body.phone || "").trim().slice(0, 40),
      country: String(body.country || "").trim().slice(0, 100),
      region: String(body.region || "").trim().slice(0, 120),
      city: String(body.city || "").trim().slice(0, 120),
      addressLine1: String(body.addressLine1 || "").trim().slice(0, 240),
      addressLine2: String(body.addressLine2 || "").trim().slice(0, 240),
      postalCode: String(body.postalCode || "").trim().slice(0, 40),
      isDefault: body.isDefault === true
    };
    if (!address.label || !address.recipientName || address.phone.length < 3 || address.country.length < 2 || !address.city || !address.addressLine1) {
      return res.status(400).json({ success: false, error: "Label, recipient, phone, country, city and first address line are required.", code: "ADDRESS_INPUT_INVALID" });
    }
    try {
      const result = await pool.query(
        "WITH reset AS (UPDATE commerce_addresses SET is_default=FALSE, updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND $11::boolean RETURNING id) INSERT INTO commerce_addresses (user_id,label,recipient_name,phone,country,region,city,address_line1,address_line2,postal_code,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,label,recipient_name,phone,country,region,city,address_line1,address_line2,postal_code,is_default,created_at,updated_at",
        [req.user.id,address.label,address.recipientName,address.phone,address.country,address.region,address.city,address.addressLine1,address.addressLine2,address.postalCode,address.isDefault]
      );
      return res.status(201).json({ success: true, address: result.rows[0] });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not save address.", code: "ADDRESS_SAVE_FAILED" });
    }
  });

  router.put("/addresses/:addressId/default", authenticateToken, async (req, res) => {
    const addressId = safeInteger(req.params.addressId, 1, Number.MAX_SAFE_INTEGER);
    if (!addressId) return res.status(400).json({ success: false, error: "Invalid address ID.", code: "ADDRESS_ID_INVALID" });
    const client = typeof pool.connect === "function" ? await pool.connect() : null;
    if (!client) return res.status(503).json({ success: false, error: "Address update requires transaction support.", code: "ADDRESS_TRANSACTION_UNAVAILABLE" });
    try {
      await client.query("BEGIN");
      const owned = await client.query("SELECT id FROM commerce_addresses WHERE id=$1 AND user_id=$2 FOR UPDATE", [addressId, req.user.id]);
      if (!owned.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ success: false, error: "Address not found.", code: "ADDRESS_NOT_FOUND" }); }
      await client.query("UPDATE commerce_addresses SET is_default=FALSE,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1", [req.user.id]);
      await client.query("UPDATE commerce_addresses SET is_default=TRUE,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2", [addressId, req.user.id]);
      await client.query("COMMIT");
      return res.json({ success: true, defaultAddressId: addressId });
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      return res.status(500).json({ success: false, error: "Could not set default address.", code: "ADDRESS_DEFAULT_FAILED" });
    } finally { client.release(); }
  });

  router.delete("/addresses/:addressId", authenticateToken, async (req, res) => {
    const addressId = safeInteger(req.params.addressId, 1, Number.MAX_SAFE_INTEGER);
    if (!addressId) return res.status(400).json({ success: false, error: "Invalid address ID.", code: "ADDRESS_ID_INVALID" });
    try {
      const result = await pool.query("DELETE FROM commerce_addresses WHERE id=$1 AND user_id=$2 RETURNING id", [addressId, req.user.id]);
      if (!result.rows.length) return res.status(404).json({ success: false, error: "Address not found.", code: "ADDRESS_NOT_FOUND" });
      return res.json({ success: true, deleted: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not delete address.", code: "ADDRESS_DELETE_FAILED" });
    }
  });

  router.get("/cart", authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT p.id AS product_id, p.name, p.description, p.price_minor, p.currency, p.stock_quantity, p.image_url, p.requires_shipping, c.quantity, (p.price_minor * c.quantity) AS line_total_minor FROM commerce_cart_items c JOIN commerce_products p ON p.id=c.product_id WHERE c.user_id=$1 AND p.active=TRUE ORDER BY c.updated_at DESC",
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
        "SELECT id, tx_ref, status, currency, total_minor, subtotal_minor, discount_minor, coupon_code, provider, checkout_url, shipping_address, created_at, updated_at, paid_at FROM commerce_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
        [req.user.id]
      );
      return res.json({ success: true, orders: result.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load orders.", code: "ORDERS_LOAD_FAILED" });
    }
  });

  router.get("/orders/:orderId", authenticateToken, async (req, res) => {
    const orderId = safeInteger(req.params.orderId, 1, Number.MAX_SAFE_INTEGER);
    if (!orderId) return res.status(400).json({ success: false, error: "Invalid order ID.", code: "ORDER_ID_INVALID" });
    try {
      const result = await pool.query("SELECT id, tx_ref, status, currency, total_minor, subtotal_minor, discount_minor, coupon_code, provider, provider_transaction_id, checkout_url, shipping_address, created_at, updated_at, paid_at FROM commerce_orders WHERE id=$1 AND user_id=$2 LIMIT 1", [orderId, req.user.id]);
      if (!result.rows.length) return res.status(404).json({ success: false, error: "Order not found.", code: "ORDER_NOT_FOUND" });
      const items = await pool.query("SELECT product_id, product_name, quantity, unit_price_minor, line_total_minor, fulfillment_status FROM commerce_order_items WHERE order_id=$1 ORDER BY id", [orderId]);
      return res.json({ success: true, order: result.rows[0], items: items.rows });
    } catch (error) {
      return res.status(500).json({ success: false, error: "Could not load order details.", code: "ORDER_DETAILS_FAILED" });
    }
  });

  router.post("/orders/:orderId/refund-request", authenticateToken, async (req, res) => {
    const orderId=safeInteger(req.params.orderId,1,Number.MAX_SAFE_INTEGER);
    const reason=String(req.body?.reason||"").trim().slice(0,2000);
    if(!orderId||reason.length<5)return res.status(400).json({success:false,error:"Provide an order ID and a refund/return reason of at least 5 characters.",code:"REFUND_REQUEST_INVALID"});
    try{
      const order=await pool.query("SELECT id,status FROM commerce_orders WHERE id=$1 AND user_id=$2 LIMIT 1",[orderId,req.user.id]);
      if(!order.rows.length)return res.status(404).json({success:false,error:"Order not found.",code:"ORDER_NOT_FOUND"});
      if(order.rows[0].status!=="paid")return res.status(409).json({success:false,error:"Only paid orders can request a refund or return.",code:"ORDER_NOT_PAID"});
      const result=await pool.query("INSERT INTO commerce_refund_requests (order_id,user_id,reason) VALUES ($1,$2,$3) RETURNING id,order_id,reason,status,created_at",[orderId,req.user.id,reason]);
      return res.status(201).json({success:true,refundRequest:result.rows[0]});
    }catch(error){if(error?.code==="23505")return res.status(409).json({success:false,error:"A refund/return request already exists for this order.",code:"REFUND_REQUEST_EXISTS"});return res.status(500).json({success:false,error:"Could not submit refund request.",code:"REFUND_REQUEST_FAILED"});}
  });

  router.get("/orders/:orderId/refund-request", authenticateToken, async (req, res) => {
    const orderId=safeInteger(req.params.orderId,1,Number.MAX_SAFE_INTEGER);
    if(!orderId)return res.status(400).json({success:false,error:"Invalid order ID.",code:"ORDER_ID_INVALID"});
    try{
      const owned=await pool.query("SELECT id FROM commerce_orders WHERE id=$1 AND user_id=$2 LIMIT 1",[orderId,req.user.id]);
      if(!owned.rows.length)return res.status(404).json({success:false,error:"Order not found.",code:"ORDER_NOT_FOUND"});
      const result=await pool.query("SELECT id,order_id,reason,status,admin_note,provider_refund_reference,created_at,updated_at,reviewed_at FROM commerce_refund_requests WHERE order_id=$1 AND user_id=$2 LIMIT 1",[orderId,req.user.id]);
      return res.json({success:true,refundRequest:result.rows[0]||null});
    }catch(error){return res.status(500).json({success:false,error:"Could not load refund request.",code:"REFUND_REQUEST_LOAD_FAILED"});}
  });

  router.get("/refund-requests", authenticateToken, requireCommerceAdmin, async (req, res) => {
    try{
      const result=await pool.query("SELECT r.id,r.order_id,r.user_id,r.reason,r.status,r.admin_note,r.provider_refund_reference,r.created_at,r.updated_at,r.reviewed_at,o.currency,o.total_minor FROM commerce_refund_requests r JOIN commerce_orders o ON o.id=r.order_id ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 200");
      return res.json({success:true,refundRequests:result.rows});
    }catch(error){return res.status(500).json({success:false,error:"Could not load refund requests.",code:"REFUND_REQUESTS_LOAD_FAILED"});}
  });

  router.patch("/refund-requests/:requestId", authenticateToken, requireCommerceAdmin, async (req, res) => {
    const requestId=safeInteger(req.params.requestId,1,Number.MAX_SAFE_INTEGER);
    const status=String(req.body?.status||"");
    const adminNote=String(req.body?.adminNote||"").trim().slice(0,2000);
    const providerReference=String(req.body?.providerRefundReference||"").trim().slice(0,200);
    if(!requestId||!["approved","rejected","refunded"].includes(status)||(status==="refunded"&&!providerReference))return res.status(400).json({success:false,error:"Provide a valid request status; refunded requires the external provider refund reference.",code:"REFUND_REVIEW_INVALID"});
    try{
      const current=await pool.query("SELECT id,order_id,status FROM commerce_refund_requests WHERE id=$1 LIMIT 1",[requestId]);
      if(!current.rows.length)return res.status(404).json({success:false,error:"Refund request not found.",code:"REFUND_REQUEST_NOT_FOUND"});
      const allowed= current.rows[0].status==="pending"?["approved","rejected"]:current.rows[0].status==="approved"?["refunded"]:[];
      if(!allowed.includes(status))return res.status(409).json({success:false,error:"That refund request status transition is not allowed.",code:"REFUND_TRANSITION_INVALID"});
      const updated=await pool.query("UPDATE commerce_refund_requests SET status=$2,admin_note=$3,provider_refund_reference=$4,reviewed_by=$5,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id,order_id,status,admin_note,provider_refund_reference,reviewed_at",[requestId,status,adminNote,providerReference||null,req.user.id]);
      if(status==="refunded")await pool.query("UPDATE commerce_orders SET status='refunded',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='paid'",[current.rows[0].order_id]);
      return res.json({success:true,refundRequest:updated.rows[0]});
    }catch(error){return res.status(500).json({success:false,error:"Could not review refund request.",code:"REFUND_REVIEW_FAILED"});}
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
    let subtotalMinor;
    let discountMinor = 0;
    let couponCode = String(req.body?.couponCode || "").trim().toUpperCase().slice(0, 40) || null;
    let currency;
    try {
      await client.query("BEGIN");
      const ids = [...quantities.keys()];
      const productResult = await client.query(
        "SELECT p.id, p.name, p.price_minor, p.currency, p.stock_quantity, p.requires_shipping, p.seller_user_id FROM commerce_products p WHERE p.active = TRUE AND (p.seller_user_id IS NULL OR EXISTS (SELECT 1 FROM commerce_sellers s WHERE s.user_id=p.seller_user_id AND s.status='approved')) AND p.id = ANY($1::bigint[]) FOR UPDATE",
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
      const requiresShipping = productResult.rows.some(product => product.requires_shipping !== false);
      let shippingAddress = null;
      if (requiresShipping) {
        const addressId = safeInteger(req.body?.addressId, 1, Number.MAX_SAFE_INTEGER);
        if (!addressId) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, code: "SHIPPING_ADDRESS_REQUIRED", error: "Select a saved shipping address before checkout." });
        }
        const addressResult = await client.query("SELECT label, recipient_name, phone, country, region, city, address_line1, address_line2, postal_code FROM commerce_addresses WHERE id=$1 AND user_id=$2", [addressId, req.user.id]);
        if (!addressResult.rows.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, code: "SHIPPING_ADDRESS_NOT_FOUND", error: "The selected shipping address does not belong to this account." });
        }
        shippingAddress = addressResult.rows[0];
      }
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
      subtotalMinor = totalMinor;
      if (subtotalMinor <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, code: "TOTAL_INVALID", error: "Order subtotal must be greater than zero." });
      }
      if (couponCode) {
        const couponResult = await client.query("SELECT id,code,discount_type,discount_value,currency,min_subtotal_minor FROM commerce_coupons WHERE code=$1 AND active=TRUE AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) FOR UPDATE", [couponCode]);
        if (!couponResult.rows.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, code: "COUPON_INVALID", error: "Coupon is invalid, inactive or expired." });
        }
        const calculation = calculateCouponDiscount(couponResult.rows[0], subtotalMinor, currency);
        if (calculation.error) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, code: "COUPON_NOT_APPLICABLE", error: calculation.error });
        }
        discountMinor = calculation.discountMinor;
      }
      totalMinor = subtotalMinor - discountMinor;
      if (totalMinor <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, code: "TOTAL_INVALID", error: "Discounted order total must be greater than zero." });
      }
      txRef = "irhcf_" + crypto.randomUUID();
      const order = await client.query(
        "INSERT INTO commerce_orders (user_id, tx_ref, status, currency, total_minor, subtotal_minor, discount_minor, coupon_code, provider, shipping_address) VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,'flutterwave',$8::jsonb) RETURNING id",
        [req.user.id, txRef, currency, totalMinor, subtotalMinor, discountMinor, couponCode, shippingAddress ? JSON.stringify(shippingAddress) : null]
      );
      orderId = order.rows[0].id;
      for (const item of items) {
        await client.query(
          "INSERT INTO commerce_order_items (order_id, product_id, product_name, quantity, unit_price_minor, line_total_minor, seller_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [orderId, item.product.id, item.product.name, item.quantity, item.unit, item.line, item.product.seller_user_id || null]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      return res.status(500).json({ success: false, code: "ORDER_CREATE_FAILED", error: "Could not create the order." });
    } finally {
      client.release();
    }

    // Payment identity is taken only from the authenticated account. A browser-supplied
    // email must never redirect a charge/receipt to a different account identity.
    const customerEmail = String(req.user.email || "").trim().slice(0, 254);
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
      return res.status(201).json({ success: true, orderId, txRef, currency, subtotalMinor, discountMinor, totalMinor, couponCode, checkoutUrl, paymentStatus: "pending" });
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
      const orderResult = await pool.query("SELECT id, status, currency, total_minor, coupon_code FROM commerce_orders WHERE tx_ref=$1", [txRef]);
      const order = orderResult.rows[0];
      if (!order) return res.status(404).json({ success: false, error: "Order not found.", code: "ORDER_NOT_FOUND" });
      if (order.status === "paid") return res.json({ success: true, duplicate: true });
      const verifiedAmount = fromProviderAmount(data.amount, data.currency);
      if (String(data.currency) !== order.currency || verifiedAmount !== Number(order.total_minor)) {
        return res.status(400).json({ success: false, error: "Payment amount or currency does not match the order.", code: "PAYMENT_MISMATCH" });
      }
      const updated = await pool.query(
        "WITH paid_order AS (UPDATE commerce_orders SET status='paid', provider_transaction_id=$2, paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending' RETURNING id,coupon_code), coupon_update AS (UPDATE commerce_coupons c SET redeemed_count=c.redeemed_count+1 FROM paid_order p WHERE c.code=p.coupon_code AND p.coupon_code IS NOT NULL RETURNING c.id) SELECT id FROM paid_order",
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

module.exports = { MAX_ITEMS, MAX_QUANTITY, CURRENCIES, ensureCommerceSchema, createCommerceRouter, toProviderAmount, fromProviderAmount, calculateCouponDiscount };
