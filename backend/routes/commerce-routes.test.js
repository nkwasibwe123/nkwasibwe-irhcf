"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CURRENCIES, toProviderAmount, fromProviderAmount, ensureCommerceSchema } = require("./commerce-routes");

test("commerce money conversion preserves integer and minor-unit currencies", () => {
  assert.equal(toProviderAmount(2500, "RWF"), 2500);
  assert.equal(fromProviderAmount(2500, "RWF"), 2500);
  assert.equal(toProviderAmount(2599, "USD"), 25.99);
  assert.equal(fromProviderAmount(25.99, "USD"), 2599);
});

test("commerce currencies are an explicit allowlist", () => {
  assert.equal(CURRENCIES.has("RWF"), true);
  assert.equal(CURRENCIES.has("USD"), true);
  assert.equal(CURRENCIES.has("BTC"), false);
});

test("commerce schema initializer creates indexed products and user-owned orders", async () => {
  const calls = [];
  await ensureCommerceSchema({
    async query(sql) {
      calls.push(sql);
      return { rows: [] };
    }
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_products/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_orders/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_order_items/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_cart_items/);
  assert.match(calls[0], /PRIMARY KEY \(user_id, product_id\)/);
  assert.match(calls[0], /REFERENCES users\(id\)/);
  assert.match(calls[0], /idx_commerce_orders_user_created/);
});

const express = require("express");
const { createCommerceRouter } = require("./commerce-routes");

async function withServer(app, callback) {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address();
    await callback("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("public product endpoint returns active product data from the database", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query(sql) {
      assert.match(sql, /FROM commerce_products WHERE active = TRUE/);
      return { rows: [{ id: "4", name: "Notebook", price_minor: "2500", currency: "RWF", stock_quantity: 8 }] };
    } },
    authenticateToken: (req, res, next) => { req.user = { id: 7, email: "buyer@example.com" }; next(); },
    env: {}
  }));
  await withServer(app, async base => {
    const response = await fetch(base + "/api/commerce/products");
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.products[0].name, "Notebook");
  });
});

test("checkout fails closed when payment secrets are not configured", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query() { throw new Error("database must not be called before provider configuration"); } },
    authenticateToken: (req, res, next) => { req.user = { id: 7, email: "buyer@example.com" }; next(); },
    env: {}
  }));
  await withServer(app, async base => {
    const response = await fetch(base + "/api/commerce/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productId: 1, quantity: 1 }] })
    });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.code, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  });
});
