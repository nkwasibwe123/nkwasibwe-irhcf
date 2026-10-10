"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSearchStore } = require("./search-store");

test("disabled search store stays in memory-only mode", async () => {
  const store = createSearchStore({ enabled: false, pool: { query: async () => { throw new Error("must not query"); } } });
  assert.equal(store.enabled, false);
  assert.deepEqual(await store.loadAll(), []);
  assert.equal(await store.upsert({ id: "a" }), false);
  assert.equal(await store.remove("a"), false);
  assert.deepEqual(await store.status(), { enabled: false, persistent: false });
});

test("search store creates table and persists documents with parameterized SQL", async () => {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: 1 }] };
    if (/SELECT id, title, content/i.test(sql)) return { rows: [{ id: "doc-1", title: "A title", text: "A body", url: null, language: "en" }] };
    if (/DELETE FROM/i.test(sql)) return { rowCount: 1 };
    return { rows: [] };
  } };
  const store = createSearchStore({ pool, enabled: true });
  assert.equal(await store.upsert({ id: "doc-1", title: "A title", text: "A body", language: "en" }), true);
  assert.equal(calls.some(call => /CREATE TABLE IF NOT EXISTS irhcf_search_documents/.test(call.sql)), true);
  assert.equal(calls.some(call => /ON CONFLICT \(id\) DO UPDATE/.test(call.sql)), true);
  const rows = await store.loadAll();
  assert.equal(rows[0].id, "doc-1");
  assert.equal(await store.remove("doc-1"), true);
  assert.deepEqual(await store.status(), { enabled: true, persistent: true, documents: 1 });
  assert.equal(calls.every(call => !String(call.sql).includes("doc-1")), true);
});
