"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { checkRateLimitEntry } = require("./rate-limit-store");

test("rate limit counts requests within a window and resets after the window", () => {
  const store = new Map();
  const options = { windowMs: 1000, maxEntries: 10 };
  assert.deepEqual(checkRateLimitEntry(store, "u1", 2, 1000, options), { allowed: true, remaining: 1 });
  assert.deepEqual(checkRateLimitEntry(store, "u1", 2, 1100, options), { allowed: true, remaining: 0 });
  assert.equal(checkRateLimitEntry(store, "u1", 2, 1200, options).code, "RATE_LIMITED");
  assert.deepEqual(checkRateLimitEntry(store, "u1", 2, 2101, options), { allowed: true, remaining: 1 });
});

test("a full rate-limit store rejects new keys rather than deleting active buckets", () => {
  const store = new Map([
    ["u1", { startedAt: 1000, count: 1 }],
    ["u2", { startedAt: 1000, count: 1 }]
  ]);
  const result = checkRateLimitEntry(store, "u3", 10, 1100, { windowMs: 1000, maxEntries: 2 });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "RATE_LIMIT_STORE_FULL");
  assert.equal(store.has("u1"), true);
  assert.equal(store.has("u2"), true);
  assert.equal(store.has("u3"), false);
});

test("expired buckets are pruned before a new key is rejected", () => {
  const store = new Map([
    ["expired", { startedAt: 1, count: 1 }],
    ["active", { startedAt: 9500, count: 1 }]
  ]);
  const result = checkRateLimitEntry(store, "new", 10, 10_000, { windowMs: 1000, maxEntries: 2 });
  assert.equal(result.allowed, true);
  assert.equal(store.has("expired"), false);
  assert.equal(store.has("active"), true);
  assert.equal(store.has("new"), true);
});

test("a previously seen key can still use its existing bucket at capacity", () => {
  const store = new Map([
    ["u1", { startedAt: 1000, count: 1 }],
    ["u2", { startedAt: 1000, count: 1 }]
  ]);
  const result = checkRateLimitEntry(store, "u1", 10, 1100, { windowMs: 1000, maxEntries: 2 });
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 8);
});
