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
  assert.match(calls[0], /REFERENCES users\(id\)/);
  assert.match(calls[0], /idx_commerce_orders_user_created/);
});
